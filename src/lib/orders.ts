import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PlaceOrderSchema = z.object({
  email: z.string().email(),
  phone: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
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
});

export const placeOrder = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof PlaceOrderSchema>) => PlaceOrderSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { db } = await import("@/db");
    const { orders, orderItem, shippingConfig, discountCode, productSize } = await import("@/db/schema");
    const { eq, sql, inArray } = await import("drizzle-orm");
    const { randomUUID } = await import("node:crypto");

    const session = await requireAuth();

    // Stock check — prevent overselling
    const productIds = [...new Set(data.items.map((i) => i.productId))];
    const sizeRows = await db()
      .select({ productId: productSize.productId, label: productSize.label, stock: productSize.stock })
      .from(productSize)
      .where(inArray(productSize.productId, productIds));

    for (const item of data.items) {
      const row = sizeRows.find((s) => s.productId === item.productId && s.label === item.size);
      if (!row || row.stock < item.quantity) {
        throw new Error(`"${item.name}" size ${item.size} has insufficient stock.`);
      }
    }

    const [config] = await db().select().from(shippingConfig).limit(1);
    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const fee = config?.enabled
      ? (subtotal >= (config.freeThreshold ?? 200) ? 0 : (config.fee ?? 12))
      : 0;

    // Re-validate discount server-side
    let discountAmount = 0;
    let validatedCode: string | null = null;
    if (data.discountCode) {
      const rows = await db()
        .select()
        .from(discountCode)
        .where(eq(discountCode.code, data.discountCode.toUpperCase().trim()))
        .limit(1);
      const code = rows[0];
      const now = new Date();
      if (
        code &&
        code.isActive &&
        (!code.expiresAt || code.expiresAt > now) &&
        (code.maxUses === null || code.usedCount < code.maxUses) &&
        (code.minOrderAmount === null || subtotal >= code.minOrderAmount)
      ) {
        discountAmount =
          code.type === "PERCENT"
            ? Math.round(subtotal * (code.value / 100) * 100) / 100
            : Math.min(code.value, subtotal);
        validatedCode = code.code;
        await db()
          .update(discountCode)
          .set({ usedCount: sql`used_count + 1` })
          .where(eq(discountCode.code, code.code));
      }
    }

    const total = Math.max(0, subtotal + fee - discountAmount);

    const orderId = randomUUID();
    const shippingAddress = {
      firstName: data.firstName,
      lastName: data.lastName,
      line1: data.address,
      line2: data.address2 ?? null,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country,
      phone: data.phone,
      email: data.email,
    };

    await db().insert(orders).values({
      id: orderId,
      userId: session.user.id,
      status: "PENDING",
      subtotal,
      shippingFee: fee,
      total,
      shippingAddress,
    });

    const itemRows = data.items.map((item) => ({
      id: randomUUID(),
      orderId,
      productId: item.productId,
      productSnapshot: {
        name: item.name,
        image: item.image,
        price: item.price,
        originalPrice: item.originalPrice,
      },
      size: item.size,
      colour: item.colour,
      quantity: item.quantity,
      unitPrice: item.price,
    }));

    await db().insert(orderItem).values(itemRows);

    return { orderId, discountCode: validatedCode };
  });
