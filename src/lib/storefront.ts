import { createServerFn } from "@tanstack/react-start";
import type { Rate } from "@/lib/currency";
import { DEFAULT_RATE } from "@/lib/currency";

// Delivers the admin-set EUR→Lek rate to the client (root loader → context).
export const getStorefrontConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ rate: Rate }> => {
    try {
      const { db } = await import("@/db");
      const { shippingConfig } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const [row] = await db()
        .select({ eurToLekRate: shippingConfig.eurToLekRate, lekRounding: shippingConfig.lekRounding })
        .from(shippingConfig)
        .where(eq(shippingConfig.id, "default"))
        .limit(1);
      if (!row) return { rate: DEFAULT_RATE };
      return {
        rate: {
          eurToLek: row.eurToLekRate ?? DEFAULT_RATE.eurToLek,
          lekRounding: row.lekRounding ?? DEFAULT_RATE.lekRounding,
        },
      };
    } catch {
      // Columns not migrated yet — fall back to defaults so the site still renders.
      return { rate: DEFAULT_RATE };
    }
  }
);
