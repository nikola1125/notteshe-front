import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const POK_BASE = "https://api.pokpay.io/";

async function pokAuth(): Promise<string> {
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
  return token;
}

const CreatePokOrderSchema = z.object({
  amount: z.number().positive(),
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      size: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
    })
  ),
  shippingCost: z.number().min(0),
  merchantReference: z.string(),
  // Full order payload so we can recover via webhook if browser closes
  orderPayload: z.object({
    email: z.string(),
    phone: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    address: z.string(),
    address2: z.string().optional(),
    city: z.string(),
    postalCode: z.string(),
    country: z.string(),
    discountCode: z.string().optional(),
    items: z.array(z.object({
      productId: z.string(),
      name: z.string(),
      price: z.number(),
      originalPrice: z.number().nullable(),
      image: z.string(),
      size: z.string(),
      colour: z.string(),
      quantity: z.number().int().positive(),
    })),
  }),
});

export const createPokOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreatePokOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { db } = await import("@/db");
    const { productSize, pendingOrder } = await import("@/db/schema");
    const { inArray, and, eq, gt, sql, count } = await import("drizzle-orm");

    const session = await requireAuth();
    const userId = session.user.id;

    // Rate limit: max 3 POK order creations per user per 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const [{ value: recentCount }] = await db()
      .select({ value: count() })
      .from(pendingOrder)
      .where(and(
        eq(pendingOrder.userId, userId),
        gt(pendingOrder.createdAt, twoMinutesAgo),
      ));
    if (recentCount >= 3) {
      throw new Error("Too many payment attempts. Please wait a moment and try again.");
    }

    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const sizeRows = await db()
      .select({ productId: productSize.productId, label: productSize.label, stock: productSize.stock })
      .from(productSize)
      .where(inArray(productSize.productId, productIds));

    // Count stock reserved in active (not expired) pending orders for these products
    const now = new Date();
    const activePending = await db()
      .select({ orderData: pendingOrder.orderData, userId: pendingOrder.userId })
      .from(pendingOrder)
      .where(gt(pendingOrder.expiresAt, now));

    // Build reserved stock map: productId → size → reserved quantity (excluding this user's own reservations)
    const reserved = new Map<string, number>();
    for (const row of activePending) {
      if (row.userId === userId) continue; // don't block yourself
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

    // Authenticate with POK and create the SDK order
    const token = await pokAuth();

    const res = await fetch(
      `${POK_BASE}merchants/${process.env.POK_MERCHANT_ID}/sdk-orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: String(Math.round(data.amount)),
          currencyCode: "ALL",
          autoCapture: true,
          products: data.items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
          })),
          shippingCost: data.shippingCost,
          merchantCustomReference: data.merchantReference,
          expiresAfterMinutes: 30,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`POK order creation failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    const pokOrderId = json?.data?.sdkOrder?.id as string | undefined;
    if (!pokOrderId) throw new Error("POK response missing sdkOrder.id");

    // Store pending order for webhook recovery and stock reservation
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db().insert(pendingOrder).values({
      id: data.merchantReference,
      pokOrderId,
      userId,
      orderData: data.orderPayload,
      expiresAt,
    });

    // Log payment initiation
    await db().insert((await import("@/db/schema")).auditLog).values({
      id: (await import("node:crypto")).randomUUID(),
      adminId: null,
      action: "payment.initiated",
      entityType: "payment",
      entityId: pokOrderId,
      diff: {
        after: {
          userId,
          email: data.orderPayload.email,
          amount: data.amount,
          itemCount: data.items.length,
          merchantReference: data.merchantReference,
        },
      },
    });

    return { pokOrderId };
  });
