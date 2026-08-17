import "@nebula-ltd/pok-payments-js/lib/index.css";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef, Suspense, lazy } from "react";
import type { PayerAuthentication } from "@nebula-ltd/pok-payments-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useCart } from "@/store/cartStore";
import { useSession } from "@/lib/auth/client";
import { useAuthStore } from "@/store/authStore";
import { placeOrder } from "@/lib/orders";
import { createPokOrder } from "@/lib/pok";
import { useCurrency } from "@/store/currencyStore";
import { useRate } from "@/components/Price";
import { formatMoney } from "@/lib/currency";

const GuestCheckoutForm = lazy(() =>
  import("@nebula-ltd/pok-payments-js/react").then((m) => ({
    default: m.GuestCheckoutForm,
  }))
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedCardDisplay {
  id: string;
  pokCardId: string;
  brand: string | null;
  lastFour: string | null;
  label: string | null;
}

// ─── Server functions ─────────────────────────────────────────────────────────

const logPaymentFailure = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      pokOrderId: z.string(),
      errorType: z.string().optional(),
      errorMessage: z.string().optional(),
      email: z.string().optional(),
      amount: z.number().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { auditLog } = await import("@/db/schema");
    const { randomUUID } = await import("node:crypto");
    await db().insert(auditLog).values({
      id: randomUUID(),
      adminId: null,
      action: "payment.failure",
      entityType: "payment",
      entityId: data.pokOrderId,
      diff: { after: { errorType: data.errorType ?? "unknown", errorMessage: data.errorMessage ?? "—", email: data.email, amount: data.amount } },
    }).catch(() => {});
  });

const logPlaceOrderError = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      pokOrderId: z.string(),
      errorMessage: z.string().optional(),
      email: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { auditLog } = await import("@/db/schema");
    const { randomUUID } = await import("node:crypto");
    await db().insert(auditLog).values({
      id: randomUUID(),
      adminId: null,
      action: "payment.order_error",
      entityType: "payment",
      entityId: data.pokOrderId,
      diff: { after: { errorMessage: data.errorMessage ?? "—", email: data.email, note: "Payment confirmed by POK but DB write failed" } },
    }).catch(() => {});
  });

const CartItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  size: z.string(),
  colour: z.string(),
  quantity: z.number().int().positive(),
  image: z.string(),
  isGiftCard: z.boolean().optional(),
  giftCardAmountLek: z.number().optional(),
  giftCardRecipientEmail: z.string().optional(),
  giftCardRecipientName: z.string().optional(),
  giftCardMessage: z.string().optional(),
  giftCardForSelf: z.boolean().optional(),
});

const CodOrderSchema = z.object({
  currency: z.enum(["EUR", "ALL"]).default("EUR"),
  discountCode: z.string().optional(),
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
  items: z.array(CartItemSchema),
});

// Schema for zero-total orders (gift card covers the full amount, no payment gateway)
const ZeroTotalOrderSchema = z.object({
  currency: z.enum(["EUR", "ALL"]).default("EUR"),
  discountCode: z.string().optional(),
  giftCardCode: z.string(),
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
  items: z.array(CartItemSchema),
});

const placeCodOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => CodOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { db } = await import("@/db");
    const {
      orders, orderItem, productSize, product, shippingConfig,
      discountCode: discountCodeTable, auditLog,
    } = await import("@/db/schema");
    const { inArray, and, eq, sql } = await import("drizzle-orm");
    const { randomUUID } = await import("node:crypto");

    const session = await requireAuth();
    const userId = session.user.id;

    // Gift cards cannot be purchased with COD
    if (data.items.some((i) => i.isGiftCard)) {
      throw new Error("Gift card purchases require online (card) payment.");
    }

    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const [productRows, sizeRows] = await Promise.all([
      db().select({ id: product.id, price: product.price, originalPrice: product.originalPrice, isSale: product.isSale })
        .from(product).where(inArray(product.id, productIds)),
      db().select({ productId: productSize.productId, label: productSize.label, stock: productSize.stock })
        .from(productSize).where(inArray(productSize.productId, productIds)),
    ]);

    const priceMap = new Map(productRows.map((p) => [p.id, p]));
    const itemsWithPrices = data.items.map((item) => {
      const p = priceMap.get(item.productId);
      if (!p) throw new Error(`Product "${item.name}" is no longer available.`);
      return { ...item, price: p.price, originalPrice: p.isSale ? (p.originalPrice ?? null) : null };
    });

    for (const item of data.items) {
      const row = sizeRows.find((s) => s.productId === item.productId && s.label === item.size);
      if (!row || row.stock < item.quantity) {
        throw new Error(`"${item.name}" size ${item.size} is no longer available in the requested quantity.`);
      }
    }

    const subtotal = itemsWithPrices.reduce((s, i) => s + i.price * i.quantity, 0);
    const [cfg] = await db()
      .select({ enabled: shippingConfig.enabled, fee: shippingConfig.fee, freeThreshold: shippingConfig.freeThreshold })
      .from(shippingConfig).limit(1);
    const shippingFee = cfg?.enabled ? (subtotal >= (cfg.freeThreshold ?? 200) ? 0 : (cfg.fee ?? 12)) : 0;

    // EUR→Lek rate
    let eurToLekRate = 100;
    let lekRounding = 100;
    try {
      const [rc] = await db().select({ eurToLekRate: shippingConfig.eurToLekRate, lekRounding: shippingConfig.lekRounding }).from(shippingConfig).limit(1);
      if (rc) { eurToLekRate = rc.eurToLekRate ?? 100; lekRounding = rc.lekRounding ?? 100; }
    } catch { /* not migrated */ }

    let discountAmount = 0;
    let validatedDiscountCode: string | null = null;
    if (data.discountCode) {
      const [code] = await db().select().from(discountCodeTable)
        .where(eq(discountCodeTable.code, data.discountCode.toUpperCase().trim())).limit(1);
      const now = new Date();
      if (code && code.isActive && (!code.expiresAt || code.expiresAt > now) &&
          (code.maxUses === null || code.usedCount < code.maxUses) &&
          (code.minOrderAmount === null || subtotal >= code.minOrderAmount)) {
        const saleIds = new Set(productRows.filter((p) => p.isSale).map((p) => p.id));
        if (!data.items.some((i) => saleIds.has(i.productId))) {
          discountAmount = code.type === "PERCENT"
            ? Math.round(subtotal * (code.value / 100) * 100) / 100
            : Math.min(code.value, subtotal);
          validatedDiscountCode = code.code;
        }
      }
    }

    // Gift card redemption
    let gcAmountLek = 0;
    let validatedGiftCardCode: string | null = null;
    if (data.giftCardCode) {
      const { validateGiftCard } = await import("@/lib/giftCard");
      const amountDueEur = Math.max(0, subtotal + shippingFee - discountAmount);
      const gcResult = await validateGiftCard(data.giftCardCode, amountDueEur, eurToLekRate);
      if (!gcResult.valid) throw new Error(gcResult.error);
      validatedGiftCardCode = gcResult.code;
      gcAmountLek = gcResult.appliedLek;
    }
    const gcAppliedEur = gcAmountLek / eurToLekRate;

    const total = Math.max(0, subtotal + shippingFee - discountAmount - gcAppliedEur);
    const codCurrency = data.currency;
    const codCollect = codCurrency === "ALL"
      ? Math.round((total * eurToLekRate) / (lekRounding > 0 ? lekRounding : 1)) * (lekRounding > 0 ? lekRounding : 1)
      : Math.round(total * 100) / 100;

    for (const item of itemsWithPrices) {
      const updated = await db()
        .update(productSize)
        .set({ stock: sql`stock - ${item.quantity}` })
        .where(and(
          eq(productSize.productId, item.productId),
          eq(productSize.label, item.size),
          sql`stock >= ${item.quantity}`,
        ))
        .returning({ id: productSize.id });
      if (updated.length === 0) {
        throw new Error(`"${item.name}" size ${item.size} went out of stock before your order was finalised.`);
      }
    }

    // Atomically debit gift card now that stock is reserved
    if (validatedGiftCardCode && gcAmountLek > 0) {
      const orderId = randomUUID(); // pre-generate so we can pass it to the debit
      const { atomicDebitGiftCard } = await import("@/lib/giftCard");
      try {
        await atomicDebitGiftCard(validatedGiftCardCode, gcAmountLek, orderId);
      } catch (err) {
        // Roll back stock? We can't in neon-http without transactions. Log for manual review.
        console.error("[placeCodOrder] gift card debit failed:", err);
        throw new Error("Gift card could not be applied. Please try again or remove the gift card.");
      }

      const shippingAddress = {
        firstName: data.shippingForm.firstName, lastName: data.shippingForm.lastName,
        line1: data.shippingForm.address, line2: data.shippingForm.address2 ?? null,
        city: data.shippingForm.city, postalCode: data.shippingForm.postalCode,
        country: data.shippingForm.country, phone: data.shippingForm.phone, email: data.shippingForm.email,
      };

      await db().insert(orders).values({
        id: orderId,
        userId,
        status: "PENDING" as const,
        subtotal,
        shippingFee,
        paymentFee: 0,
        discountCode: validatedDiscountCode,
        discountAmount,
        giftCardCode: validatedGiftCardCode,
        giftCardAmountLek: gcAmountLek,
        total,
        currency: codCurrency,
        pokAmount: codCollect,
        shippingAddress,
        pokOrderId: null,
      });

      await db().insert(orderItem).values(
        itemsWithPrices.map((item) => ({
          id: randomUUID(), orderId, productId: item.productId,
          productSnapshot: { name: item.name, image: item.image, price: item.price, originalPrice: item.originalPrice },
          size: item.size, colour: item.colour, quantity: item.quantity, unitPrice: item.price,
        }))
      );

      if (validatedDiscountCode) {
        await db().update(discountCodeTable).set({ usedCount: sql`used_count + 1` })
          .where(and(eq(discountCodeTable.code, validatedDiscountCode), sql`(max_uses IS NULL OR used_count < max_uses)`)).catch(() => {});
      }

      await db().insert(auditLog).values({ id: randomUUID(), adminId: null, action: "payment.success", entityType: "order", entityId: orderId, diff: { after: { orderId, userId, email: data.shippingForm.email, total, itemCount: data.items.length, method: "cod+giftcard" } } });
      const { notifyAdmins } = await import("@/lib/admin/sse");
      await notifyAdmins("new_order", { ref: orderId.slice(0, 8).toUpperCase(), total });
      const { sendOrderConfirmation } = await import("@/lib/resend");
      sendOrderConfirmation({ to: data.shippingForm.email, firstName: data.shippingForm.firstName, orderId, currency: codCurrency, items: itemsWithPrices.map((i) => ({ name: i.name, size: i.size, colour: i.colour, quantity: i.quantity, unitPrice: i.price, image: i.image })), subtotal, shippingFee, discountAmount, total, paymentMethod: "Cash on Delivery + Gift Card", shippingAddress: { firstName: data.shippingForm.firstName, lastName: data.shippingForm.lastName, line1: data.shippingForm.address, line2: data.shippingForm.address2 ?? null, city: data.shippingForm.city, postalCode: data.shippingForm.postalCode, country: data.shippingForm.country, phone: data.shippingForm.phone } }).catch((err) => console.error("[resend] COD+GC confirmation failed:", err));
      return { orderId };
    }

    // Normal COD (no gift card)
    const orderId = randomUUID();
    const shippingAddress = {
      firstName: data.shippingForm.firstName, lastName: data.shippingForm.lastName,
      line1: data.shippingForm.address, line2: data.shippingForm.address2 ?? null,
      city: data.shippingForm.city, postalCode: data.shippingForm.postalCode,
      country: data.shippingForm.country, phone: data.shippingForm.phone, email: data.shippingForm.email,
    };

    await db().insert(orders).values({
      id: orderId,
      userId,
      status: "PENDING" as const,
      subtotal,
      shippingFee,
      paymentFee: 0,
      discountCode: validatedDiscountCode,
      discountAmount,
      giftCardCode: null,
      giftCardAmountLek: 0,
      total,
      currency: codCurrency,
      pokAmount: codCollect,
      shippingAddress,
      pokOrderId: null,
    });

    await db().insert(orderItem).values(
      itemsWithPrices.map((item) => ({
        id: randomUUID(),
        orderId,
        productId: item.productId,
        productSnapshot: { name: item.name, image: item.image, price: item.price, originalPrice: item.originalPrice },
        size: item.size,
        colour: item.colour,
        quantity: item.quantity,
        unitPrice: item.price,
      }))
    );

    if (validatedDiscountCode) {
      await db()
        .update(discountCodeTable)
        .set({ usedCount: sql`used_count + 1` })
        .where(and(
          eq(discountCodeTable.code, validatedDiscountCode),
          sql`(max_uses IS NULL OR used_count < max_uses)`,
        ))
        .catch(() => {});
    }

    await db().insert(auditLog).values({
      id: randomUUID(),
      adminId: null,
      action: "payment.success",
      entityType: "order",
      entityId: orderId,
      diff: { after: { orderId, userId, email: data.shippingForm.email, total, itemCount: data.items.length, method: "cod" } },
    });

    const { notifyAdmins } = await import("@/lib/admin/sse");
    await notifyAdmins("new_order", { ref: orderId.slice(0, 8).toUpperCase(), total });

    const { sendOrderConfirmation } = await import("@/lib/resend");
    sendOrderConfirmation({
      to: data.shippingForm.email,
      firstName: data.shippingForm.firstName,
      orderId,
      currency: codCurrency,
      items: itemsWithPrices.map((i) => ({ name: i.name, size: i.size, colour: i.colour, quantity: i.quantity, unitPrice: i.price, image: i.image })),
      subtotal,
      shippingFee,
      discountAmount,
      total,
      paymentMethod: "Cash on Delivery",
      shippingAddress: {
        firstName: data.shippingForm.firstName, lastName: data.shippingForm.lastName,
        line1: data.shippingForm.address, line2: data.shippingForm.address2 ?? null,
        city: data.shippingForm.city, postalCode: data.shippingForm.postalCode,
        country: data.shippingForm.country, phone: data.shippingForm.phone,
      },
    }).catch((err) => console.error("[resend] COD confirmation failed:", err));

    return { orderId };
  });

const applyGiftCard = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ code: z.string(), amountDueEur: z.number() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { shippingConfig } = await import("@/db/schema");
    const { validateGiftCard } = await import("@/lib/giftCard");

    let eurToLekRate = 100;
    try {
      const [cfg] = await db().select({ eurToLekRate: shippingConfig.eurToLekRate }).from(shippingConfig).limit(1);
      if (cfg) eurToLekRate = cfg.eurToLekRate ?? 100;
    } catch { /* not migrated */ }

    const result = await validateGiftCard(data.code, data.amountDueEur, eurToLekRate);
    return result;
  });

const placeZeroTotalOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => ZeroTotalOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { db } = await import("@/db");
    const {
      orders, orderItem, productSize, product, shippingConfig,
      discountCode: discountCodeTable, auditLog,
    } = await import("@/db/schema");
    const { inArray, and, eq, sql } = await import("drizzle-orm");
    const { randomUUID } = await import("node:crypto");

    const session = await requireAuth();
    const userId = session.user.id;

    // Gift cards cannot be purchased via zero-total path (no-gc-on-gc)
    if (data.items.some((i) => i.isGiftCard)) {
      throw new Error("Gift card purchases require card payment — gift cards cannot be used to buy gift cards.");
    }

    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const [productRows, sizeRows] = await Promise.all([
      db().select({ id: product.id, price: product.price, originalPrice: product.originalPrice, isSale: product.isSale })
        .from(product).where(inArray(product.id, productIds)),
      db().select({ productId: productSize.productId, label: productSize.label, stock: productSize.stock })
        .from(productSize).where(inArray(productSize.productId, productIds)),
    ]);

    const priceMap = new Map(productRows.map((p) => [p.id, p]));
    const itemsWithPrices = data.items.map((item) => {
      const p = priceMap.get(item.productId);
      if (!p) throw new Error(`Product "${item.name}" is no longer available.`);
      return { ...item, price: p.price, originalPrice: p.isSale ? (p.originalPrice ?? null) : null };
    });

    for (const item of data.items) {
      const row = sizeRows.find((s) => s.productId === item.productId && s.label === item.size);
      if (!row || row.stock < item.quantity) {
        throw new Error(`"${item.name}" size ${item.size} is no longer available.`);
      }
    }

    const subtotal = itemsWithPrices.reduce((s, i) => s + i.price * i.quantity, 0);
    const [cfg] = await db()
      .select({ enabled: shippingConfig.enabled, fee: shippingConfig.fee, freeThreshold: shippingConfig.freeThreshold })
      .from(shippingConfig).limit(1);
    const shippingFee = cfg?.enabled ? (subtotal >= (cfg.freeThreshold ?? 200) ? 0 : (cfg.fee ?? 12)) : 0;

    let eurToLekRate = 100;
    let lekRounding = 100;
    try {
      const [rc] = await db().select({ eurToLekRate: shippingConfig.eurToLekRate, lekRounding: shippingConfig.lekRounding }).from(shippingConfig).limit(1);
      if (rc) { eurToLekRate = rc.eurToLekRate ?? 100; lekRounding = rc.lekRounding ?? 100; }
    } catch { /* not migrated */ }

    let discountAmount = 0;
    let validatedDiscountCode: string | null = null;
    if (data.discountCode) {
      const [code] = await db().select().from(discountCodeTable)
        .where(eq(discountCodeTable.code, data.discountCode.toUpperCase().trim())).limit(1);
      const now = new Date();
      if (code && code.isActive && (!code.expiresAt || code.expiresAt > now) &&
          (code.maxUses === null || code.usedCount < code.maxUses) &&
          (code.minOrderAmount === null || subtotal >= code.minOrderAmount)) {
        const saleIds = new Set(productRows.filter((p) => p.isSale).map((p) => p.id));
        if (!data.items.some((i) => saleIds.has(i.productId))) {
          discountAmount = code.type === "PERCENT"
            ? Math.round(subtotal * (code.value / 100) * 100) / 100
            : Math.min(code.value, subtotal);
          validatedDiscountCode = code.code;
        }
      }
    }

    const amountDueEur = Math.max(0, subtotal + shippingFee - discountAmount);

    // Validate gift card
    const { validateGiftCard, atomicDebitGiftCard } = await import("@/lib/giftCard");
    const gcResult = await validateGiftCard(data.giftCardCode, amountDueEur, eurToLekRate);
    if (!gcResult.valid) throw new Error(gcResult.error);
    if (gcResult.appliedEur < amountDueEur - 0.01) {
      // Gift card doesn't cover the full amount — can't use zero-total path
      throw new Error("Gift card balance is insufficient to cover the full order.");
    }

    const gcAmountLek = gcResult.appliedLek;
    const total = 0; // covered by gift card

    // Decrement stock first
    const orderId = randomUUID();
    for (const item of itemsWithPrices) {
      const updated = await db()
        .update(productSize)
        .set({ stock: sql`stock - ${item.quantity}` })
        .where(and(
          eq(productSize.productId, item.productId),
          eq(productSize.label, item.size),
          sql`stock >= ${item.quantity}`,
        ))
        .returning({ id: productSize.id });
      if (updated.length === 0) {
        throw new Error(`"${item.name}" size ${item.size} went out of stock before your order was finalised.`);
      }
    }

    // Atomic gift card debit — must succeed before creating the order
    await atomicDebitGiftCard(gcResult.code, gcAmountLek, orderId);

    const shippingAddress = {
      firstName: data.shippingForm.firstName, lastName: data.shippingForm.lastName,
      line1: data.shippingForm.address, line2: data.shippingForm.address2 ?? null,
      city: data.shippingForm.city, postalCode: data.shippingForm.postalCode,
      country: data.shippingForm.country, phone: data.shippingForm.phone, email: data.shippingForm.email,
    };

    await db().insert(orders).values({
      id: orderId,
      userId,
      status: "PENDING" as const,  // paid by gift card — still needs admin to confirm & ship
      subtotal,
      shippingFee,
      paymentFee: 0,
      discountCode: validatedDiscountCode,
      discountAmount,
      giftCardCode: gcResult.code,
      giftCardAmountLek: gcAmountLek,
      total,
      currency: data.currency,
      pokAmount: 0,
      shippingAddress,
      pokOrderId: null,
    });

    await db().insert(orderItem).values(
      itemsWithPrices.map((item) => ({
        id: randomUUID(), orderId,
        productId: item.productId,
        productSnapshot: { name: item.name, image: item.image, price: item.price, originalPrice: item.originalPrice },
        size: item.size, colour: item.colour, quantity: item.quantity, unitPrice: item.price,
      }))
    );

    if (validatedDiscountCode) {
      await db().update(discountCodeTable).set({ usedCount: sql`used_count + 1` })
        .where(and(eq(discountCodeTable.code, validatedDiscountCode), sql`(max_uses IS NULL OR used_count < max_uses)`)).catch(() => {});
    }

    await db().insert(auditLog).values({ id: randomUUID(), adminId: null, action: "payment.success", entityType: "order", entityId: orderId, diff: { after: { orderId, userId, email: data.shippingForm.email, total, itemCount: data.items.length, method: "gift_card_full" } } });
    const { notifyAdmins } = await import("@/lib/admin/sse");
    await notifyAdmins("new_order", { ref: orderId.slice(0, 8).toUpperCase(), total: subtotal });

    const codCurrency = data.currency;
    const { sendOrderConfirmation } = await import("@/lib/resend");
    sendOrderConfirmation({
      to: data.shippingForm.email, firstName: data.shippingForm.firstName, orderId, currency: codCurrency,
      items: itemsWithPrices.map((i) => ({ name: i.name, size: i.size, colour: i.colour, quantity: i.quantity, unitPrice: i.price, image: i.image })),
      subtotal, shippingFee, discountAmount, total,
      paymentMethod: "Gift Card",
      shippingAddress: { firstName: data.shippingForm.firstName, lastName: data.shippingForm.lastName, line1: data.shippingForm.address, line2: data.shippingForm.address2 ?? null, city: data.shippingForm.city, postalCode: data.shippingForm.postalCode, country: data.shippingForm.country, phone: data.shippingForm.phone },
    }).catch((err) => console.error("[resend] zero-total confirmation failed:", err));

    return { orderId };
  });

