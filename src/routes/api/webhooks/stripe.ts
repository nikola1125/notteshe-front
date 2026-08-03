import { createAPIFileRoute } from "@tanstack/react-start/api";

export const APIRoute = createAPIFileRoute("/api/webhooks/stripe")({
  POST: async ({ request }) => {
    const { getRuntimeEnv } = await import("@/lib/runtime-env");
    const { getStripe } = await import("@/lib/stripe");
    const { db } = await import("@/db");
    const { orders, orderItem } = await import("@/db/schema");
    const { sendOrderConfirmation } = await import("@/lib/resend");
    const { randomUUID } = await import("node:crypto");

    const sig = request.headers.get("stripe-signature");
    const webhookSecret = getRuntimeEnv("STRIPE_WEBHOOK_SECRET");

    if (!sig || !webhookSecret) {
      return new Response("Missing signature", { status: 400 });
    }

    let event;
    try {
      const body = await request.text();
      event = await getStripe().webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    if (event.type !== "payment_intent.succeeded") {
      return new Response("OK", { status: 200 });
    }

    const intent = event.data.object;
    const meta = intent.metadata;

    const orderId = randomUUID();
    const subtotal = parseFloat(meta.subtotal ?? "0");
    const shippingFee = parseFloat(meta.shippingFee ?? "0");
    const total = subtotal + shippingFee;

    const shippingAddress = {
      firstName: meta.firstName,
      lastName: meta.lastName,
      line1: meta.address,
      line2: meta.address2 || null,
      city: meta.city,
      postalCode: meta.postalCode,
      country: meta.country,
      email: meta.email,
      phone: meta.phone,
    };

    await db().insert(orders).values({
      id: orderId,
      userId: meta.userId,
      status: "CONFIRMED",
      subtotal,
      shippingFee,
      total,
      shippingAddress,
      stripePaymentIntentId: intent.id,
    });

    const items: Array<{
      productId: string; name: string; price: number;
      originalPrice: number | null; image: string;
      size: string; colour: string; quantity: number;
    }> = JSON.parse(meta.items ?? "[]");

    if (items.length > 0) {
      await db().insert(orderItem).values(
        items.map((item) => ({
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
        }))
      );
    }

    // Send confirmation email (non-blocking)
    sendOrderConfirmation({
      to: meta.email,
      firstName: meta.firstName,
      orderId,
      items: items.map((i) => ({
        name: i.name,
        size: i.size,
        colour: i.colour,
        quantity: i.quantity,
        unitPrice: i.price,
      })),
      subtotal,
      shippingFee,
      total,
    }).catch((err) => console.error("email failed", err));

    return new Response("OK", { status: 200 });
  },
});
