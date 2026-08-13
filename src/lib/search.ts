import { createServerFn } from "@tanstack/react-start";

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  coverImage: string | null;
}

// Product search by name or description. Visible products only.
export const searchProducts = createServerFn({ method: "GET" })
  .validator((d: unknown) => ({ q: String((d as { q?: unknown })?.q ?? "") }))
  .handler(async ({ data }): Promise<SearchResult[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];

    const { db } = await import("@/db");
    const { product, productImage } = await import("@/db/schema");
    const { and, eq, or, ilike, inArray } = await import("drizzle-orm");
    const database = db();

    const like = `%${q}%`;
    const rows = await database
      .select({ id: product.id, name: product.name, slug: product.slug, price: product.price })
      .from(product)
      .where(and(eq(product.isVisible, true), or(ilike(product.name, like), ilike(product.description, like))))
      .limit(24);

    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const covers = await database
      .select({ productId: productImage.productId, url: productImage.url })
      .from(productImage)
      .where(and(eq(productImage.isCover, true), inArray(productImage.productId, ids)));
    const coverMap = new Map(covers.map((c) => [c.productId, c.url]));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      price: Number(r.price),
      coverImage: coverMap.get(r.id) ?? null,
    }));
  });