const applyDiscountCode = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      code: z.string(),
      subtotal: z.number(),
      items: z.array(z.object({ productId: z.string(), price: z.number(), quantity: z.number() })),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { discountCode, product } = await import("@/db/schema");
    const { eq, inArray } = await import("drizzle-orm");

    const rows = await db().select().from(discountCode)
      .where(eq(discountCode.code, data.code.toUpperCase().trim())).limit(1);

    const code = rows[0];
    if (!code) return { valid: false as const, error: "Invalid or expired code" };
    if (!code.isActive) return { valid: false as const, error: "This code is no longer active" };
    if (code.expiresAt && code.expiresAt < new Date()) return { valid: false as const, error: "This code has expired" };
    if (code.maxUses !== null && code.usedCount >= code.maxUses) return { valid: false as const, error: "This code has reached its usage limit" };
    if (code.minOrderAmount !== null && data.subtotal < code.minOrderAmount) return { valid: false as const, error: `Minimum order of ${code.minOrderAmount} € required` };

    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const productRows = await db().select({ id: product.id, isSale: product.isSale })
      .from(product).where(inArray(product.id, productIds));
    const saleProductIds = new Set(productRows.filter((p) => p.isSale).map((p) => p.id));

    if (data.items.some((i) => saleProductIds.has(i.productId)))
      return { valid: false as const, error: "Discount codes cannot be applied to sale items" };

    const discountAmount = code.type === "PERCENT"
      ? Math.round(data.subtotal * (code.value / 100) * 100) / 100
      : Math.min(code.value, data.subtotal);

    return { valid: true as const, code: code.code, type: code.type, value: code.value, discountAmount };
  });

const getShipping = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("@/db");
  const { shippingConfig } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const database = db();

  const rows = await database
    .select({ enabled: shippingConfig.enabled, fee: shippingConfig.fee, freeThreshold: shippingConfig.freeThreshold })
    .from(shippingConfig).where(eq(shippingConfig.id, "default")).limit(1);

  const base = rows[0]
    ? { enabled: rows[0].enabled, fee: rows[0].fee, freeThreshold: rows[0].freeThreshold }
    : { enabled: true, fee: 12, freeThreshold: 200 };

  let paymentFeeEnabled = false;
  let paymentFeePercent = 0;
  let paymentFeeFixed = 0;
  try {
    const pf = await database
      .select({ paymentFeeEnabled: shippingConfig.paymentFeeEnabled, paymentFeePercent: shippingConfig.paymentFeePercent, paymentFeeFixed: shippingConfig.paymentFeeFixed })
      .from(shippingConfig).where(eq(shippingConfig.id, "default")).limit(1);
    paymentFeeEnabled = pf[0]?.paymentFeeEnabled ?? false;
    paymentFeePercent = pf[0]?.paymentFeePercent ?? 0;
    paymentFeeFixed = pf[0]?.paymentFeeFixed ?? 0;
  } catch { /* columns not yet migrated */ }

  return { ...base, paymentFeeEnabled, paymentFeePercent, paymentFeeFixed };
});

const getCartPrices = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ productIds: z.array(z.string()) }).parse(d))
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { product } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");
    if (data.productIds.length === 0) return [];
    const products = await db()
      .select({ id: product.id, price: product.price, originalPrice: product.originalPrice, isSale: product.isSale })
      .from(product).where(inArray(product.id, data.productIds));
    return products.map((p) => ({ id: p.id, price: p.price ?? 0, originalPrice: p.isSale ? p.originalPrice : null }));
  });

const getSavedCards = createServerFn({ method: "GET" }).handler(async (): Promise<SavedCardDisplay[]> => {
  const { requireAuth } = await import("@/lib/auth/session");
  const { db } = await import("@/db");
  const { savedCard } = await import("@/db/schema");
  const { eq, desc } = await import("drizzle-orm");

  const session = await requireAuth();
  const rows = await db()
    .select()
    .from(savedCard)
    .where(eq(savedCard.userId, session.user.id))
    .orderBy(desc(savedCard.createdAt));

  return rows.map((r) => ({
    id: r.id,
    pokCardId: r.pokCardId,
    brand: r.brand,
    lastFour: r.lastFour,
    label: r.label,
  }));
});

const setupSavedCard = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ pokOrderId: z.string(), savedCardDbId: z.string() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { db } = await import("@/db");
    const { savedCard } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");
    const { pokSetupTokenized3ds } = await import("@/lib/pok");

    const session = await requireAuth();

    // Verify the card belongs to the current user
    const [card] = await db()
      .select()
      .from(savedCard)
      .where(and(eq(savedCard.id, data.savedCardDbId), eq(savedCard.userId, session.user.id)))
      .limit(1);

    if (!card) throw new Error("Saved card not found.");

    const setup = await pokSetupTokenized3ds(card.pokCardId, data.pokOrderId);

    return {
      payerAuthSetupReferenceId: setup.payerAuthSetupReferenceId,
      deviceDataCollection: setup.deviceDataCollection ?? null,
      pokCardId: setup.creditDebitCardId,
    };
  });

const confirmSavedCardPayment = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ pokOrderId: z.string(), pokCardId: z.string() }).parse(d)
  )
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { pokGuestConfirm } = await import("@/lib/pok");
    await requireAuth();
    await pokGuestConfirm(data.pokOrderId, data.pokCardId);
    return { success: true };
  });

const deleteSavedCard = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ savedCardDbId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { db } = await import("@/db");
    const { savedCard } = await import("@/db/schema");
    const { and, eq } = await import("drizzle-orm");

    const session = await requireAuth();
    await db()
      .delete(savedCard)
      .where(and(eq(savedCard.id, data.savedCardDbId), eq(savedCard.userId, session.user.id)));
    return { success: true };
  });

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/checkout")({
  loader: async () => {
    const [shippingData, savedCardsData] = await Promise.all([
      getShipping(),
      getSavedCards().catch(() => [] as SavedCardDisplay[]),
    ]);
    return { ...shippingData, savedCards: savedCardsData };
  },
  component: CheckoutPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShippingForm {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  address2: string;
  city: string;
  postalCode: string;
  country: string;
}

const EMPTY_FORM: ShippingForm = {
  email: "", phone: "", firstName: "", lastName: "",
  address: "", address2: "", city: "", postalCode: "", country: "",
};

type PaymentMethod = "cod" | "new-card" | "saved-card";
type CheckoutStep = "details" | "initiating" | "card-payment" | "saved-card-payment";

const POK_ENV = (typeof import.meta !== "undefined" && import.meta.env?.VITE_POK_ENV as "production" | "staging") || "staging";

// crypto.randomUUID() only works in secure contexts (HTTPS / localhost). Over a
// plain http:// LAN IP (mobile testing) it's undefined — fall back to a valid v4.
function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch { /* insecure context */ }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

