import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PlaceOrderSchema = z.object({
  pokOrderId: z.string().min(1),
});

export const placeOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => PlaceOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { db } = await import("@/db");
    const {
      orders, orderItem, productSize,
      discountCode: discountCodeTable,
      pendingOrder, auditLog,
    } = await import("@/db/schema");
    const { eq, sql, and } = await import("drizzle-orm");
    const { randomUUID } = await import("node:crypto");

    const session = await requireAuth();
    const userId = session.user.id;

    // Idempotency: if this pokOrderId already has a confirmed order, return it
    const existing = await db()
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.pokOrderId, data.pokOrderId))
      .limit(1);
    if (existing[0]) return { orderId: existing[0].id };

    // Load pending order — authoritative source of truth for items, prices, and totals
    const [pending] = await db()
      .select()
      .from(pendingOrder)
      .where(eq(pendingOrder.pokOrderId, data.pokOrderId))
      .limit(1);

    if (!pending) {
      throw new Error(
        "Order session expired or not found. If your payment was taken, please contact hello@notteshe.com."
      );
    }

    // Ownership check: prevent one user from finalising another's order
    if (pending.userId !== userId) {
      throw new Error("Unauthorized.");
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
      currency?: "EUR" | "ALL"; pokAmount?: number;
    };
    const orderData = pending.orderData as OrderData;

    // Stock floor guard: decrement only if sufficient stock remains (skip digital gift card items)
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
        throw new Error(
          `"${item.name}" size ${item.size} went out of stock before your order was finalised.`
        );
      }
    }

    const isGiftCardOnlyOrder = orderData.items.every((i) => i.isGiftCard);
    const orderId = randomUUID();
    const shippingAddress = {
      firstName: orderData.firstName, lastName: orderData.lastName,
      line1: orderData.address, line2: orderData.address2 ?? null,
      city: orderData.city, postalCode: orderData.postalCode,
      country: orderData.country, phone: orderData.phone, email: orderData.email,
    };

    // ── Gift card redemption debit (atomic) ───────────────────────────────────
    // Debit must succeed before we create the order. If it fails, the payment was
    // processed but the gift card couldn't be debited — we still create the order
    // and log the error (the admin can adjust manually).
    const gcCode = orderData.giftCardCode ?? null;
    const gcAmountLek = orderData.giftCardAmountLek ?? 0;
    if (gcCode && gcAmountLek > 0) {
      const { atomicDebitGiftCard } = await import("@/lib/giftCard");
      try {
        await atomicDebitGiftCard(gcCode, gcAmountLek, orderId);
      } catch (err) {
        console.error("[placeOrder] gift card debit failed:", err);
        // Don't throw — payment already went through via POK. Log for manual review.
      }
    }

    // Insert order — catch unique constraint if webhook raced the browser callback
    const orderValues = {
      id: orderId,
      userId,
      status: (isGiftCardOnlyOrder ? "CONFIRMED" : "PENDING") as "CONFIRMED" | "PENDING",
      subtotal: orderData.subtotal,
      shippingFee: orderData.shippingFee,
      discountCode: orderData.discountCode,
      discountAmount: orderData.discountAmount,
      giftCardCode: gcCode,
      giftCardAmountLek: gcAmountLek,
      total: orderData.total,
      currency: orderData.currency ?? "EUR",
      pokAmount: orderData.pokAmount ?? null,
      shippingAddress,
      pokOrderId: data.pokOrderId,
    };

    try {
      await db().insert(orders).values({ ...orderValues, paymentFee: orderData.paymentFee ?? 0 });
    } catch (err) {
      const msg = String((err as Error)?.message ?? "");
      const isUniqueViolation = (err as { code?: string })?.code === "23505" || msg.toLowerCase().includes("unique");
      if (isUniqueViolation) {
        const [found] = await db().select({ id: orders.id }).from(orders).where(eq(orders.pokOrderId, data.pokOrderId)).limit(1);
        if (found) return { orderId: found.id };
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

    // ── Issue gift cards purchased in this order ────────────────────────────────
    const gcPurchases = orderData.items.filter((i) => i.isGiftCard);
    if (gcPurchases.length > 0) {
      const { issueGiftCard } = await import("@/lib/giftCard");
      for (const item of gcPurchases) {
        try {
          await issueGiftCard({
            amountLek: item.giftCardAmountLek ?? 0,
            purchaserUserId: userId,
            purchaserEmail: orderData.email,
            purchaserName: `${orderData.firstName}${orderData.lastName ? ` ${orderData.lastName}` : ""}`.trim(),
            recipientEmail: item.giftCardForSelf ? orderData.email : (item.giftCardRecipientEmail ?? orderData.email),
            recipientName: item.giftCardForSelf ? orderData.firstName : (item.giftCardRecipientName ?? orderData.firstName),
            message: item.giftCardMessage ?? null,
            forSelf: item.giftCardForSelf ?? true,
            sourceOrderId: orderId,
          });
        } catch (err) {
          console.error("[placeOrder] gift card issuance failed:", err);
        }
      }
    }

    // Increment discount code usage counter — atomic guard prevents over-redemption
    if (orderData.discountCode) {
      const updated = await db()
        .update(discountCodeTable)
        .set({ usedCount: sql`used_count + 1` })
        .where(
          and(
            eq(discountCodeTable.code, orderData.discountCode),
            sql`(max_uses IS NULL OR used_count < max_uses)`,
          )
        )
        .returning({ id: discountCodeTable.id });

      if (updated.length === 0) {
        // Code hit its limit between reservation and finalisation — order still goes through
        console.warn(`[placeOrder] discount code ${orderData.discountCode} exhausted at finalisation`);
      }
    }

    // Release the pending order reservation
    await db().delete(pendingOrder).where(eq(pendingOrder.pokOrderId, data.pokOrderId));

    // Audit log
    await db().insert(auditLog).values({
      id: randomUUID(),
      adminId: null,
      action: "payment.success",
      entityType: "payment",
      entityId: data.pokOrderId,
      diff: {
        after: {
          orderId,
          userId,
          email: orderData.email,
          total: orderData.total,
          itemCount: orderData.items.length,
        },
      },
    });

    // Notify connected admins — skip for gift card-only orders (digital, no fulfilment needed)
    if (!isGiftCardOnlyOrder) {
      const { notifyAdmins } = await import("@/lib/admin/sse");
      await notifyAdmins("new_order", { ref: orderId.slice(0, 8).toUpperCase(), total: orderData.total });
    }

    // Skip order confirmation email for gift card-only orders — recipient already gets the delivery email
    if (isGiftCardOnlyOrder) return { orderId };

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
    }).catch((err) => console.error("[resend] order confirmation failed:", err));

    return { orderId };
  });
