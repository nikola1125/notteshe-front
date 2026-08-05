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
  total: number;
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

    // Payment fee columns added in migration 0003 — read separately so order creation works before migration
    let paymentFeeCfg = { paymentFeeEnabled: false, paymentFeePercent: 0, paymentFeeFixed: 0 };
    try {
      const [pf] = await db()
        .select({ paymentFeeEnabled: shippingConfig.paymentFeeEnabled, paymentFeePercent: shippingConfig.paymentFeePercent, paymentFeeFixed: shippingConfig.paymentFeeFixed })
        .from(shippingConfig)
        .limit(1);
      if (pf) paymentFeeCfg = { paymentFeeEnabled: pf.paymentFeeEnabled ?? false, paymentFeePercent: pf.paymentFeePercent ?? 0, paymentFeeFixed: pf.paymentFeeFixed ?? 0 };
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
    };

    // ── Authenticate with POK and create SDK order ─────────────────────────────
    const token = await pokAuth();

    const pokBody: Record<string, unknown> = {
      amount: Math.round(total),        // NUMBER, not string — POK API expects integer
      currencyCode: "ALL",
      autoCapture: false,
      products: itemsWithPrices.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: Math.round(i.price),
      })),
      shippingCost: Math.round(shippingFee),
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

export async function pokCapture(pokOrderId: string): Promise<void> {
  await pokAction(`${pokOrderId}/capture`, {});
}

export async function pokCancel(pokOrderId: string, reason?: string): Promise<void> {
  await pokAction(`${pokOrderId}/cancel`, { cancellationReason: reason ?? "Cancelled by merchant" });
}

export async function pokRefund(pokOrderId: string, reason?: string): Promise<void> {
  const body: Record<string, unknown> = {};
  if (reason) body.refundReason = reason;
  await pokAction(`${pokOrderId}/refund`, body);
}
