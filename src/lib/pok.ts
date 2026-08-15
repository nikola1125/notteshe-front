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

// Client sends structural cart data only — no prices (fetched from DB server-side)
const CreatePokOrderSchema = z.object({
  merchantReference: z.string().uuid(),
  // Currency the shopper selected. EUR is the base price; ALL is converted server-side.
  currency: z.enum(["EUR", "ALL"]).default("EUR"),
  discountCode: z.string().optional(),
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
  })),
});

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
  items: Array<{
    productId: string;
    name: string;
    price: number;
    originalPrice: number | null;
    image: string;
    size: string;
    colour: string;
    quantity: number;
  }>;
  subtotal: number;
  shippingFee: number;
  paymentFee: number;
  total: number;              // EUR base total (source of truth)
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
    const { inArray, and, eq, gt, gte, count, sql } = await import("drizzle-orm");

    const session = await requireAuth();
    const userId = session.user.id;

    // ── Rate limit: max 3 POK order initiations per user per 2 minutes ──────────
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const [{ value: recentCount }] = await db()
      .select({ value: count() })
      .from(pendingOrder)
      .where(and(eq(pendingOrder.userId, userId), gt(pendingOrder.createdAt, twoMinutesAgo)));
    if (recentCount >= 3) {
      throw new Error("Too many payment attempts. Please wait a moment and try again.");
    }

    // ── Fetch authoritative prices from DB ────────────────────────────────────
    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const [productRows, sizeRows] = await Promise.all([
      db()
        .select({ id: product.id, price: product.price, originalPrice: product.originalPrice, isSale: product.isSale })
        .from(product)
        .where(inArray(product.id, productIds)),
      db()
        .select({ productId: productSize.productId, label: productSize.label, stock: productSize.stock })
        .from(productSize)
        .where(inArray(productSize.productId, productIds)),
    ]);

    const priceMap = new Map(productRows.map((p) => [p.id, p]));

    // Build items with server-fetched prices
    const itemsWithPrices = data.items.map((item) => {
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
      const od = row.orderData as { items?: Array<{ productId: string; size: string; quantity: number }> };
      for (const item of od.items ?? []) {
        const key = `${item.productId}::${item.size}`;
        reserved.set(key, (reserved.get(key) ?? 0) + item.quantity);
      }
    }

    for (const item of data.items) {
      const row = sizeRows.find((s) => s.productId === item.productId && s.label === item.size);
      const reservedQty = reserved.get(`${item.productId}::${item.size}`) ?? 0;
      const available = (row?.stock ?? 0) - reservedQty;
      if (!row || available < item.quantity) {
        throw new Error(`"${item.name}" size ${item.size} is no longer available in the requested quantity.`);
      }
    }

    // ── Compute totals server-side ─────────────────────────────────────────────
    const subtotal = itemsWithPrices.reduce((s, i) => s + i.price * i.quantity, 0);

    const [cfg] = await db()
      .select({ enabled: shippingConfig.enabled, fee: shippingConfig.fee, freeThreshold: shippingConfig.freeThreshold })
      .from(shippingConfig)
      .limit(1);

    // Payment fee (0003) + currency rate (0005) columns — read separately so order creation works before migration
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
    const shippingFee = cfg?.enabled
      ? (subtotal >= (cfg.freeThreshold ?? 200) ? 0 : (cfg.fee ?? 12))
      : 0;

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
        (code.minOrderAmount === null || subtotal >= code.minOrderAmount)
      ) {
        const saleCheck = productRows.filter((p) => p.isSale).map((p) => p.id);
        const hasSaleItem = data.items.some((i) => saleCheck.includes(i.productId));
        if (!hasSaleItem) {
          discountAmount = code.type === "PERCENT"
            ? Math.round(subtotal * (code.value / 100) * 100) / 100
            : Math.min(code.value, subtotal);
          validatedDiscountCode = code.code;
        }
      }
    }

    // Payment processing fee charged to customer
    const paymentFee = paymentFeeCfg.paymentFeeEnabled
      ? Math.round(
          ((subtotal + shippingFee - discountAmount) * (paymentFeeCfg.paymentFeePercent / 100) + paymentFeeCfg.paymentFeeFixed)
          * 100
        ) / 100
      : 0;

    const total = Math.max(0, subtotal + shippingFee - discountAmount + paymentFee);

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

    // Add webhook URL so POK can notify us for recovery if browser closes
    const appUrl = process.env.APP_URL;
    if (appUrl) {
      pokBody.webhookUrl = `${appUrl}/api/pokpay/webhook`;
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
