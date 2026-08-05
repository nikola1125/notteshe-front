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

    // Stock floor guard: decrement only if sufficient stock remains
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
        throw new Error(
          `"${item.name}" size ${item.size} went out of stock before your order was finalised.`
        );
      }
    }

    const orderId = randomUUID();
    const shippingAddress = {
      firstName: orderData.firstName, lastName: orderData.lastName,
      line1: orderData.address, line2: orderData.address2 ?? null,
      city: orderData.city, postalCode: orderData.postalCode,
      country: orderData.country, phone: orderData.phone, email: orderData.email,
    };

    // Insert order — catch unique constraint if webhook raced the browser callback
    const orderValues = {
      id: orderId,
      userId,
      status: "PENDING" as const,
      subtotal: orderData.subtotal,
      shippingFee: orderData.shippingFee,
      discountCode: orderData.discountCode,
      discountAmount: orderData.discountAmount,
      total: orderData.total,
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
    }).catch((err) => console.error("[resend] order confirmation failed:", err));

    return { orderId };
  });
