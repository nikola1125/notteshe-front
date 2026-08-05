import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { product, productImage, productColour, category } from "@/db/schema";
import { WishlistButton } from "@/components/WishlistButton";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShopProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  isNew: boolean;
  isSale: boolean;
  categoryId: string | null;
  categoryName: string | null;
  coverImage: string | null;
  colourCount: number;
}

interface ShopData {
  products: ShopProduct[];
  categories: Array<{ id: string; name: string; slug: string }>;
  total: number;
}

// ─── Server function ──────────────────────────────────────────────────────────

const getShopData = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShopData> => {
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
        .where(and(eq(product.isVisible, true), eq(product.inStock, true)))
        .orderBy(desc(product.createdAt)),

      database
        .select({ id: category.id, name: category.name, slug: category.slug })
        .from(category)
        .orderBy(category.name),

      database
        .select({ productId: productImage.productId, url: productImage.url })
        .from(productImage)
        .where(eq(productImage.isCover, true)),

      database
        .select({ productId: productColour.productId })
        .from(productColour),
    ]);

    const coverMap = new Map(coverImages.map((img) => [img.productId, img.url]));
    const catMap = new Map(cats.map((c) => [c.id, c.name]));

    const colourCountMap = new Map<string, number>();
    for (const c of colours) {
      colourCountMap.set(c.productId, (colourCountMap.get(c.productId) ?? 0) + 1);
    }

    const products = prods.map((p) => ({
      ...p,
      price: Number(p.price),
      originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
      categoryName: p.categoryId ? (catMap.get(p.categoryId) ?? null) : null,
      coverImage: coverMap.get(p.id) ?? null,
      colourCount: colourCountMap.get(p.id) ?? 0,
    }));

    return { products, categories: cats, total: products.length };
  }
);

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/shop/")({
  validateSearch: (search: Record<string, unknown>) => ({
    sale: search["sale"] === "1" ? "1" as const : undefined,
  }),
  loader: () => getShopData(),
  component: ShopPage,
});

const SORT_OPTIONS = [
  { label: "Featured",  value: "featured" },
  { label: "Newest",    value: "newest" },
  { label: "Price ↑",   value: "price-asc" },
  { label: "Price ↓",   value: "price-desc" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// ─── Component ────────────────────────────────────────────────────────────────

function ShopPage() {
  const { products, categories, total } = Route.useLoaderData();
  const { sale } = Route.useSearch();
  const [activeCategoryId, setActiveCategoryId] = useState<string | "all" | "sale">(sale === "1" ? "sale" : "all");
  const [activeSort, setActiveSort] = useState<SortValue>("featured");
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in-view");
        }),
      { threshold: 0.06 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [activeCategoryId]);

  const filtered = useMemo(() => {
    let list =
      activeCategoryId === "all" ? [...products]
      : activeCategoryId === "sale" ? products.filter((p) => p.isSale)
      : products.filter((p) => p.categoryId === activeCategoryId);

    switch (activeSort) {
      case "newest":
        list = list.filter((p) => p.isNew).concat(list.filter((p) => !p.isNew));
        break;
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
    }

    return list;
  }, [activeCategoryId, activeSort, products]);

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.value === activeSort)?.label ?? "Featured";

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ─── Page header ─── */}
      <div className="border-b border-border pt-24 pb-10 md:pt-32 md:pb-14">
        <div className="mx-auto max-w-[1600px] px-5 md:px-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            AW26 Collection
          </p>
          <h1 className="serif mt-3 text-5xl leading-tight text-ink md:text-7xl">
            The Shop.
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            {total} {total === 1 ? "piece" : "pieces"}. Considered once, made well, left alone.
          </p>
        </div>
      </div>

      {/* ─── Filters + Sort ─── */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center px-5 md:px-12">

          {/* Category tabs — scrollable, stops before the divider */}
          <div className="flex min-w-0 flex-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveCategoryId("all")}
              className={`shrink-0 border-b-[1.5px] px-4 py-4 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 md:px-5 ${
                activeCategoryId === "all"
                  ? "border-ink text-ink"
                  : "border-transparent text-muted-foreground hover:text-ink"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`shrink-0 border-b-[1.5px] px-4 py-4 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 md:px-5 ${
                  activeCategoryId === cat.id
                    ? "border-ink text-ink"
                    : "border-transparent text-muted-foreground hover:text-ink"
                }`}
              >
                {cat.name}
              </button>
            ))}
            <button
              onClick={() => setActiveCategoryId("sale")}
              className={`shrink-0 border-b-[1.5px] px-4 py-4 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 md:px-5 ${
                activeCategoryId === "sale"
                  ? "border-clay text-clay"
                  : "border-transparent text-clay/60 hover:text-clay"
              }`}
            >
              Sale
            </button>
          </div>

          {/* Divider — always visible, categories scroll before it */}
          <div className="mx-3 h-5 w-px shrink-0 bg-border/70" />

          {/* Sort dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="flex items-center gap-2 py-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-ink"
            >
              {activeSortLabel}
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className={`transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
              >
                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {sortOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setSortOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 min-w-[140px] border border-border bg-background shadow-sm">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setActiveSort(opt.value); setSortOpen(false); }}
                      className={`block w-full px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest transition-colors hover:bg-muted ${
                        activeSort === opt.value ? "text-ink" : "text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Product grid ─── */}
      <div className="mx-auto max-w-[1600px] px-5 py-12 md:px-12 md:py-16">
        {filtered.length === 0 ? (
          <p className="py-24 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            No pieces in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {filtered.map((p, i) => (
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

                  <WishlistButton
                    productId={p.id}
                    className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  />

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
                      <p className="font-mono text-[10px] text-muted-foreground line-through">
                        €{p.originalPrice}
                      </p>
                    )}
                    <p className={`font-mono text-[12px] ${p.isSale ? "text-clay" : "text-ink/70"}`}>
                      €{p.price}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border py-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
          All prices include VAT · Free shipping over €200 · Returns within 14 days
        </p>
      </div>
    </div>
  );
}
