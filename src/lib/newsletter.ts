import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    const { getRequest } = await import("@tanstack/start-server-core/request-response");
    const req = getRequest();
    const ip = req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "unknown";
    if (!rateLimit(`newsletter:ip:${ip}`, 5, 10 * 60_000)) {
      throw new Error("Too many requests. Please wait before trying again.");
    }
    const { db } = await import("@/db");
    const { newsletterSubscriber } = await import("@/db/schema");

    const result = await db()
      .insert(newsletterSubscriber)
      .values({ id: crypto.randomUUID(), email: data.email.toLowerCase().trim() })
      .onConflictDoNothing()
      .returning({ id: newsletterSubscriber.id });

    return { success: true, alreadySubscribed: result.length === 0 };
  });
