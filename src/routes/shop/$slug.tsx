import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { getProductBySlug } from "@/data/products";
import { WishlistButton } from "@/components/WishlistButton";
import { useCart } from "@/store/cartStore";

export const Route = createFileRoute("/shop/$slug")({
  component: ProductPage,
  loader: ({ params }) => {
    const product = getProductBySlug(params.slug);
    if (!product) throw notFound();
    return product;
  },
});

const SIZE_GUIDE = [
  { size: "XS", chest: "80–84", waist: "60–64", hips: "86–90" },
  { size: "S",  chest: "84–88", waist: "64–68", hips: "90–94" },
  { size: "M",  chest: "88–93", waist: "68–73", hips: "94–99" },
  { size: "L",  chest: "93–98", waist: "73–78", hips: "99–104" },
  { size: "XL", chest: "98–104", waist: "78–84", hips: "104–110" },
];

function SizeGuideModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[95] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 bg-background px-6 py-8 shadow-2xl md:px-10 md:py-10">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Notteshe</p>
            <h2 className="serif mt-1 text-2xl text-ink">Size guide</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center text-ink/40 hover:text-ink transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>

        <p className="mb-5 text-[12px] leading-relaxed text-muted-foreground">
          All measurements in centimetres. Measure your body, not your clothing.
        </p>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              {["Size", "Chest", "Waist", "Hips"].map((h) => (
                <th key={h} className="pb-3 text-left font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZE_GUIDE.map((row, i) => (
              <tr key={row.size} className={`border-b border-border/40 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                <td className="py-3 font-mono text-[12px] font-medium text-ink">{row.size}</td>
                <td className="py-3 font-mono text-[12px] text-muted-foreground">{row.chest}</td>
                <td className="py-3 font-mono text-[12px] text-muted-foreground">{row.waist}</td>
                <td className="py-3 font-mono text-[12px] text-muted-foreground">{row.hips}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 space-y-2 border-t border-border pt-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">How to measure</p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="text-ink">Chest —</span> measure around the fullest part, keeping the tape horizontal.
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="text-ink">Waist —</span> measure around your natural waist, above the hip bone.
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            <span className="text-ink">Hips —</span> measure around the fullest part of your hips.
          </p>
        </div>

        <p className="mt-5 font-mono text-[9px] text-muted-foreground/50">
          Between sizes? We recommend sizing up for a relaxed fit.
        </p>
      </div>
    </>
  );
}

function ProductPage() {
  const product = Route.useLoaderData();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColour, setSelectedColour] = useState(product.colours[0].name);
  const [sizeError, setSizeError] = useState(false);
  const [added, setAdded] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollTo(i: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.offsetWidth * i, behavior: "smooth" });
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.offsetWidth);
    setActiveImage(i);
  }

  function handleAddToBag() {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.images[0],
      size: selectedSize,
      colour: selectedColour,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {sizeGuideOpen && <SizeGuideModal onClose={() => setSizeGuideOpen(false)} />}

      {/* Back + Breadcrumb */}
      <div className="mx-auto max-w-[1600px] px-5 pt-24 md:px-12 md:pt-32">
        <div className="flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M9 2 4 7l5 5" />
            </svg>
            Back
          </button>

          <nav className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:flex">
            <Link to="/" className="hover:text-ink transition-colors">Home</Link>
            <span>/</span>
            <Link to="/shop/" className="hover:text-ink transition-colors">Shop</Link>
            <span>/</span>
            <span className="text-ink">{product.name}</span>
          </nav>
        </div>
      </div>

      {/* ─── Main layout ─── */}
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-10 px-5 pt-8 pb-20 md:grid-cols-2 md:gap-16 md:px-12 md:pt-12 lg:grid-cols-[1fr_480px]">

        {/* ── Images ── */}
        <div className="flex flex-col gap-3 md:flex-row">
          {/* Thumbnails — desktop only */}
          {product.images.length > 1 && (
            <div className="hidden flex-col gap-2 md:flex">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  className={`h-20 w-16 overflow-hidden border transition-all duration-200 ${
                    activeImage === i ? "border-ink/50" : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Scroll gallery */}
          <div className="relative flex-1 overflow-hidden">
            {/* Badge */}
            <div className="absolute left-4 top-4 z-10">
              {product.isSale ? (
                <span className="bg-clay px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-paper">
                  Sale
                </span>
              ) : product.isNew ? (
                <span className="border border-ink/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink/70 backdrop-blur-sm">
                  New In
                </span>
              ) : null}
            </div>

            {/* Image counter — desktop only */}
            {product.images.length > 1 && (
              <div className="absolute bottom-3 right-3 z-10 hidden bg-background/70 px-2 py-1 backdrop-blur-sm font-mono text-[9px] text-ink/60 md:block">
                {activeImage + 1} / {product.images.length}
              </div>
            )}

            {/* Scrollable strip */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex aspect-[3/4] snap-x snap-mandatory overflow-x-auto scroll-smooth scrollbar-hide"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {product.images.map((img, i) => (
                <div key={i} className="relative w-full shrink-0 snap-start bg-muted" style={{ scrollSnapAlign: "start" }}>
                  <img
                    src={img}
                    alt={`${product.name} — view ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Mobile dot indicators */}
          {product.images.length > 1 && (
            <div className="flex justify-center gap-2 md:hidden">
              {product.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    activeImage === i ? "w-6 bg-ink" : "w-1.5 bg-ink/25"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Product info ── */}
        <div className="flex flex-col">
          {/* Category + wishlist */}
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {product.category} · {product.collection}
            </p>
            <WishlistButton productId={product.id} className="h-10 w-10" />
          </div>

          <h1 className="serif mt-3 text-4xl leading-tight text-ink md:text-5xl">
            {product.name}
          </h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className={`font-mono text-[18px] ${product.isSale ? "text-clay" : "text-ink"}`}>
              €{product.price}
            </span>
            {product.originalPrice && (
              <span className="font-mono text-[13px] text-muted-foreground line-through">
                €{product.originalPrice}
              </span>
            )}
          </div>

          <div className="my-6 h-px bg-border" />

          {/* Colour */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Colour — <span className="text-ink">{selectedColour}</span>
            </p>
            <div className="mt-3 flex gap-2.5">
              {product.colours.map((colour) => (
                <button
                  key={colour.name}
                  onClick={() => setSelectedColour(colour.name)}
                  title={colour.name}
                  className={`h-6 w-6 rounded-full border-2 transition-all duration-200 ${
                    selectedColour === colour.name
                      ? "border-ink scale-110"
                      : "border-transparent hover:border-ink/40"
                  }`}
                  style={{ backgroundColor: colour.hex, outline: "1px solid rgba(255,255,255,0.12)" }}
                />
              ))}
            </div>
          </div>

          {/* Size */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className={`font-mono text-[10px] uppercase tracking-widest ${sizeError ? "text-clay" : "text-muted-foreground"}`}>
                {sizeError ? "Please select a size" : "Size"}
              </p>
              <button
                onClick={() => setSizeGuideOpen(true)}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground underline underline-offset-2 hover:text-ink transition-colors"
              >
                Size guide
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.sizes.map((size) => (
                <button
                  key={size.label}
                  disabled={!size.available}
                  onClick={() => { setSelectedSize(size.label); setSizeError(false); }}
                  className={`min-w-[48px] border px-3 py-2.5 font-mono text-[11px] uppercase tracking-widest transition-all duration-150 ${
                    !size.available
                      ? "cursor-not-allowed border-border/40 text-muted-foreground/30 line-through"
                      : selectedSize === size.label
                      ? "border-ink bg-ink text-background"
                      : "border-border text-ink/70 hover:border-ink hover:text-ink"
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add to bag */}
          <button
            onClick={handleAddToBag}
            className={`mt-6 w-full py-4 font-mono text-[11px] uppercase tracking-widest transition-all duration-300 ${
              added
                ? "bg-muted text-muted-foreground"
                : "bg-ink text-background hover:bg-ink/90"
            }`}
          >
            {added ? "Added to bag ✓" : "Add to bag"}
          </button>

          <div className="my-8 h-px bg-border" />

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          <details className="group mt-6 border-t border-border">
            <summary className="flex cursor-pointer items-center justify-between py-4 font-mono text-[10px] uppercase tracking-widest text-ink/70 hover:text-ink">
              Details & care
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="transition-transform duration-200 group-open:rotate-45">
                <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1" />
                <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
              </svg>
            </summary>
            <ul className="space-y-2 pb-6">
              {product.details.map((d) => (
                <li key={d} className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 h-px w-3 shrink-0 bg-border" />
                  {d}
                </li>
              ))}
            </ul>
          </details>

          <details className="group border-t border-border">
            <summary className="flex cursor-pointer items-center justify-between py-4 font-mono text-[10px] uppercase tracking-widest text-ink/70 hover:text-ink">
              Shipping & returns
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="transition-transform duration-200 group-open:rotate-45">
                <line x1="6" y1="0" x2="6" y2="12" stroke="currentColor" strokeWidth="1" />
                <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1" />
              </svg>
            </summary>
            <div className="space-y-2 pb-6 text-[12px] leading-relaxed text-muted-foreground">
              <p>Free shipping on orders over €200.</p>
              <p>Standard delivery 3–5 working days. Express available at checkout.</p>
              <p>Returns accepted within 14 days of delivery. Items must be unworn and in original packaging.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
