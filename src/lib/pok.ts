import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const POK_BASE = process.env.POK_ENV === "production"
  ? "https://api.pokpay.io/"
  : "https://api-staging.pokpay.io/"; // staging is default; set POK_ENV=production for live

let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function pokAuth(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiresAt) return _cachedToken;
  const res = await fetch(`${POK_BASE}auth/sdk/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      keyId: process.env.POK_KEY_ID,
      keySecret: process.env.POK_KEY_SECRET,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`POK auth failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const token = json?.data?.accessToken as string | undefined;
  if (!token) throw new Error("POK auth returned no access token");
  _cachedToken = token;
  _tokenExpiresAt = Date.now() + 50 * 60 * 1000; // cache for 50 min
  return token;
}

// The webhook URL we register with POK carries a secret token. POK is the only
// party that ever receives this URL, so an inbound /api/pokpay/webhook request
// whose token doesn't match POK_WEBHOOK_SECRET is a forgery and is rejected.
export function pokWebhookUrl(): string | null {
  const appUrl = process.env.APP_URL;
  if (!appUrl) return null;
  const secret = process.env.POK_WEBHOOK_SECRET;
  const base = `${appUrl}/api/pokpay/webhook`;
  return secret ? `${base}?token=${encodeURIComponent(secret)}` : base;
}

// Constant-time comparison of a webhook's token against the configured secret.
// Returns false when no secret is configured (fail closed — never trust an
// unauthenticated webhook once this protection is deployed). Pure JS so this
// module stays safe to include in the client bundle (checkout imports it).
export function verifyPokWebhookToken(token: string | null | undefined): boolean {
  const secret = process.env.POK_WEBHOOK_SECRET;
  if (!secret || !token || token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

// Client sends structural cart data only — no prices (fetched from DB server-side)
const CreatePokOrderSchema = z.object({
  merchantReference: z.string().uuid(),
  // Currency the shopper selected. EUR is the base price; ALL is converted server-side.
  currency: z.enum(["EUR", "ALL"]).default("EUR"),
  discountCode: z.string().optional(),
  // Gift card being redeemed (applied as payment reduction, separate from purchase)
  giftCardCode: z.string().optional(),
  shippingForm: z.object({
    email: z.string().email(),
    phone: z.string(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    address: z.string().min(1),
    address2: z.string().optional(),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(1),
  }),
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    size: z.string(),
    colour: z.string(),
    quantity: z.number().int().positive(),
    image: z.string(),
    // Gift card purchase fields
    isGiftCard: z.boolean().optional(),
    giftCardAmountLek: z.number().optional(),
    giftCardRecipientEmail: z.string().optional(),
    giftCardRecipientName: z.string().optional(),
    giftCardMessage: z.string().optional(),
    giftCardForSelf: z.boolean().optional(),
  })),
});

export type OrderDataItem = {
  productId: string;
  name: string;
  price: number;
  originalPrice: number | null;
  image: string;
  size: string;
  colour: string;
  quantity: number;
  // Gift card purchase metadata
  isGiftCard?: boolean;
  giftCardAmountLek?: number;
  giftCardRecipientEmail?: string;
  giftCardRecipientName?: string;
  giftCardMessage?: string;
  giftCardForSelf?: boolean;
};

export type OrderDataPayload = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  address2?: string;
  city: string;
  postalCode: string;
  country: string;
  discountCode: string | null;
  discountAmount: number;
  giftCardCode: string | null;   // gift card used for redemption (not purchase)
  giftCardAmountLek: number;     // Lek amount to debit on success
  items: Array<OrderDataItem>;
  subtotal: number;
  shippingFee: number;
  paymentFee: number;
  total: number;              // EUR base total (source of truth — after gift card reduction)
  currency: "EUR" | "ALL";    // currency charged via POK
  pokAmount: number;          // exact amount sent to POK in `currency`
};

