import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CartItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.number(),
  originalPrice: z.number().nullable(),
  image: z.string(),
  size: z.string(),
  colour: z.string(),
  quantity: z.number().int().positive(),
});

const CreatePaymentIntentSchema = z.object({
  items: z.array(CartItemSchema),
  shippingAddress: z.object({
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
});

export type ShippingAddressInput = z.infer<typeof CreatePaymentIntentSchema>["shippingAddress"];

export const createPaymentIntent = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof CreatePaymentIntentSchema>) =>
    CreatePaymentIntentSchema.parse(input)
  )
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const { getStripe } = await import("@/lib/stripe");
    const { db } = await import("@/db");
    const { shippingConfig } = await import("@/db/schema");

    const session = await requireAuth();

    const [config] = await db().select().from(shippingConfig).limit(1);
    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const fee = config?.enabled
      ? subtotal >= (config.freeThreshold ?? 200) ? 0 : (config.fee ?? 12)
      : 0;
    const total = subtotal + fee;

    const intent = await getStripe().paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: session.user.id,
        email: data.shippingAddress.email,
        firstName: data.shippingAddress.firstName,
        lastName: data.shippingAddress.lastName,
        address: data.shippingAddress.address,
        address2: data.shippingAddress.address2 ?? "",
        city: data.shippingAddress.city,
        postalCode: data.shippingAddress.postalCode,
        country: data.shippingAddress.country,
        phone: data.shippingAddress.phone,
        subtotal: String(subtotal),
        shippingFee: String(fee),
        items: JSON.stringify(data.items),
      },
    });

    return { clientSecret: intent.client_secret! };
  });
