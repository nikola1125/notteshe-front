import { createAPIFileRoute } from "@tanstack/react-start/api";

export const APIRoute = createAPIFileRoute("/api/pokpay/webhook")({
  POST: async ({ request }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response("OK", { status: 200 });
    }

    console.log("[POK webhook]", JSON.stringify(body));

    try {
      await handleWebhook(body);
    } catch (err) {
      console.error("[POK webhook] recovery error:", err);
    }

    // Always return 200 — POK retries on non-2xx
    return new Response("OK", { status: 200 });
  },
});

async function handleWebhook(body: unknown) {
  if (!body || typeof body !== "object") return;

  const payload = body as Record<string, unknown>;

  // Extract pokOrderId from known POK payload shapes
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const pokOrderId =
    (data.orderId as string | undefined) ??
    (data.id as string | undefined) ??
    (data.sdkOrderId as string | undefined) ??
    (data.pokOrderId as string | undefined);

  const status =
    (data.status as string | undefined) ??
    (payload.event as string | undefined);

  if (!pokOrderId) return;

  // Only act on successful payment events
  const isSuccess =
    status === "COMPLETED" ||
    status === "PAID" ||
    status === "SUCCESS" ||
    status === "payment.completed" ||
    payload.event === "payment.completed";

  if (!isSuccess) return;

  const { db } = await import("@/db");
  const {
    pendingOrder, orders, orderItem, productSize,
    discountCode: discountCodeTable, auditLog,
  } = await import("@/db/schema");
  const { eq, sql, and } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");

  // Check if order was already created by the browser callback
  const existing = await db()
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.pokOrderId, pokOrderId))
    .limit(1);

  if (existing[0]) {
    // Browser callback already handled it — just clean up pending order if still around
    await db().delete(pendingOrder).where(eq(pendingOrder.pokOrderId, pokOrderId));
    return;
  }

  // Browser callback did NOT complete — recover from pending order
  const [pending] = await db()
    .select()
    .from(pendingOrder)
    .where(eq(pendingOrder.pokOrderId, pokOrderId))
    .limit(1);

  if (!pending) {
    console.warn("[POK webhook] no pending order for pokOrderId:", pokOrderId);
    return;
  }

  type OrderData = {
    email: string; phone: string;
    firstName: string; lastName: string;
    address: string; address2?: string;
    city: string; postalCode: string; country: string;
    discountCode: string | null; discountAmount: number;
    items: Array<{
      productId: string; name: string; price: number;
      originalPrice: number | null; image: string;
      size: string; colour: string; quantity: number;
    }>;
    subtotal: number; shippingFee: number; paymentFee?: number; total: number;
  };
  const orderData = pending.orderData as OrderData;

  // Final stock floor guard before creating the order
  for (const item of orderData.items) {
    const updated = await db()
      .update(productSize)
      .set({ stock: sql`stock - ${item.quantity}` })
      .where(
        and(
          eq(productSize.productId, item.productId),
          eq(productSize.label, item.size),
          sql`stock >= ${item.quantity}`,
        )
      )
      .returning({ id: productSize.id });

    if (updated.length === 0) {
      console.error(`[POK webhook] insufficient stock for ${item.name} size ${item.size} on recovery`);
      await db().insert(auditLog).values({
        id: randomUUID(),
        adminId: null,
        action: "payment.order_error",
        entityType: "payment",
        entityId: pokOrderId,
        diff: {
          after: {
            errorMessage: `Webhook recovery: insufficient stock for "${item.name}" size ${item.size}`,
            email: orderData.email,
            note: "Payment confirmed by POK — manual intervention required",
          },
        },
      });
      return;
    }
  }

  const orderId = randomUUID();
  const shippingAddress = {
    firstName: orderData.firstName, lastName: orderData.lastName,
    line1: orderData.address, line2: orderData.address2 ?? null,
    city: orderData.city, postalCode: orderData.postalCode,
    country: orderData.country, phone: orderData.phone, email: orderData.email,
  };

  // Insert order — use authoritative totals from pendingOrder.orderData
  const orderValues = {
    id: orderId,
    userId: pending.userId,
    status: "PENDING" as const,
    subtotal: orderData.subtotal,
    shippingFee: orderData.shippingFee,
    discountCode: orderData.discountCode,
    discountAmount: orderData.discountAmount,
    total: orderData.total,
    shippingAddress,
    pokOrderId,
  };

  try {
    await db().insert(orders).values({ ...orderValues, paymentFee: orderData.paymentFee ?? 0 });
  } catch (err) {
    const msg = String((err as Error)?.message ?? "");
    const isUniqueViolation = (err as { code?: string })?.code === "23505" || msg.toLowerCase().includes("unique");
    if (isUniqueViolation) {
      await db().delete(pendingOrder).where(eq(pendingOrder.pokOrderId, pokOrderId));
      return;
    }
    // payment_fee column not yet migrated — retry without it
    if (msg.includes("payment_fee")) {
      await db().insert(orders).values(orderValues);
    } else {
      throw err;
    }
  }

  // Insert order items
  await db().insert(orderItem).values(
    orderData.items.map((item) => ({
      id: randomUUID(),
      orderId,
      productId: item.productId,
      productSnapshot: {
        name: item.name, image: item.image,
        price: item.price, originalPrice: item.originalPrice,
      },
      size: item.size,
      colour: item.colour,
      quantity: item.quantity,
      unitPrice: item.price,
    }))
  );

  // Increment discount code usage counter
  if (orderData.discountCode) {
    await db()
      .update(discountCodeTable)
      .set({ usedCount: sql`used_count + 1` })
      .where(eq(discountCodeTable.code, orderData.discountCode));
  }

  await db().delete(pendingOrder).where(eq(pendingOrder.pokOrderId, pokOrderId));

  await db().insert(auditLog).values({
    id: randomUUID(),
    adminId: null,
    action: "payment.webhook_recovery",
    entityType: "payment",
    entityId: pokOrderId,
    diff: {
      after: {
        orderId,
        userId: pending.userId,
        email: orderData.email,
        total: orderData.total,
        note: "Order created via webhook — browser callback did not complete",
      },
    },
  });

  // Fire-and-forget confirmation email
  const { sendOrderConfirmation } = await import("@/lib/resend");
  sendOrderConfirmation({
    to: orderData.email,
    firstName: orderData.firstName,
    orderId,
    items: orderData.items.map((i) => ({
      name: i.name, size: i.size, colour: i.colour,
      quantity: i.quantity, unitPrice: i.price,
    })),
    subtotal: orderData.subtotal,
    shippingFee: orderData.shippingFee,
    total: orderData.total,
  }).catch((err) => console.error("[resend] webhook recovery email failed:", err));

  console.log("[POK webhook] recovery order created:", orderId);
}