export const createPokOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreatePokOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { db } = await import("@/db");
    const {
      productSize, pendingOrder, product, shippingConfig,
      discountCode: discountCodeTable, auditLog,
    } = await import("@/db/schema");
    const { inArray, and, eq, gt, count } = await import("drizzle-orm");

    const session = await requireAuth();
    const userId = session.user.id;

    // Separate regular items from gift card purchase items
    const regularItems = data.items.filter((i) => !i.isGiftCard);
    const giftCardPurchaseItems = data.items.filter((i) => i.isGiftCard);

    // No gift-card-on-gift-card: can't use a gift card to BUY a gift card
    if (giftCardPurchaseItems.length > 0 && data.giftCardCode) {
      throw new Error("Gift cards cannot be purchased using another gift card.");
    }

    // ── Rate limit: max 3 POK order initiations per user per 2 minutes ──────────
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const [{ value: recentCount }] = await db()
      .select({ value: count() })
      .from(pendingOrder)
      .where(and(eq(pendingOrder.userId, userId), gt(pendingOrder.createdAt, twoMinutesAgo)));
    if (recentCount >= 3) {
      throw new Error("Too many payment attempts. Please wait a moment and try again.");
    }

    // ── Fetch authoritative prices from DB (regular items only) ───────────────
    const productIds = [...new Set(regularItems.map((i) => i.productId))];
    const [productRows, sizeRows] = await Promise.all([
      productIds.length > 0
        ? db()
            .select({ id: product.id, price: product.price, originalPrice: product.originalPrice, isSale: product.isSale })
            .from(product)
            .where(inArray(product.id, productIds))
        : Promise.resolve([]),
      productIds.length > 0
        ? db()
            .select({ productId: productSize.productId, label: productSize.label, stock: productSize.stock })
            .from(productSize)
            .where(inArray(productSize.productId, productIds))
        : Promise.resolve([]),
    ]);

    const priceMap = new Map(productRows.map((p) => [p.id, p]));

    // Build regular items with server-fetched prices
    const regularItemsWithPrices = regularItems.map((item) => {
      const p = priceMap.get(item.productId);
      if (!p) throw new Error(`Product "${item.name}" is no longer available.`);
      return {
        ...item,
        price: p.price,
        originalPrice: p.isSale ? (p.originalPrice ?? null) : null,
      };
    });

    // ── Stock check with active reservation accounting ─────────────────────────
    const now = new Date();
    const activePending = await db()
      .select({ orderData: pendingOrder.orderData, userId: pendingOrder.userId })
      .from(pendingOrder)
      .where(gt(pendingOrder.expiresAt, now));

    const reserved = new Map<string, number>();
    for (const row of activePending) {
      if (row.userId === userId) continue;
      const od = row.orderData as { items?: Array<{ productId: string; size: string; quantity: number; isGiftCard?: boolean }> };
      for (const item of od.items ?? []) {
        if (item.isGiftCard) continue;
        const key = `${item.productId}::${item.size}`;
        reserved.set(key, (reserved.get(key) ?? 0) + item.quantity);
      }
    }

    for (const item of regularItems) {
      const row = sizeRows.find((s) => s.productId === item.productId && s.label === item.size);
      const reservedQty = reserved.get(`${item.productId}::${item.size}`) ?? 0;
      const available = (row?.stock ?? 0) - reservedQty;
      if (!row || available < item.quantity) {
        throw new Error(`"${item.name}" size ${item.size} is no longer available in the requested quantity.`);
      }
    }

    // ── Compute totals server-side ─────────────────────────────────────────────
    // Gift card price in EUR = amountLek / rate (rate fetched below)
    // Build combined item list (prices filled in for gift cards after rate is known)
    const regularSubtotal = regularItemsWithPrices.reduce((s, i) => s + i.price * i.quantity, 0);

    const [cfg] = await db()
      .select({ enabled: shippingConfig.enabled, fee: shippingConfig.fee, freeThreshold: shippingConfig.freeThreshold })
      .from(shippingConfig)
      .limit(1);

    // Payment fee (0003) + currency rate (0005) columns
    let paymentFeeCfg = { paymentFeeEnabled: false, paymentFeePercent: 0, paymentFeeFixed: 0 };
    let eurToLekRate = 100;
    let lekRounding = 100;
    try {
      const [pf] = await db()
        .select({ paymentFeeEnabled: shippingConfig.paymentFeeEnabled, paymentFeePercent: shippingConfig.paymentFeePercent, paymentFeeFixed: shippingConfig.paymentFeeFixed, eurToLekRate: shippingConfig.eurToLekRate, lekRounding: shippingConfig.lekRounding })
        .from(shippingConfig)
        .limit(1);
      if (pf) {
        paymentFeeCfg = { paymentFeeEnabled: pf.paymentFeeEnabled ?? false, paymentFeePercent: pf.paymentFeePercent ?? 0, paymentFeeFixed: pf.paymentFeeFixed ?? 0 };
        eurToLekRate = pf.eurToLekRate ?? 100;
        lekRounding = pf.lekRounding ?? 100;
      }
    } catch { /* columns not yet migrated */ }

    // Gift card purchase items: price in EUR = amountLek / rate
    const gcItemsWithPrices = giftCardPurchaseItems.map((item) => {
      const amountLek = item.giftCardAmountLek ?? 0;
      if (amountLek <= 0) throw new Error(`Invalid gift card amount for "${item.name}".`);
      const priceEur = Math.round((amountLek / eurToLekRate) * 100) / 100;
      return {
        ...item,
        price: priceEur,
        originalPrice: null as null,
        isGiftCard: true as const,
        giftCardAmountLek: amountLek,
      };
    });

    // Combined item list for order payload
    const itemsWithPrices: OrderDataItem[] = [
      ...regularItemsWithPrices,
      ...gcItemsWithPrices,
    ];

    // Shipping: free if cart has only gift cards (digital items, no physical shipment)
    const subtotal = regularSubtotal + gcItemsWithPrices.reduce((s, i) => s + i.price * i.quantity, 0);
    const shippingFee = regularItemsWithPrices.length === 0 ? 0 :
      (cfg?.enabled ? (regularSubtotal >= (cfg.freeThreshold ?? 200) ? 0 : (cfg.fee ?? 12)) : 0);

    // Validate discount server-side (read-only check — increment happens in placeOrder)
    let discountAmount = 0;
    let validatedDiscountCode: string | null = null;
    if (data.discountCode) {
      const [code] = await db()
        .select()
        .from(discountCodeTable)
        .where(eq(discountCodeTable.code, data.discountCode.toUpperCase().trim()))
        .limit(1);

      const nowTs = new Date();
      if (
        code &&
        code.isActive &&
        (!code.expiresAt || code.expiresAt > nowTs) &&
        (code.maxUses === null || code.usedCount < code.maxUses) &&
        (code.minOrderAmount === null || regularSubtotal >= code.minOrderAmount)
      ) {
        const saleCheck = productRows.filter((p) => p.isSale).map((p) => p.id);
        const hasSaleItem = regularItems.some((i) => saleCheck.includes(i.productId));
        if (!hasSaleItem) {
          discountAmount = code.type === "PERCENT"
            ? Math.round(regularSubtotal * (code.value / 100) * 100) / 100
            : Math.min(code.value, regularSubtotal);
          validatedDiscountCode = code.code;
        }
      }
    }

    // Validate gift card redemption (read-only — debit happens in placeOrder)
    let giftCardAmountLek = 0;
    let validatedGiftCardCode: string | null = null;
    if (data.giftCardCode) {
      const { validateGiftCard } = await import("@/lib/giftCard");
      const amountDueEur = Math.max(0, subtotal + shippingFee - discountAmount);
      const gcResult = await validateGiftCard(data.giftCardCode, amountDueEur, eurToLekRate);
      if (!gcResult.valid) throw new Error(gcResult.error);
      validatedGiftCardCode = gcResult.code;
      giftCardAmountLek = gcResult.appliedLek;
    }
    const giftCardAppliedEur = giftCardAmountLek / eurToLekRate;

    // Payment processing fee charged to customer
    const paymentFee = paymentFeeCfg.paymentFeeEnabled
      ? Math.round(
          ((subtotal + shippingFee - discountAmount) * (paymentFeeCfg.paymentFeePercent / 100) + paymentFeeCfg.paymentFeeFixed)
          * 100
        ) / 100
      : 0;

    const total = Math.max(0, subtotal + shippingFee - discountAmount + paymentFee - giftCardAppliedEur);

    // ── Convert EUR base amounts into the currency POK will charge ─────────────
    // EUR: keep 2 decimals. ALL: multiply by rate and round to the nearest step.
    const currency = data.currency;
    const toCharge = (eur: number): number => {
      if (currency === "EUR") return Math.round(eur * 100) / 100;
      const step = lekRounding > 0 ? lekRounding : 1;
      return Math.round((eur * eurToLekRate) / step) * step;
    };
    const chargeTotal = toCharge(total);

    // POK minimum is 50 ALL (~€0.50). Reject before calling the API.
    const minCharge = currency === "ALL" ? 50 : 0.5;
    if (chargeTotal < minCharge) {
      const label = currency === "ALL" ? "50 L" : "0.50 €";
      throw new Error(`Order total is below the minimum amount required for card payment (${label}). Please add more items or use Cash on Delivery.`);
    }

    // ── Build authoritative order payload stored in pendingOrder ───────────────
    const orderPayload: OrderDataPayload = {
      email: data.shippingForm.email,
      phone: data.shippingForm.phone,
      firstName: data.shippingForm.firstName,
      lastName: data.shippingForm.lastName,
      address: data.shippingForm.address,
      address2: data.shippingForm.address2,
      city: data.shippingForm.city,
      postalCode: data.shippingForm.postalCode,
      country: data.shippingForm.country,
      discountCode: validatedDiscountCode,
      discountAmount,
      giftCardCode: validatedGiftCardCode,
      giftCardAmountLek,
      items: itemsWithPrices,
      subtotal,
      shippingFee,
      paymentFee,
      total,
      currency,
      pokAmount: chargeTotal,
    };

    // ── Authenticate with POK and create SDK order ─────────────────────────────
    const token = await pokAuth();

    const pokBody: Record<string, unknown> = {
      amount: chargeTotal,              // in `currency` (EUR: 2dp, ALL: whole)
      currencyCode: currency,
      autoCapture: false,
      products: itemsWithPrices.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: toCharge(i.price),
      })),
      shippingCost: toCharge(shippingFee + paymentFee),
      merchantCustomReference: data.merchantReference,
      expiresAfterMinutes: 30,
    };

    // Add webhook URL (with secret token) so POK can notify us for recovery if
    // the browser closes before the success callback fires.
    const webhookUrl = pokWebhookUrl();
    if (webhookUrl) {
      pokBody.webhookUrl = webhookUrl;
    }

    const res = await fetch(
      `${POK_BASE}merchants/${process.env.POK_MERCHANT_ID}/sdk-orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(pokBody),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`POK order creation failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    const pokOrderId = json?.data?.sdkOrder?.id as string | undefined;
    if (!pokOrderId) throw new Error("POK response missing sdkOrder.id");

    // ── Store pending order (reservation + recovery data) ──────────────────────
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db().insert(pendingOrder).values({
      id: data.merchantReference,
      pokOrderId,
      userId,
      orderData: orderPayload,
      expiresAt,
    });

    // ── Audit: payment initiated ───────────────────────────────────────────────
    const { randomUUID } = await import("node:crypto");
    await db().insert(auditLog).values({
      id: randomUUID(),
      adminId: null,
      action: "payment.initiated",
      entityType: "payment",
      entityId: pokOrderId,
      diff: {
        after: {
          userId,
          email: data.shippingForm.email,
          amount: total,
          itemCount: data.items.length,
          merchantReference: data.merchantReference,
        },
      },
    });

    return { pokOrderId };
  });

