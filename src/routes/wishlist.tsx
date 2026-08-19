import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { product, productImage, productColour, category } from "@/db/schema";
import { useWishlist } from "@/store/wishlistStore";
import { WishlistButton } from "@/components/WishlistButton";
import { cldImg, cldSrcSet } from "@/lib/cldImage";
import { Price } from "@/components/Price";

interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  isNew: boolean;
  isSale: boolean;
  categoryName: string | null;
  coverImage: string | null;
  colourCount: number;
}

const getWishlistProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<WishlistProduct[]> => {
    const database = db();

    const [prods, cats, coverImages, colours] = await Promise.all([
      database
        .select({
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          originalPrice: product.originalPrice,
          isNew: product.isNew,
          isSale: product.isSale,
          categoryId: product.categoryId,
        })
        .from(product)
        .where(and(eq(product.isVisible, true), eq(product.inStock, true))),

      database
        .select({ id: category.id, name: category.name })
        .from(category),

      database
        .select({ productId: productImage.productId, url: productImage.url })
        .from(productImage)
        .where(eq(productImage.isCover, true)),

      database
        .select({ productId: productColour.productId })
        .from(productColour),
    ]);

    const coverMap = new Map(coverImages.map((img) => [img.productId, img.url]));
    const catMap   = new Map(cats.map((c) => [c.id, c.name]));

    const colourCountMap = new Map<string, number>();
    for (const c of colours) {
      colourCountMap.set(c.productId, (colourCountMap.get(c.productId) ?? 0) + 1);
    }

    return prods.map((p) => ({
      ...p,
      price: Number(p.price),
      originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
      categoryName: p.categoryId ? (catMap.get(p.categoryId) ?? null) : null,
      coverImage: coverMap.get(p.id) ?? null,
      colourCount: colourCountMap.get(p.id) ?? 0,
    }));
  }
);

export const Route = createFileRoute("/wishlist")({
  loader: () => getWishlistProducts(),
  component: WishlistPage,
});

function WishlistPage() {
  const allProducts = Route.useLoaderData();
  const ids = useWishlist((s) => s.ids);
  const setIds = useWishlist((s) => s.setIds);
  const saved = allProducts.filter((p) => ids.includes(p.id));

  // Prune saved IDs that no longer resolve to an available product (deleted,
  // hidden or out of stock) so the header heart badge matches what's shown.
  useEffect(() => {
    const validIds = ids.filter((id) => allProducts.some((p) => p.id === id));
    if (validIds.length !== ids.length) setIds(validIds);
  }, [ids, allProducts, setIds]);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Page header */}
      <div className="border-b border-border pt-20 pb-10 md:pt-28 md:pb-14">
        <div className="mx-auto max-w-[1600px] px-5 md:px-12">
          <button
            onClick={() => window.history.back()}
            className="mb-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-clay"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M9 2 4 7l5 5" />
            </svg>
            Back
          </button>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Your collection
          </p>
          <h1 className="serif mt-3 text-5xl leading-tight text-ink md:text-7xl">
            Saved.
          </h1>
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            {saved.length === 0
              ? "Nothing saved yet."
              : `${saved.length} ${saved.length === 1 ? "piece" : "pieces"} set aside.`}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-12 md:px-12 md:py-16">
        {saved.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-24 text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Heart pieces you love — they'll appear here
            </p>
            <Link
              to="/shop"
              search={{ sale: undefined }}
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink underline underline-offset-4"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {saved.map((p) => (
              <div key={p.id} className="group relative">
                <Link
                  to="/shop/$slug"
                  params={{ slug: p.slug }}
                  className="block"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                    {p.coverImage ? (
                      <img
                        src={cldImg(p.coverImage, 440)}
                        srcSet={cldSrcSet(p.coverImage, 440)}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                          No image
                        </span>
                      </div>
                    )}

                    {p.isSale ? (
                      <span className="absolute left-3 top-3 bg-clay px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-paper">
                        Sale
                      </span>
                    ) : p.isNew ? (
                      <span className="absolute left-3 top-3 border border-ink/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink/70 backdrop-blur-sm">
                        New In
                      </span>
                    ) : null}

                    <div className="absolute bottom-0 left-0 right-0 translate-y-full border-t border-ink/10 bg-background/90 py-3.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink backdrop-blur-sm transition-transform duration-300 ease-out group-hover:translate-y-0">
                      View piece
                    </div>
                  </div>

                  <div className="mt-4 flex items-start justify-between">
                    <div>
                      <h3 className="relative inline-block serif text-[15px] text-ink after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 group-hover:after:scale-x-100">
                        {p.name}
                      </h3>
                      {p.colourCount > 0 && (
                        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                          {p.colourCount} {p.colourCount === 1 ? "colour" : "colours"}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {p.originalPrice && (
                        <p className="whitespace-nowrap font-mono text-[10px] text-muted-foreground line-through">
                          <Price value={p.originalPrice} />
                        </p>
                      )}
                      <p className={`whitespace-nowrap font-mono text-[12px] ${p.isSale ? "text-clay" : "text-ink/70"}`}>
                        <Price value={p.price} />
                      </p>
                    </div>
                  </div>
                </Link>

                <WishlistButton
                  productId={p.id}
                  className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
