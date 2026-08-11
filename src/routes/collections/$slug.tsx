import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { collection, product, productImage, productColour } from "@/db/schema";
import { WishlistButton } from "@/components/WishlistButton";

interface CollectionProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  isNew: boolean;
  isSale: boolean;
  coverImage: string | null;
  colourCount: number;
}

interface CollectionDetail {
  name: string;
  description: string | null;
  coverImage: string | null;
  products: CollectionProduct[];
}

const getCollection = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ slug: (input as { slug: string }).slug }))
  .handler(async ({ data }): Promise<CollectionDetail | null> => {
    const database = db();

    const rows = await database
      .select()
      .from(collection)
      .where(and(eq(collection.slug, data.slug), eq(collection.isVisible, true)))
      .limit(1);

    const col = rows[0];
    if (!col) return null;

    const [prods, covers, colours] = await Promise.all([
      database
        .select({
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          originalPrice: product.originalPrice,
          isNew: product.isNew,
          isSale: product.isSale,
        })
        .from(product)
        .where(and(eq(product.collectionId, col.id), eq(product.isVisible, true), eq(product.inStock, true)))
        .orderBy(desc(product.createdAt)),
      database
        .select({ productId: productImage.productId, url: productImage.url })
        .from(productImage)
        .where(eq(productImage.isCover, true)),
      database.select({ productId: productColour.productId }).from(productColour),
    ]);

    const coverMap = new Map(covers.map((c) => [c.productId, c.url]));
    const colourMap = new Map<string, number>();
    for (const c of colours) colourMap.set(c.productId, (colourMap.get(c.productId) ?? 0) + 1);

    return {
      name: col.name,
      description: col.description,
      coverImage: col.coverImageUrl,
      products: prods.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
        isNew: p.isNew,
        isSale: p.isSale,
        coverImage: coverMap.get(p.id) ?? null,
        colourCount: colourMap.get(p.id) ?? 0,
      })),
    };
  });

export const Route = createFileRoute("/collections/$slug")({
  loader: async ({ params }) => {
    const data = await getCollection({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  component: CollectionDetailPage,
});

function CollectionDetailPage() {
  const { name, description, coverImage, products } = Route.useLoaderData();

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.06 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Cover hero */}
      <section className="relative h-[60svh] min-h-[380px] w-full md:h-[70svh]">
        {coverImage ? (
          <img src={coverImage} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/70" />
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-10 md:px-12 md:pb-16">
          <div className="mx-auto max-w-[1600px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">Collection</p>
            <h1 className="serif mt-2 text-5xl leading-[0.95] text-ink md:text-7xl">{name}</h1>
            {description && (
              <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-ink/70">{description}</p>
            )}
          </div>
        </div>
      </section>

      {/* Products */}
      <div className="mx-auto max-w-[1600px] px-5 py-12 md:px-12 md:py-16">
        <div className="mb-8 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {products.length} {products.length === 1 ? "piece" : "pieces"}
          </p>
          <Link
            to="/collections"
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-clay"
          >
            ← All collections
          </Link>
        </div>

        {products.length === 0 ? (
          <p className="py-24 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            No pieces in this collection yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {products.map((p, i) => (
              <Link
                key={p.id}
                to="/shop/$slug"
                params={{ slug: p.slug }}
                className="reveal group"
                style={{ transitionDelay: `${(i % 4) * 60}ms` }}
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                  {p.coverImage ? (
                    <img
                      src={p.coverImage}
                      alt={p.name}
                      loading={i < 4 ? "eager" : "lazy"}
                      draggable={false}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out md:group-hover:scale-[1.05] touch-pan-y"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">No image</span>
                    </div>
                  )}

                  {p.isSale ? (
                    <span className="absolute left-3 top-3 bg-clay px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-paper">Sale</span>
                  ) : p.isNew ? (
                    <span className="absolute left-3 top-3 border border-ink/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink/70 backdrop-blur-sm">New In</span>
                  ) : null}

                  <WishlistButton
                    productId={p.id}
                    className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm opacity-0 md:group-hover:opacity-100 transition-opacity duration-200"
                  />

                  <div className="absolute bottom-0 left-0 right-0 translate-y-full border-t border-ink/10 bg-background/90 py-3.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink backdrop-blur-sm transition-transform duration-300 ease-out md:group-hover:translate-y-0">
                    View piece
                  </div>
                </div>

                <div className="mt-4 flex items-start justify-between">
                  <div>
                    <h3 className="relative inline-block serif text-[15px] text-ink after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 md:group-hover:after:scale-x-100">
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
                      <p className="font-mono text-[10px] text-muted-foreground line-through">{p.originalPrice} L</p>
                    )}
                    <p className={`font-mono text-[12px] ${p.isSale ? "text-clay" : "text-ink/70"}`}>{p.price} L</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
