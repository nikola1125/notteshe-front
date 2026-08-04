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
  discountCode: z.string().optional(),
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
    const { shippingConfig, discountCode } = await import("@/db/schema");
    const { eq, sql } = await import("drizzle-orm");

    const session = await requireAuth();

    const [config] = await db().select().from(shippingConfig).limit(1);
    const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const fee = config?.enabled
      ? subtotal >= (config.freeThreshold ?? 200) ? 0 : (config.fee ?? 12)
      : 0;

    // Re-validate discount server-side (never trust client-computed amount)
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
        // Increment usage count
        await db()
          .update(discountCode)
          .set({ usedCount: sql`used_count + 1` })
          .where(eq(discountCode.code, code.code));
      }
    }

    const total = Math.max(0, subtotal + fee - discountAmount);

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
        discountCode: validatedCode ?? "",
        discountAmount: String(discountAmount),
        items: JSON.stringify(data.items),
      },
    });

    return { clientSecret: intent.client_secret! };
  });
