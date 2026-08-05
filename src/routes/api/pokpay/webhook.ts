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
  const { pendingOrder, orders, orderItem, productSize, auditLog } = await import("@/db/schema");
  const { eq, sql, and, inArray } = await import("drizzle-orm");
  const { randomUUID } = await import("node:crypto");

  // Check if order was already created by the browser callback
  const existing = await db()
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.pokOrderId, pokOrderId))
    .limit(1);

  if (existing[0]) {
    // Browser callback already handled it — just clean up pending order if still exists
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

  const orderData = pending.orderData as {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    address: string;
    address2?: string;
    city: string;
    postalCode: string;
    country: string;
    discountCode?: string;
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
  };

  // Final stock check
  const productIds = [...new Set(orderData.items.map((i) => i.productId))];
  const sizeRows = await db()
    .select({ productId: productSize.productId, label: productSize.label, stock: productSize.stock })
    .from(productSize)
    .where(inArray(productSize.productId, productIds));

  for (const item of orderData.items) {
    const row = sizeRows.find((s) => s.productId === item.productId && s.label === item.size);
    if (!row || row.stock < item.quantity) {
      console.error(`[POK webhook] insufficient stock for ${item.name} size ${item.size} on recovery`);
      // Log but don't throw — mark as audit so ops can manually intervene
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
    firstName: orderData.firstName,
    lastName: orderData.lastName,
    line1: orderData.address,
    line2: orderData.address2 ?? null,
    city: orderData.city,
    postalCode: orderData.postalCode,
    country: orderData.country,
    phone: orderData.phone,
    email: orderData.email,
  };

  const subtotal = orderData.items.reduce((s, i) => s + i.price * i.quantity, 0);
  // Use a simplified shipping/discount calculation — the full validated values
  // were computed at pending order creation time; recover the total from the original amount
  const total = Number((data.amount as string | number) ?? subtotal);

  await db().insert(orders).values({
    id: orderId,
    userId: pending.userId,
    status: "PENDING",
    subtotal,
    shippingFee: Math.max(0, total - subtotal),
    discountCode: orderData.discountCode ?? null,
    discountAmount: 0,
    total,
    shippingAddress,
    pokOrderId,
  });

  const itemRows = orderData.items.map((item) => ({
    id: randomUUID(),
    orderId,
    productId: item.productId,
    productSnapshot: { name: item.name, image: item.image, price: item.price, originalPrice: item.originalPrice },
    size: item.size,
    colour: item.colour,
    quantity: item.quantity,
    unitPrice: item.price,
  }));
  await db().insert(orderItem).values(itemRows);

  for (const item of orderData.items) {
    await db()
      .update(productSize)
      .set({ stock: sql`stock - ${item.quantity}` })
      .where(and(eq(productSize.productId, item.productId), eq(productSize.label, item.size)));
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
        total,
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
      name: i.name,
      size: i.size,
      colour: i.colour,
      quantity: i.quantity,
      unitPrice: i.price,
    })),
    subtotal,
    shippingFee: Math.max(0, total - subtotal),
    total,
  }).catch((err) => console.error("[resend] webhook recovery email failed:", err));

  console.log("[POK webhook] recovery order created:", orderId);
}