// ─── POK payment actions (called server-side from admin) ──────────────────────

async function pokAction(
  path: string,
  body: Record<string, unknown>
): Promise<void> {
  const token = await pokAuth();
  const res = await fetch(
    `${POK_BASE}merchants/${process.env.POK_MERCHANT_ID}/sdk-orders/${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POK ${path.split("/").pop()} failed (${res.status}): ${text}`);
  }
}

export async function pokCapture(pokOrderId: string, amount: number, currency: "EUR" | "ALL" = "ALL"): Promise<void> {
  // Capture the amount POK authorised, in its currency (ALL: whole, EUR: 2dp).
  const value = currency === "ALL" ? Math.round(amount) : Math.round(amount * 100) / 100;
  await pokAction(`${pokOrderId}/capture`, { amount: value });
}

export async function pokCancel(pokOrderId: string, reason?: string): Promise<void> {
  await pokAction(`${pokOrderId}/cancel`, { cancellationReason: reason ?? "Cancelled by merchant" });
}

export async function pokRefund(pokOrderId: string, reason?: string): Promise<void> {
  const body: Record<string, unknown> = {};
  if (reason) body.refundReason = reason;
  await pokAction(`${pokOrderId}/refund`, body);
}

// ─── Retrieve an order ───────────────────────────────────────────────────────

