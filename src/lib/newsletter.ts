import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/db");
    const { newsletterSubscriber } = await import("@/db/schema");

    await db()
      .insert(newsletterSubscriber)
      .values({ id: crypto.randomUUID(), email: data.email.toLowerCase().trim() })
      .onConflictDoNothing();

    return { success: true };
  });
