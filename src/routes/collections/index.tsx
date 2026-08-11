import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { collection, product } from "@/db/schema";

interface CollectionCard {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  productCount: number;
}

const getCollections = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ collections: CollectionCard[] }> => {
    const database = db();

    const [rows, prods] = await Promise.all([
      database
        .select()
        .from(collection)
        .where(eq(collection.isVisible, true))
        .orderBy(asc(collection.sortOrder), asc(collection.name)),
      database
        .select({ collectionId: product.collectionId })
        .from(product)
        .where(eq(product.isVisible, true)),
    ]);

    const countMap = new Map<string, number>();
    for (const p of prods) {
      if (p.collectionId) countMap.set(p.collectionId, (countMap.get(p.collectionId) ?? 0) + 1);
    }

    return {
      collections: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        coverImage: c.coverImageUrl,
        productCount: countMap.get(c.id) ?? 0,
      })),
    };
  }
);

export const Route = createFileRoute("/collections/")({
  head: () => ({
    meta: [
      { title: "Collections — Notteshe" },
      { name: "description", content: "Explore the Notteshe collections." },
    ],
  }),
  loader: () => getCollections(),
  component: CollectionsIndex,
});

function CollectionsIndex() {
  const { collections } = Route.useLoaderData();

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
      {/* Header */}
      <div className="border-b border-border pt-24 pb-10 md:pt-32 md:pb-14">
        <div className="mx-auto max-w-[1600px] px-5 md:px-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">AW26</p>
          <h1 className="serif mt-3 text-5xl leading-tight text-ink md:text-7xl">Collections.</h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-12 md:px-12 md:py-16">
        {collections.length === 0 ? (
          <p className="py-24 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            No collections yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
            {collections.map((c, i) => (
              <Link
                key={c.id}
                to="/collections/$slug"
                params={{ slug: c.slug }}
                className="reveal group"
                style={{ transitionDelay: `${(i % 3) * 60}ms` }}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  {c.coverImage ? (
                    <img
                      src={c.coverImage}
                      alt={c.name}
                      loading={i < 3 ? "eager" : "lazy"}
                      draggable={false}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out md:group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">No image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h2 className="serif text-2xl text-ink md:text-3xl">{c.name}</h2>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink/60">
                      {c.productCount} {c.productCount === 1 ? "piece" : "pieces"}
                    </p>
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
