import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PlaceOrderSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
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
    const { orders, orderItem, shippingConfig } = await import("@/db/schema");
    const { randomUUID } = await import("node:crypto");

    const session = await requireAuth();

    // Load shipping config
    const [config] = await db().select().from(shippingConfig).limit(1);
    const fee = config?.enabled
      ? (data.items.reduce((s, i) => s + i.price * i.quantity, 0) >= (config.freeThreshold ?? 200)
        ? 0
        : (config.fee ?? 12))
      : 0;

    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total = subtotal + fee;

    const orderId = randomUUID();
    const shippingAddress = {
      firstName: data.firstName,
      lastName: data.lastName,
      line1: data.address,
      line2: data.address2 ?? null,
      city: data.city,
      postalCode: data.postalCode,
      country: data.country,
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

    return { orderId };
  });
