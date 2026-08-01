import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { products } from "@/data/products";
import { WishlistButton } from "@/components/WishlistButton";
import type { ProductCategory, SortOption } from "@/types/product";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
});

const CATEGORIES: { label: string; value: ProductCategory | "All" }[] = [
  { label: "All",         value: "All" },
  { label: "Knitwear",    value: "Knitwear" },
  { label: "Outerwear",   value: "Outerwear" },
  { label: "Trousers",    value: "Trousers" },
  { label: "Dresses",     value: "Dresses" },
  { label: "Tops",        value: "Tops" },
  { label: "Accessories", value: "Accessories" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Featured",    value: "featured" },
  { label: "Newest",      value: "newest" },
  { label: "Price ↑",     value: "price-asc" },
  { label: "Price ↓",     value: "price-desc" },
];

function ShopPage() {
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "All">("All");
  const [activeSort, setActiveSort] = useState<SortOption>("featured");
  const [sortOpen, setSortOpen] = useState(false);

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.06 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [activeCategory]);

  const filtered = useMemo(() => {
    let list = activeCategory === "All"
      ? [...products]
      : products.filter((p) => p.category === activeCategory);

    switch (activeSort) {
      case "newest":     list = list.filter((p) => p.isNew).concat(list.filter((p) => !p.isNew)); break;
      case "price-asc":  list.sort((a, b) => a.price - b.price); break;
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      default: break;
    }

    return list;
  }, [activeCategory, activeSort]);

  const activeSortLabel = SORT_OPTIONS.find((o) => o.value === activeSort)?.label ?? "Featured";

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ─── Header ─── */}
      <div className="border-b border-border pt-24 pb-10 md:pt-32 md:pb-14">
        <div className="mx-auto max-w-[1600px] px-5 md:px-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            AW26 Collection
          </p>
          <h1 className="serif mt-3 text-5xl leading-tight text-ink md:text-7xl">
            The Shop.
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            {products.length} pieces. Considered once, made well, left alone.
          </p>
        </div>
      </div>

      {/* ─── Filters + Sort ─── */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 md:px-12">
          {/* Category tabs — horizontal scroll on mobile */}
          <div className="-mx-5 flex overflow-x-auto scrollbar-hide px-5 md:mx-0 md:gap-0 md:px-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`shrink-0 border-b-[1.5px] px-4 py-4 font-mono text-[10px] uppercase tracking-widest transition-colors duration-200 md:px-5 ${
                  activeCategory === cat.value
                    ? "border-ink text-ink"
                    : "border-transparent text-muted-foreground hover:text-ink"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative ml-4 shrink-0">
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
            )}
          </div>
        </div>
      </div>

      {/* ─── Product Grid ─── */}
      <div className="mx-auto max-w-[1600px] px-5 py-12 md:px-12 md:py-16">
        {filtered.length === 0 ? (
          <p className="py-24 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            No pieces in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {filtered.map((product, i) => (
              <Link
                key={product.id}
                to="/shop/$slug"
                params={{ slug: product.slug }}
                className="reveal group"
                style={{ transitionDelay: `${(i % 4) * 60}ms` }}
              >
                {/* Image */}
                <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    loading={i < 4 ? "eager" : "lazy"}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />

                  {/* Badge */}
                  {product.isSale ? (
                    <span className="absolute left-3 top-3 bg-clay px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-paper">
                      Sale
                    </span>
                  ) : product.isNew ? (
                    <span className="absolute left-3 top-3 border border-ink/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink/70 backdrop-blur-sm">
                      New In
                    </span>
                  ) : null}

                  {/* Wishlist button */}
                  <WishlistButton
                    productId={product.id}
                    className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  />

                  {/* Quick view CTA */}
                  <div className="absolute bottom-0 left-0 right-0 translate-y-full border-t border-ink/10 bg-background/90 py-3.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink backdrop-blur-sm transition-transform duration-300 ease-out group-hover:translate-y-0">
                    View piece
                  </div>
                </div>

                {/* Info */}
                <div className="mt-4 flex items-start justify-between">
                  <div>
                    <h3 className="relative inline-block serif text-[15px] text-ink after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 group-hover:after:scale-x-100">
                      {product.name}
                    </h3>
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      {product.colours.length} {product.colours.length === 1 ? "colour" : "colours"}
                    </p>
                  </div>
                  <div className="text-right">
                    {product.originalPrice && (
                      <p className="font-mono text-[10px] text-muted-foreground line-through">
                        €{product.originalPrice}
                      </p>
                    )}
                    <p className={`font-mono text-[12px] ${product.isSale ? "text-clay" : "text-ink/70"}`}>
                      €{product.price}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ─── Footer note ─── */}
      <div className="border-t border-border py-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
          All prices include VAT · Free shipping over €200 · Returns within 14 days
        </p>
      </div>

    </div>
  );
}
