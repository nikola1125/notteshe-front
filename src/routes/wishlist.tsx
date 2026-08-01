import { createFileRoute, Link } from "@tanstack/react-router";
import { useWishlist } from "@/store/wishlistStore";
import { WishlistButton } from "@/components/WishlistButton";
import { products } from "@/data/products";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const ids = useWishlist((s) => s.ids);
  const saved = products.filter((p) => ids.includes(p.id));

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Page header */}
      <div className="border-b border-border pt-24 pb-10 md:pt-32 md:pb-14">
        <div className="mx-auto max-w-[1600px] px-5 md:px-12">
          <button
            onClick={() => window.history.back()}
            className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-ink"
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
              to="/shop/"
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink underline underline-offset-4"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {saved.map((product) => (
              <div key={product.id} className="group relative">
                <Link
                  to="/shop/$slug"
                  params={{ slug: product.slug }}
                  className="block"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                    />

                    {product.isSale ? (
                      <span className="absolute left-3 top-3 bg-clay px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-paper">
                        Sale
                      </span>
                    ) : product.isNew ? (
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
                        {product.name}
                      </h3>
                      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                        {product.category}
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

                {/* Wishlist toggle — always visible here so they can unsave */}
                <WishlistButton
                  productId={product.id}
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
