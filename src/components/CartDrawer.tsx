import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCart } from "@/store/cartStore";

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity } = useCart();
  const navigate = useNavigate();

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeCart(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeCart]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-background/60 backdrop-blur-sm transition-opacity duration-500"
        style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
        onClick={closeCart}
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-[95] flex h-full w-full max-w-[420px] flex-col bg-background shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]"
        style={{ transform: isOpen ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Your Bag
            </p>
            <p className="serif mt-0.5 text-xl text-ink">
              {count === 0 ? "Empty" : `${count} ${count === 1 ? "item" : "items"}`}
            </p>
          </div>
          <button
            onClick={closeCart}
            className="flex h-10 w-10 items-center justify-center text-ink/50 hover:text-ink transition-colors"
            aria-label="Close bag"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                Nothing here yet
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 px-6 py-5">
                  {/* Image */}
                  <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden bg-muted">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="serif text-[15px] text-ink">{item.name}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                          {item.size} · {item.colour}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="mt-0.5 text-muted-foreground/40 hover:text-ink transition-colors"
                        aria-label="Remove item"
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.1">
                          <line x1="1" y1="1" x2="10" y2="10" />
                          <line x1="10" y1="1" x2="1" y2="10" />
                        </svg>
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      {/* Quantity */}
                      <div className="flex items-center gap-3 border border-border">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="flex h-8 w-8 items-center justify-center text-ink/60 hover:text-ink transition-colors"
                        >
                          −
                        </button>
                        <span className="font-mono text-[12px] text-ink w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="flex h-8 w-8 items-center justify-center text-ink/60 hover:text-ink transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        {item.originalPrice && (
                          <p className="font-mono text-[10px] text-muted-foreground line-through">
                            €{item.originalPrice}
                          </p>
                        )}
                        <p className={`font-mono text-[13px] ${item.originalPrice ? "text-clay" : "text-ink"}`}>
                          €{(item.price * item.quantity).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border px-6 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Subtotal
              </p>
              <p className="serif text-xl text-ink">€{total.toFixed(0)}</p>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              Shipping calculated at checkout
            </p>
            <button
              onClick={() => { closeCart(); navigate({ to: "/checkout" }); }}
              className="w-full bg-ink py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90"
            >
              Checkout
            </button>
            <button
              onClick={closeCart}
              className="w-full py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-ink transition-colors"
            >
              Continue shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