function CheckoutPage() {
  const { items, addItem, removeItem, updateQuantity, clearCart } = useCart();
  const { data: session, isPending: sessionLoading } = useSession();
  const { openAuthModal } = useAuthStore();
  const loaderData = Route.useLoaderData();
  const shippingCfg = loaderData;
  const savedCards: SavedCardDisplay[] = loaderData.savedCards ?? [];
  const navigate = useNavigate();

  const hasSavedCards = savedCards.length > 0;

  const currency = useCurrency();
  const rate = useRate();
  const [step, setStep] = useState<CheckoutStep>("details");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    hasSavedCards ? "saved-card" : "cod"
  );
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(
    savedCards[0]?.id ?? null
  );
  const [pokOrderId, setPokOrderId] = useState<string | null>(null);
  const [payerAuth, setPayerAuth] = useState<PayerAuthentication | null>(null);
  const [mounted, setMounted] = useState(false);

  const [form, setForm] = useState<ShippingForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<ShippingForm>>({});
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const successFiredRef = useRef(false);
  const initiatingRef = useRef(false);

  const [couponInput, setCouponInput] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string; type: string; value: number; discountAmount: number;
  } | null>(null);

  const [giftCardInput, setGiftCardInput] = useState("");
  const [giftCardApplying, setGiftCardApplying] = useState(false);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<{
    code: string; balanceLek: number; appliedLek: number; appliedEur: number;
  } | null>(null);

  const [priceWarning, setPriceWarning] = useState(false);

  // Save-card-prompt state (shown after a new card payment succeeds)

  // Saved cards list (mutable — can add/delete without re-loading)
  const [localSavedCards, setLocalSavedCards] = useState<SavedCardDisplay[]>(savedCards);

  useEffect(() => setMounted(true), []);

  // Sync price changes from server
  useEffect(() => {
    if (items.length === 0) return;
    const ids = [...new Set(items.map((i) => i.productId))];
    getCartPrices({ data: { productIds: ids } }).then((fresh) => {
      let changed = false;
      for (const item of items) {
        const live = fresh.find((p) => p.id === item.productId);
        if (!live) continue;
        if (live.price !== item.price || live.originalPrice !== item.originalPrice) {
          changed = true;
          removeItem(item.id);
          addItem({ productId: item.productId, name: item.name, price: live.price, originalPrice: live.originalPrice, image: item.image, size: item.size, colour: item.colour, stock: item.stock });
          if (item.quantity > 1) {
            const newId = `${item.productId}-${item.size}-${item.colour}`;
            updateQuantity(newId, item.quantity - 1);
          }
        }
      }
      if (changed) setPriceWarning(true);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill form from session
  useEffect(() => {
    if (!session?.user) return;
    const fullName = session.user.name ?? "";
    const spaceIdx = fullName.indexOf(" ");
    const firstName = spaceIdx > -1 ? fullName.slice(0, spaceIdx) : fullName;
    const lastName = spaceIdx > -1 ? fullName.slice(spaceIdx + 1) : "";
    setForm((f) => ({
      ...f,
      email: f.email || session.user.email || "",
      firstName: f.firstName || firstName,
      lastName: f.lastName || lastName,
    }));
  }, [session?.user?.id]);

  // Mount setUpCardTokenPayment SDK when we enter saved-card-payment step
  useEffect(() => {
    if (step !== "saved-card-payment" || !payerAuth || !pokOrderId || !mounted) return;

    let cancelled = false;

    import("@nebula-ltd/pok-payments-js").then(({ setUpCardTokenPayment }) => {
      if (cancelled) return;
      setUpCardTokenPayment({
        containerId: "pok-saved-card-container",
        orderId: pokOrderId,
        payerAuthentication: payerAuth,
        env: POK_ENV,
        onSuccess: handleSavedCardPokSuccess,
        onError: handlePokError,
      });
    }).catch(() => {});

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, payerAuth, pokOrderId, mounted]);

  const hasGiftCardInCart = items.some((i) => i.isGiftCard);
  const regularItems = items.filter((i) => !i.isGiftCard);
  const regularSubtotal = regularItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  // No shipping if cart is only gift cards (digital items)
  const shipping = hasGiftCardInCart && regularItems.length === 0 ? 0
    : !shippingCfg.enabled ? 0
    : regularSubtotal >= shippingCfg.freeThreshold ? 0
    : shippingCfg.fee;
  const discount = appliedDiscount?.discountAmount ?? 0;
  const gcApplied = appliedGiftCard?.appliedEur ?? 0;
  const paymentFee = (paymentMethod === "new-card" || paymentMethod === "saved-card") && shippingCfg.paymentFeeEnabled
    ? Math.round(((subtotal + shipping - discount) * (shippingCfg.paymentFeePercent / 100) + shippingCfg.paymentFeeFixed) * 100) / 100
    : 0;
  const amountDue = Math.max(0, subtotal + shipping - discount + paymentFee);
  const total = Math.max(0, amountDue - gcApplied);
  const isZeroTotal = total === 0 && appliedGiftCard !== null;

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponApplying(true);
    setCouponError(null);
    try {
      const result = await applyDiscountCode({
        data: { code, subtotal, items: items.map((i) => ({ productId: i.productId, price: i.price, quantity: i.quantity })) },
      });
      if (result.valid) { setAppliedDiscount(result); setCouponInput(""); }
      else setCouponError(result.error);
    } catch {
      setCouponError("Something went wrong. Try again.");
    } finally {
      setCouponApplying(false);
    }
  }

  async function handleApplyGiftCard() {
    const code = giftCardInput.trim().toUpperCase();
    if (!code) return;
    setGiftCardApplying(true);
    setGiftCardError(null);
    try {
      const result = await applyGiftCard({ data: { code, amountDueEur: amountDue } });
      if (result.valid) {
        setAppliedGiftCard({ code: result.code, balanceLek: result.balanceLek, appliedLek: result.appliedLek, appliedEur: result.appliedEur });
        setGiftCardInput("");
      } else {
        setGiftCardError(result.error);
      }
    } catch {
      setGiftCardError("Something went wrong. Try again.");
    } finally {
      setGiftCardApplying(false);
    }
  }

  function set(field: keyof ShippingForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateShipping(): boolean {
    const required: (keyof ShippingForm)[] = ["email", "phone", "firstName", "lastName", "address", "city", "postalCode", "country"];
    const next: Partial<ShippingForm> = {};
    for (const k of required) {
      if (!form[k].trim()) next[k] = "Required";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildOrderItems() {
    return items.map((i) => ({
      productId: i.productId,
      name: i.name,
      size: i.size,
      colour: i.colour,
      quantity: i.quantity,
      image: i.image,
      ...(i.isGiftCard ? {
        isGiftCard: true,
        giftCardAmountLek: i.giftCardAmountLek,
        giftCardRecipientEmail: i.giftCardRecipientEmail,
        giftCardRecipientName: i.giftCardRecipientName,
        giftCardMessage: i.giftCardMessage,
        giftCardForSelf: i.giftCardForSelf,
      } : {}),
    }));
  }

  function buildShippingForm() {
    return {
      email: form.email, phone: form.phone,
      firstName: form.firstName, lastName: form.lastName,
      address: form.address, address2: form.address2 || undefined,
      city: form.city, postalCode: form.postalCode, country: form.country,
    };
  }

  // ── Zero-total path (gift card covers everything) ─────────────────────────────

  const handlePlaceZeroTotalOrder = useCallback(async () => {
    if (initiatingRef.current) return;
    if (!validateShipping()) return;
    if (!appliedGiftCard) return;
    initiatingRef.current = true;
    setPlacing(true);
    setPlaceError(null);
    try {
      await placeZeroTotalOrder({
        data: {
          currency,
          discountCode: appliedDiscount?.code,
          giftCardCode: appliedGiftCard.code,
          shippingForm: buildShippingForm(),
          items: buildOrderItems(),
        },
      });
      clearCart();
      void navigate({ to: "/order-confirmed" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : null;
      setPlaceError(msg ?? "Could not place your order. Please try again.");
    } finally {
      setPlacing(false);
      initiatingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, items, appliedDiscount, appliedGiftCard]);

  // ── COD path ──────────────────────────────────────────────────────────────────

  const handlePlaceCodOrder = useCallback(async () => {
    if (initiatingRef.current) return;
    if (!validateShipping()) return;
    initiatingRef.current = true;
    setPlacing(true);
    setPlaceError(null);
    try {
      await placeCodOrder({
        data: {
          currency,
          discountCode: appliedDiscount?.code,
          giftCardCode: appliedGiftCard?.code,
          shippingForm: buildShippingForm(),
          items: buildOrderItems(),
        },
      });
      clearCart();
      void navigate({ to: "/order-confirmed" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : null;
      setPlaceError(msg ?? "Could not place your order. Please try again.");
    } finally {
      setPlacing(false);
      initiatingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, items, appliedDiscount, appliedGiftCard]);

  // ── New card path ─────────────────────────────────────────────────────────────

  const handleInitiateCardPayment = useCallback(async () => {
    if (initiatingRef.current) return;
    if (!validateShipping()) return;
    initiatingRef.current = true;
    successFiredRef.current = false;
    setStep("initiating");
    setPlaceError(null);
    try {
      const ref = safeUUID();
      const { pokOrderId: id } = await createPokOrder({
        data: {
          merchantReference: ref,
          currency,
          discountCode: appliedDiscount?.code,
          giftCardCode: appliedGiftCard?.code,
          shippingForm: buildShippingForm(),
          items: buildOrderItems(),
        },
      });
      setPokOrderId(id);
      setStep("card-payment");
    } catch (err) {
      const msg = err instanceof Error ? err.message : null;
      setPlaceError(msg ?? "Could not connect to payment provider. Please try again.");
      setStep("details");
    } finally {
      initiatingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, items, appliedDiscount, appliedGiftCard]);

  const handlePokSuccess = useCallback(async () => {
    if (successFiredRef.current) return;
    successFiredRef.current = true;
    setPlacing(true);
    setPlaceError(null);
    try {
      await placeOrder({ data: { pokOrderId: pokOrderId! } });
      clearCart();
      void navigate({ to: "/order-confirmed" });
    } catch (err) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        (err instanceof Error ? err.message : null);
      logPlaceOrderError({ data: { pokOrderId: pokOrderId!, errorMessage: msg ?? undefined, email: form.email } }).catch(() => {});
      setPlaceError(
        `Your payment was processed but we couldn't record the order${msg ? `: ${msg}` : "."}  Please contact hello@notteshe.com immediately.`
      );
    } finally {
      setPlacing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokOrderId, form.email]);

  // ── Saved card path ───────────────────────────────────────────────────────────

  const handleInitiateSavedCardPayment = useCallback(async () => {
    if (initiatingRef.current) return;
    if (!validateShipping()) return;
    if (!selectedSavedCardId) return;
    initiatingRef.current = true;
    successFiredRef.current = false;
    setStep("initiating");
    setPlaceError(null);
    try {
      const ref = safeUUID();
      const { pokOrderId: id } = await createPokOrder({
        data: {
          merchantReference: ref,
          currency,
          discountCode: appliedDiscount?.code,
          giftCardCode: appliedGiftCard?.code,
          shippingForm: buildShippingForm(),
          items: buildOrderItems(),
        },
      });
      setPokOrderId(id);

      const setup = await setupSavedCard({ data: { pokOrderId: id, savedCardDbId: selectedSavedCardId } });

      setPayerAuth({
        deviceDataCollection: setup.deviceDataCollection ?? undefined,
        creditDebitCard: { id: setup.pokCardId },
        payerAuthSetupReferenceId: setup.payerAuthSetupReferenceId,
      });
      setStep("saved-card-payment");
    } catch (err) {
      const msg = err instanceof Error ? err.message : null;
      setPlaceError(msg ?? "Could not set up saved card payment. Please try again.");
      setStep("details");
    } finally {
      initiatingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, items, appliedDiscount, appliedGiftCard, selectedSavedCardId]);

  const handleSavedCardPokSuccess = useCallback(async () => {
    if (successFiredRef.current) return;
    successFiredRef.current = true;
    setPlacing(true);
    setPlaceError(null);
    try {
      const card = localSavedCards.find((c) => c.id === selectedSavedCardId);
      if (!card) throw new Error("Saved card not found.");
      await confirmSavedCardPayment({ data: { pokOrderId: pokOrderId!, pokCardId: card.pokCardId } });
      await placeOrder({ data: { pokOrderId: pokOrderId! } });
      clearCart();
      void navigate({ to: "/order-confirmed" });
    } catch (err) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        (err instanceof Error ? err.message : null);
      logPlaceOrderError({ data: { pokOrderId: pokOrderId!, errorMessage: msg ?? undefined, email: form.email } }).catch(() => {});
      setPlaceError(
        `Your payment was processed but we couldn't record the order${msg ? `: ${msg}` : "."}  Please contact hello@notteshe.com immediately.`
      );
    } finally {
      setPlacing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokOrderId, selectedSavedCardId, localSavedCards, form.email, clearCart, navigate]);

  // ── Shared error handler ──────────────────────────────────────────────────────

  const handlePokError = useCallback((err: { type?: string; message?: string }) => {
    if (pokOrderId) {
      logPaymentFailure({ data: { pokOrderId, errorType: err.type ?? "unknown", errorMessage: err.message ?? "—", email: form.email, amount: total } }).catch(() => {});
    }
    setPlaceError(err.message ?? "Payment was not completed. Please try again.");
    setStep("details");
    setPokOrderId(null);
    setPayerAuth(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pokOrderId, form.email, total]);

  // ── Shared reset ──────────────────────────────────────────────────────────────

  function handleChangePaymentMethod() {
    setStep("details");
    setPokOrderId(null);
    setPayerAuth(null);
    setPlaceError(null);
    successFiredRef.current = false;
  }

  async function handleDeleteSavedCard(id: string) {
    await deleteSavedCard({ data: { savedCardDbId: id } }).catch(() => {});
    const next = localSavedCards.filter((c) => c.id !== id);
    setLocalSavedCards(next);
    if (selectedSavedCardId === id) {
      setSelectedSavedCardId(next[0]?.id ?? null);
      if (next.length === 0) setPaymentMethod("cod");
    }
  }

  // ─── Guards ──────────────────────────────────────────────────────────────────

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (!session?.user && items.length > 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-5 text-center">
        <p className="serif text-3xl text-ink">Sign in to continue.</p>
        <p className="font-mono text-[11px] text-muted-foreground">You need an account to place an order.</p>
        <button
          onClick={() => openAuthModal("login")}
          className="bg-foreground px-8 py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:opacity-80"
        >
          Sign in / Create account
        </button>
        <Link to="/shop" search={{ sale: undefined }} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink">
          ← Back to shop
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-5 text-center">
        <p className="serif text-3xl text-ink">Your bag is empty.</p>
        <Link to="/shop" search={{ sale: undefined }} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink">
          ← Back to shop
        </Link>
      </div>
    );
  }

  const formDisabled = step !== "details";

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1600px] px-5 pb-24 pt-24 md:px-12 md:pt-32">

        {priceWarning && (
          <div className="mb-6 border border-clay/30 bg-clay/5 px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-clay">
              Some prices were updated to reflect current offers.
            </p>
          </div>
        )}

        <div className="mb-10 md:mb-14">
          <button
            onClick={() => {
              if (step !== "details") handleChangePaymentMethod();
              else window.history.back();
            }}
            className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M9 2 4 7l5 5" />
            </svg>
            {step !== "details" ? "Change payment method" : "Back"}
          </button>

          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Checkout</p>
          <h1 className="serif mt-2 text-4xl text-ink md:text-5xl">Your order</h1>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_400px] lg:gap-20">

          {/* ── Order summary (right col desktop / top mobile) ── */}
          <div className="order-first lg:order-last lg:sticky lg:top-28 lg:self-start">
            <div className="border border-border p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Order summary</p>
              <ul className="mt-6 space-y-5">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-4">
                    <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden bg-muted">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground font-mono text-[9px] text-background">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col justify-between py-0.5">
                      <div>
                        <p className="serif text-[14px] text-ink">{item.name}</p>
                        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                          {item.size} · {item.colour}
                        </p>
                      </div>
                      <div>
                        {item.originalPrice && (
                          <p className="font-mono text-[10px] text-muted-foreground line-through">{formatMoney(item.originalPrice, currency, rate)}</p>
                        )}
                        <p className={`font-mono text-[12px] ${item.originalPrice ? "text-clay" : "text-ink"}`}>
                          {formatMoney(item.price * item.quantity, currency, rate)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <div className="flex justify-between font-mono text-[11px] text-ink/60">
                  <span>Subtotal</span><span>{formatMoney(subtotal, currency, rate)}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-ink/60">
                  <span>Shipping</span><span>{formatMoney(shipping, currency, rate)}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex items-center justify-between font-mono text-[11px] text-green-400">
                    <span className="flex items-center gap-2">
                      Discount
                      {!formDisabled && (
                        <button onClick={() => setAppliedDiscount(null)} className="font-mono text-[9px] text-muted-foreground/50 hover:text-clay transition-colors" title="Remove">✕</button>
                      )}
                    </span>
                    <span>−{formatMoney(discount, currency, rate)}</span>
                  </div>
                )}
                {paymentFee > 0 && (
                  <div className="flex justify-between font-mono text-[11px] text-ink/60">
                    <span className="flex items-center gap-1">
                      Payment fee
                      <span className="font-mono text-[9px] text-muted-foreground/50">
                        ({shippingCfg.paymentFeePercent > 0 && `${shippingCfg.paymentFeePercent}%`}{shippingCfg.paymentFeePercent > 0 && shippingCfg.paymentFeeFixed > 0 && " + "}{shippingCfg.paymentFeeFixed > 0 && formatMoney(shippingCfg.paymentFeeFixed, currency, rate)})
                      </span>
                    </span>
                    <span>{formatMoney(paymentFee, currency, rate)}</span>
                  </div>
                )}
                {appliedGiftCard && gcApplied > 0 && (
                  <div className="flex justify-between font-mono text-[11px] text-green-400">
                    <span>Gift card</span>
                    <span>−{currency === "ALL"
                      ? `ALL ${appliedGiftCard.appliedLek.toLocaleString()}`
                      : formatMoney(gcApplied, currency, rate)}</span>
                  </div>
                )}
              </div>

              {!formDisabled && (
                !appliedDiscount ? (
                  <div className="mt-5 border-t border-border pt-5">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Discount code</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleApplyCoupon(); }}
                        placeholder="ENTER CODE"
                        style={{ fontSize: '16px' }}
                        className="flex-1 border-b border-border bg-transparent pb-2 font-mono uppercase tracking-widest text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
                      />
                      <button
                        onClick={handleApplyCoupon}
                        disabled={couponApplying || !couponInput.trim()}
                        className="font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors hover:text-ink disabled:opacity-40"
                      >
                        {couponApplying ? "…" : "Apply"}
                      </button>
                    </div>
                    {couponError && <p className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-clay">{couponError}</p>}
                  </div>
                ) : (
                  <div className="mt-5 border-t border-border pt-5">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-green-400">
                      Code <span className="font-bold">{appliedDiscount.code}</span> applied —{" "}
                      {appliedDiscount.type === "PERCENT" ? `${appliedDiscount.value}% off` : `${formatMoney(appliedDiscount.value, currency, rate)} off`}
                    </p>
                  </div>
                )
              )}

              {/* Gift card input / applied state */}
              {!formDisabled && !hasGiftCardInCart && (
                !appliedGiftCard ? (
                  <div className="mt-5 border-t border-border pt-5">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gift card</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={giftCardInput}
                        onChange={(e) => { setGiftCardInput(e.target.value.toUpperCase()); setGiftCardError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleApplyGiftCard(); }}
                        placeholder="NOTT-XXXX-XXXX-XXXX"
                        style={{ fontSize: '16px' }}
                        className="flex-1 border-b border-border bg-transparent pb-2 font-mono uppercase tracking-widest text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
                      />
                      <button
                        onClick={handleApplyGiftCard}
                        disabled={giftCardApplying || !giftCardInput.trim()}
                        className="font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors hover:text-ink disabled:opacity-40"
                      >
                        {giftCardApplying ? "…" : "Apply"}
                      </button>
                    </div>
                    {giftCardError && <p className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-clay">{giftCardError}</p>}
                  </div>
                ) : (
                  <div className="mt-5 border-t border-border pt-5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-green-400">
                        Gift card applied
                      </p>
                      <button
                        onClick={() => setAppliedGiftCard(null)}
                        className="font-mono text-[9px] text-muted-foreground/50 hover:text-clay transition-colors"
                        title="Remove gift card"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="font-mono text-[9px] text-muted-foreground/60">{appliedGiftCard.code}</p>
                    <p className="font-mono text-[9px] text-green-400">
                      −{currency === "ALL"
                        ? `ALL ${appliedGiftCard.appliedLek.toLocaleString()}`
                        : formatMoney(appliedGiftCard.appliedEur, currency, rate)}
                      {" "}
                      <span className="text-muted-foreground/50">
                        (remaining: ALL {(appliedGiftCard.balanceLek - appliedGiftCard.appliedLek).toLocaleString()})
                      </span>
                    </p>
                  </div>
                )
              )}

              <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
                <p className="serif text-2xl text-ink">{formatMoney(total, currency, rate)}</p>
              </div>
            </div>

            {/* Inline new-card payment form — right column */}
            {step === "card-payment" && pokOrderId && (
              <div className="mt-6 border border-border">
                <div className="border-b border-border px-5 py-3">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">Secured payment — POK Pay</p>
                </div>
                <div className="p-5">
                  {placing ? (
                    <div className="flex items-center justify-center gap-3 py-6">
                      <Spinner />
                      <p className="font-mono text-[11px] text-muted-foreground">Confirming your order…</p>
                    </div>
                  ) : (
                    mounted && (
                      <Suspense fallback={
                        <div className="flex items-center justify-center gap-3 py-10">
                          <Spinner />
                          <p className="font-mono text-[11px] text-muted-foreground">Loading payment form…</p>
                        </div>
                      }>
                        <GuestCheckoutForm
                          orderId={pokOrderId}
                          onSuccess={handlePokSuccess}
                          onError={handlePokError}
                          options={{
                            env: POK_ENV,
                            locale: "en",
                            countrySelect: "modal",
                            initialState: {
                              email: form.email,
                              holdersName: `${form.firstName} ${form.lastName}`.trim(),
                              address1: form.address,
                              locality: form.city,
                              postalCode: form.postalCode,
                              phoneNumber: form.phone,
                              countryCode: form.country,
                              cardNumber: "",
                              expiration: "",
                              securityCode: "",
                              administrativeArea: "",
                            },
                          }}
                        />
                      </Suspense>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Saved-card 3DS container — right column */}
            {step === "saved-card-payment" && (
              <div className="mt-6 border border-border">
                <div className="border-b border-border px-5 py-3">
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">Secured payment — POK Pay</p>
                </div>
                <div className="p-5">
                  {placing ? (
                    <div className="flex items-center justify-center gap-3 py-6">
                      <Spinner />
                      <p className="font-mono text-[11px] text-muted-foreground">Confirming your order…</p>
                    </div>
                  ) : (
                    <div id="pok-saved-card-container">
                      <div className="flex items-center justify-center gap-3 py-10">
                        <Spinner />
                        <p className="font-mono text-[11px] text-muted-foreground">Preparing payment…</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Link to="/shop" search={{ sale: undefined }} className="mt-4 hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 transition hover:text-ink lg:flex">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><path d="M8 1 3 6l5 5" /></svg>
              Continue shopping
            </Link>
          </div>

          {/* ── Left column: always-visible form ── */}
          <div className="lg:order-first space-y-10">

            {/* Contact */}
            <fieldset disabled={formDisabled} className="disabled:opacity-50">
              <legend className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Contact</legend>
              <div className="space-y-5">
                <Field label="Email address" value={form.email} onChange={(v) => set("email", v)} error={errors.email} type="email" placeholder="you@somewhere.com" />
                <Field label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} error={errors.phone} type="tel" placeholder="+355 69 123 4567" inputMode="tel" />
              </div>
            </fieldset>

            {/* Shipping address */}
            <fieldset disabled={formDisabled} className="disabled:opacity-50">
              <legend className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Shipping address</legend>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First name" value={form.firstName} onChange={(v) => set("firstName", v)} error={errors.firstName} />
                  <Field label="Last name" value={form.lastName} onChange={(v) => set("lastName", v)} error={errors.lastName} />
                </div>
                <Field label="Address" value={form.address} onChange={(v) => set("address", v)} error={errors.address} placeholder="Street and number" />
                <Field label="Apartment, suite, etc. (optional)" value={form.address2} onChange={(v) => set("address2", v)} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City" value={form.city} onChange={(v) => set("city", v)} error={errors.city} />
                  <Field label="Postal code" value={form.postalCode} onChange={(v) => set("postalCode", v)} error={errors.postalCode} />
                </div>
                <Field label="Country" value={form.country} onChange={(v) => set("country", v)} error={errors.country} placeholder="e.g. Albania" />
              </div>
            </fieldset>

            {/* Payment method selector */}
            <div>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Payment method</p>
              <div className="space-y-2">

                {/* Cash on delivery — first (hidden when cart has gift card purchases) */}
                {!hasGiftCardInCart && (
                  <button
                    type="button"
                    disabled={formDisabled}
                    onClick={() => { setPaymentMethod("cod"); setPlaceError(null); }}
                    className={`w-full flex items-center gap-4 border px-5 py-4 text-left transition-colors duration-150 disabled:cursor-default ${
                      paymentMethod === "cod"
                        ? "border-foreground/40 bg-muted"
                        : "border-border bg-transparent hover:border-border/70"
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${paymentMethod === "cod" ? "border-foreground" : "border-muted-foreground/40"}`}>
                      {paymentMethod === "cod" && <span className="h-2 w-2 rounded-full bg-foreground" />}
                    </span>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-ink">Cash on delivery</p>
                      <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/50">Pay when your order arrives</p>
                    </div>
                  </button>
                )}

                {/* Saved cards */}
                {localSavedCards.map((card) => {
                  const active = paymentMethod === "saved-card" && selectedSavedCardId === card.id;
                  return (
                    <div key={card.id} className={`flex items-center border transition-colors duration-150 ${active ? "border-foreground/40 bg-muted" : "border-border"}`}>
                      <button
                        type="button"
                        disabled={formDisabled}
                        onClick={() => {
                          setPaymentMethod("saved-card");
                          setSelectedSavedCardId(card.id);
                          setPlaceError(null);
                        }}
                        className="flex flex-1 items-center gap-4 px-5 py-4 text-left disabled:cursor-default"
                      >
                        <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${active ? "border-foreground" : "border-muted-foreground/40"}`}>
                          {active && <span className="h-2 w-2 rounded-full bg-foreground" />}
                        </span>
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <p className="font-mono text-[11px] uppercase tracking-widest text-ink">
                              {card.label ?? `**** ${card.lastFour ?? "••••"}`}
                            </p>
                            <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/50">Saved card</p>
                          </div>
                          <CardBrandIcon brand={card.brand} />
                        </div>
                      </button>
                      {!formDisabled && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedCard(card.id)}
                          className="px-4 py-4 text-muted-foreground/30 transition-colors hover:text-clay"
                          title="Remove saved card"
                          aria-label="Remove saved card"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
                            <path d="M1 1l10 10M11 1 1 11" />
                          </svg>
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* New card */}
                <button
                  type="button"
                  disabled={formDisabled}
                  onClick={() => { setPaymentMethod("new-card"); setPlaceError(null); }}
                  className={`w-full flex items-center justify-between border px-5 py-4 text-left transition-colors duration-150 disabled:cursor-default ${
                    paymentMethod === "new-card"
                      ? "border-foreground/40 bg-muted"
                      : "border-border bg-transparent hover:border-border/70"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${paymentMethod === "new-card" ? "border-foreground" : "border-muted-foreground/40"}`}>
                      {paymentMethod === "new-card" && <span className="h-2 w-2 rounded-full bg-foreground" />}
                    </span>
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-widest text-ink">
                        {localSavedCards.length > 0 ? "New card" : "Card"}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/50">Visa, Mastercard — secured by POK Pay</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-40">
                    <CardBrand name="VISA" />
                    <CardBrand name="MC" />
                  </div>
                </button>

              </div>
            </div>

            {/* Error */}
            {placeError && (
              <p className="font-mono text-[11px] text-clay">{placeError}</p>
            )}

            {/* CTA */}
            {step === "details" && (
              <div className="space-y-4">
                {/* Zero-total: gift card covers the full order — skip payment gateway */}
                {isZeroTotal ? (
                  <button
                    onClick={handlePlaceZeroTotalOrder}
                    disabled={placing}
                    className="w-full bg-foreground py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {placing
                      ? <span className="flex items-center justify-center gap-3"><Spinner />Placing order…</span>
                      : "Place order — fully covered by gift card"}
                  </button>
                ) : (
                  <>
                    {paymentMethod === "cod" && (
                      <button
                        onClick={handlePlaceCodOrder}
                        disabled={placing}
                        className="w-full bg-foreground py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        {placing
                          ? <span className="flex items-center justify-center gap-3"><Spinner />Placing order…</span>
                          : `Place order — ${formatMoney(total, currency, rate)}`}
                      </button>
                    )}

                    {paymentMethod === "new-card" && (
                      <button
                        onClick={handleInitiateCardPayment}
                        className="w-full bg-foreground py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-opacity hover:opacity-80"
                      >
                        {`Continue to card payment — ${formatMoney(total, currency, rate)}`}
                      </button>
                    )}

                    {paymentMethod === "saved-card" && (
                      <button
                        onClick={handleInitiateSavedCardPayment}
                        disabled={!selectedSavedCardId}
                        className="w-full bg-foreground py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        {`Pay with saved card — ${formatMoney(total, currency, rate)}`}
                      </button>
                    )}
                  </>
                )}

                <p className="text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                  By placing your order you agree to our{" "}
                  <a href="#" className="underline underline-offset-2 hover:text-muted-foreground">Terms</a> and{" "}
                  <a href="#" className="underline underline-offset-2 hover:text-muted-foreground">Privacy policy</a>
                </p>
              </div>
            )}

            {/* Initiating spinner (between details and payment form appearing) */}
            {step === "initiating" && (
              <div className="flex items-center gap-3 py-4">
                <Spinner />
                <p className="font-mono text-[11px] text-muted-foreground">Preparing payment…</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function CardBrand({ name }: { name: string }) {
  return (
    <span className="border border-muted-foreground/20 px-1.5 py-0.5 font-mono text-[8px] tracking-wider text-muted-foreground/50">
      {name}
    </span>
  );
}

function CardBrandIcon({ brand }: { brand: string | null }) {
  const upper = (brand ?? "").toUpperCase();
  if (upper.includes("VISA")) return <CardBrand name="VISA" />;
  if (upper.includes("MASTER")) return <CardBrand name="MC" />;
  return null;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}

function Field({ label, value, onChange, error, type = "text", placeholder, maxLength, inputMode }: FieldProps) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        style={{ fontSize: '16px' }}
        className={`mt-2 w-full border-b bg-transparent pb-2.5 text-ink outline-none placeholder:text-muted-foreground/30 transition-colors focus:border-ink/60 ${
          error ? "border-clay" : "border-border"
        }`}
      />
      {error && <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-clay">{error}</p>}
    </div>
  );
}