export interface PokOrderData {
  id: string;
  amount: number;
  currencyCode: string;
  originalCurrencyCode: string;
  originalAmount: number;
  appliedExchangeRate: number;
  shippingCost: number;
  finalAmount: number;
  createdAt: string;
  expiresAt: string | null;
  // Raw payment/order state as reported by POK (field name varies across POK
  // payloads, so we probe the common ones). Used for observability + gating.
  status: string | null;
  commissions: {
    netAmount: number;
    totalCommissionAmount: number;
    grossAmount: number;
  } | null;
}

export async function pokGetOrder(pokOrderId: string): Promise<PokOrderData | null> {
  try {
    const token = await pokAuth();
    const res = await fetch(`${POK_BASE}sdk-orders/${pokOrderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const o = json?.data?.sdkOrder;
    if (!o) return null;
    return {
      id: o.id,
      amount: o.amount,
      currencyCode: o.currencyCode,
      originalCurrencyCode: o.originalCurrencyCode,
      originalAmount: o.originalAmount,
      appliedExchangeRate: o.appliedExchangeRate,
      shippingCost: o.shippingCost ?? 0,
      finalAmount: o.finalAmount,
      createdAt: o.createdAt,
      expiresAt: o.expiresAt ?? null,
      status: (o.status ?? o.state ?? o.paymentStatus ?? o.orderStatus ?? null) as string | null,
      commissions: json?.data?.commissions ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Saved card / card tokenization APIs ─────────────────────────────────────

export async function pokTokenizeCard(cardData: {
  csFlexCard: { jwe: string; [k: string]: unknown };
  billingInfo: {
    firstName: string;
    lastName: string;
    email: string;
    countryCode: string;
    administrativeArea: string;
    locality: string;
    address1: string;
    postalCode: string;
    phoneNumber: string;
  };
  securityCode: string;
}): Promise<{ id: string; hiddenNumber: string }> {
  const token = await pokAuth();
  const res = await fetch(`${POK_BASE}credit-debit-cards/tokenize-guest-card`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cardData),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POK tokenize-guest-card failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const card = json?.data?.creditDebitCard;
  if (!card?.id) throw new Error("POK tokenize-guest-card returned no card id");
  return { id: card.id, hiddenNumber: card.hiddenNumber ?? "" };
}

export async function pokSetupTokenized3ds(
  creditDebitCardId: string,
  pokOrderId: string
): Promise<{
  payerAuthSetupReferenceId: string;
  deviceDataCollection?: { accessToken: string; url: string };
  creditDebitCardId: string;
}> {
  const token = await pokAuth();
  const res = await fetch(`${POK_BASE}credit-debit-cards/${creditDebitCardId}/setup-tokenized-3ds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sdkOrder: { id: pokOrderId } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POK setup-tokenized-3ds failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const pa = json?.data?.payerAuthentication;
  if (!pa) throw new Error("POK setup-tokenized-3ds returned no payerAuthentication");
  return {
    payerAuthSetupReferenceId: pa.payerAuthSetupReferenceId,
    deviceDataCollection: pa.deviceDataCollection ?? undefined,
    creditDebitCardId: pa.creditDebitCard?.id ?? creditDebitCardId,
  };
}

export async function pokGuestConfirm(
  pokOrderId: string,
  creditCardId: string,
  consumerAuthInfo?: Record<string, unknown>
): Promise<void> {
  await pokAction(`${pokOrderId}/guest-confirm`, {
    creditCardId,
    ...(consumerAuthInfo ? { consumerAuthenticationInformation: consumerAuthInfo } : {}),
  });
}

export async function pokGetGuestCardsInfo(cardIds: string[]): Promise<
  Array<{ brand?: string; number?: string; label?: string; type?: string }>
> {
  if (cardIds.length === 0) return [];
  try {
    const token = await pokAuth();
    const res = await fetch(`${POK_BASE}credit-debit-cards/get-guest-cards-information`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cardIds }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.cards ?? [];
  } catch {
    return [];
  }
}
