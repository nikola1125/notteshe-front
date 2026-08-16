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

  type OrderDataItem = {
    productId: string; name: string; price: number;
    originalPrice: number | null; image: string;
    size: string; colour: string; quantity: number;
    isGiftCard?: boolean;
    giftCardAmountLek?: number;
    giftCardRecipientEmail?: string;
    giftCardRecipientName?: string;
    giftCardMessage?: string;
    giftCardForSelf?: boolean;
  };
  type OrderData = {
    email: string; phone: string;
    firstName: string; lastName: string;
    address: string; address2?: string;
    city: string; postalCode: string; country: string;
    discountCode: string | null; discountAmount: number;
    giftCardCode?: string | null; giftCardAmountLek?: number;
    items: Array<OrderDataItem>;
    subtotal: number; shippingFee: number; paymentFee?: number; total: number;
    currency?: "EUR" | "ALL";
  };
  const orderData = pending.orderData as OrderData;

  // Final stock floor guard before creating the order (skip digital gift card items)
  for (const item of orderData.items) {
    if (item.isGiftCard) continue;
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

  // Gift card redemption debit (if order used a gift card as partial payment)
  const gcCode = orderData.giftCardCode ?? null;
  const gcAmountLek = orderData.giftCardAmountLek ?? 0;
  if (gcCode && gcAmountLek > 0) {
    const { atomicDebitGiftCard } = await import("@/lib/giftCard");
    try {
      await atomicDebitGiftCard(gcCode, gcAmountLek, orderId);
    } catch (err) {
      console.error("[POK webhook] gift card debit failed during recovery:", err);
    }
  }
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
    giftCardCode: gcCode,
    giftCardAmountLek: gcAmountLek,
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
      productId: item.isGiftCard ? null : item.productId,
      productSnapshot: {
        name: item.name, image: item.image,
        price: item.price, originalPrice: item.originalPrice,
        ...(item.isGiftCard ? {
          isGiftCard: true,
          giftCardAmountLek: item.giftCardAmountLek,
          recipientEmail: item.giftCardRecipientEmail,
          recipientName: item.giftCardRecipientName,
          message: item.giftCardMessage,
          forSelf: item.giftCardForSelf,
        } : {}),
      },
      size: item.size,
      colour: item.colour,
      quantity: item.quantity,
      unitPrice: item.price,
    }))
  );

  // Issue gift cards purchased in this order
  const gcPurchases = orderData.items.filter((i) => i.isGiftCard);
  if (gcPurchases.length > 0) {
    const { issueGiftCard } = await import("@/lib/giftCard");
    for (const item of gcPurchases) {
      try {
        await issueGiftCard({
          amountLek: item.giftCardAmountLek ?? 0,
          purchaserUserId: pending.userId,
          purchaserEmail: orderData.email,
          recipientEmail: item.giftCardForSelf ? orderData.email : (item.giftCardRecipientEmail ?? orderData.email),
          recipientName: item.giftCardForSelf ? orderData.firstName : (item.giftCardRecipientName ?? orderData.firstName),
          message: item.giftCardMessage ?? null,
          forSelf: item.giftCardForSelf ?? true,
          sourceOrderId: orderId,
        });
      } catch (err) {
        console.error("[POK webhook] gift card issuance failed:", err);
      }
    }
  }

  // Increment discount code usage counter — atomic guard prevents over-redemption
  if (orderData.discountCode) {
    await db()
      .update(discountCodeTable)
      .set({ usedCount: sql`used_count + 1` })
      .where(
        and(
          eq(discountCodeTable.code, orderData.discountCode),
          sql`(max_uses IS NULL OR used_count < max_uses)`,
        )
      );
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

  // Notify connected admins in real time
  const { notifyAdmins } = await import("@/lib/admin/sse");
  await notifyAdmins("new_order", { ref: orderId.slice(0, 8).toUpperCase(), total: orderData.total });

  // Fire-and-forget confirmation email
  const { sendOrderConfirmation } = await import("@/lib/resend");
  sendOrderConfirmation({
    to: orderData.email,
    firstName: orderData.firstName,
    orderId,
    currency: orderData.currency ?? "EUR",
    items: orderData.items.map((i) => ({
      name: i.name, size: i.size, colour: i.colour,
      quantity: i.quantity, unitPrice: i.price, image: i.image,
    })),
    subtotal: orderData.subtotal,
    shippingFee: orderData.shippingFee,
    discountAmount: orderData.discountAmount,
    total: orderData.total,
    paymentMethod: "Card (POK Pay)",
    shippingAddress: {
      firstName: orderData.firstName, lastName: orderData.lastName,
      line1: orderData.address, line2: orderData.address2 ?? null,
      city: orderData.city, postalCode: orderData.postalCode,
      country: orderData.country, phone: orderData.phone,
    },
  }).catch((err) => console.error("[resend] webhook recovery email failed:", err));

  console.log("[POK webhook] recovery order created:", orderId);
}
