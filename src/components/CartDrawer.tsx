import { useEffect, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useCart } from "@/store/cartStore";

interface FlyState {
  src: string;
  fromX: number;
  fromY: number;
  fromSize: number;
  toX: number;
  toY: number;
  phase: "start" | "fly";
}

// Fetch live stock for a list of (productId, sizeLabel) pairs
const getLiveCartData = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ items: z.array(z.object({ productId: z.string(), size: z.string() })) }).parse(d)
  )
  .handler(async ({ data }) => {
    if (data.items.length === 0) return { sizes: [], prices: [] };
    const { db } = await import("@/db");
    const { productSize, product } = await import("@/db/schema");
    const { inArray } = await import("drizzle-orm");

    const productIds = [...new Set(data.items.map((i) => i.productId))];

    const [sizeRows, priceRows] = await Promise.all([
      db()
        .select({ productId: productSize.productId, label: productSize.label, stock: productSize.stock })
        .from(productSize)
        .where(inArray(productSize.productId, productIds)),
      db()
        .select({ id: product.id, price: product.price, originalPrice: product.originalPrice, isSale: product.isSale })
        .from(product)
        .where(inArray(product.id, productIds)),
    ]);

    return {
      sizes: sizeRows.map((r) => ({ productId: r.productId, size: r.label, stock: r.stock })),
      prices: priceRows.map((p) => ({
        id: p.id,
        price: p.price ?? 0,
        originalPrice: p.isSale ? p.originalPrice : null,
      })),
    };
  });

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, addItem, setPendingFly, flyNow } = useCart();
  const navigate = useNavigate();
  const [fly, setFly] = useState<FlyState | null>(null);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [priceUpdated, setPriceUpdated] = useState(false);
  const lastFetchRef = useRef<string>("");

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  function syncCartData(force = false) {
    const { items: currentItems } = useCart.getState();
    if (currentItems.length === 0) return;
    const key = currentItems.map((i) => `${i.productId}:${i.size}`).join(",");
    if (!force && key === lastFetchRef.current) return;
    lastFetchRef.current = key;

    getLiveCartData({ data: { items: currentItems.map((i) => ({ productId: i.productId, size: i.size })) } })
      .then(({ sizes, prices }) => {
        const stockM = new Map<string, number>();
        for (const r of sizes) stockM.set(`${r.productId}::${r.size}`, r.stock);
        setStockMap(stockM);

        // Update prices if changed
        let priceChanged = false;
        for (const item of currentItems) {
          const live = prices.find((p) => p.id === item.productId);
          if (live && (live.price !== item.price || live.originalPrice !== item.originalPrice)) {
            removeItem(item.id);
            addItem({ productId: item.productId, name: item.name, price: live.price, originalPrice: live.originalPrice, image: item.image, size: item.size, colour: item.colour, stock: item.stock });
            if (item.quantity > 1) updateQuantity(`${item.productId}-${item.size}-${item.colour}`, item.quantity - 1);
            priceChanged = true;
          }
        }
        if (priceChanged) setPriceUpdated(true);

        // Trim quantities exceeding live stock
        for (const item of currentItems) {
          const liveStock = stockM.get(`${item.productId}::${item.size}`) ?? 0;
          if (liveStock > 0 && item.quantity > liveStock) updateQuantity(item.id, liveStock - item.quantity);
          else if (liveStock === 0) removeItem(item.id);
        }
      })
      .catch(() => {});
  }

  // Sync on cart open
  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    syncCartData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Sync silently when user returns to tab
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") syncCartData(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const { pendingFly } = useCart.getState();

  // Immediate fly — cart stays closed, item animates straight to bag icon
  useEffect(() => {
    if (!flyNow) return;
    const pf = useCart.getState().pendingFly;
    if (!pf) return;

    setPendingFly(null);
    useCart.setState({ flyNow: false });

    const cartBtn = document.querySelector<HTMLElement>('[aria-label="Bag"]');
    if (!cartBtn) return;

    const cRect = cartBtn.getBoundingClientRect();
    setFly({
      ...pf,
      toX: cRect.left + cRect.width / 2,
      toY: cRect.top + cRect.height / 2,
      phase: "start",
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFly((f) => f ? { ...f, phase: "fly" } : null);
      });
    });
    setTimeout(() => setFly(null), 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyNow]);

  function handleClose() {
    const pf = useCart.getState().pendingFly;
    closeCart();
    setPendingFly(null);

    if (!pf) return;

    const cartBtn = document.querySelector<HTMLElement>('[aria-label="Bag"]');
    if (!cartBtn) return;

    const cRect = cartBtn.getBoundingClientRect();
    const state: FlyState = {
      ...pf,
      toX: cRect.left + cRect.width / 2,
      toY: cRect.top + cRect.height / 2,
      phase: "start",
    };
    setFly(state);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFly((f) => f ? { ...f, phase: "fly" } : null);
      });
    });

    setTimeout(() => setFly(null), 800);
  }

  return (
    <>
      {/* Fly-to-cart overlay */}
      {fly && (
        <div
          className="pointer-events-none fixed z-[200] overflow-hidden rounded-sm"
          style={{
            left: fly.phase === "fly" ? fly.toX - 10 : fly.fromX,
            top: fly.phase === "fly" ? fly.toY - 10 : fly.fromY,
            width: fly.phase === "fly" ? 20 : fly.fromSize,
            height: fly.phase === "fly" ? 20 : fly.fromSize,
            opacity: fly.phase === "fly" ? 0 : 1,
            transition: fly.phase === "fly"
              ? "left 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94), top 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94), width 0.65s ease, height 0.65s ease, opacity 0.3s ease 0.45s"
              : "none",
          }}
        >
          <img src={fly.src} className="h-full w-full object-cover" alt="" />
        </div>
      )}

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-background/60 backdrop-blur-sm transition-opacity duration-500"
        style={{ opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none" }}
        onClick={handleClose}
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
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center text-ink/50 hover:text-ink transition-colors"
            aria-label="Close bag"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>
        {priceUpdated && (
          <div className="flex items-center justify-between border-b border-clay/30 bg-clay/5 px-6 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-clay">Prices updated to reflect current offers</p>
            <button onClick={() => setPriceUpdated(false)} className="text-clay/60 hover:text-clay">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
              </svg>
            </button>
          </div>
        )}

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
              {items.map((item) => {
                const liveStock = stockMap.get(`${item.productId}::${item.size}`);
                const atMax = liveStock !== undefined && item.quantity >= liveStock;
                return (
                  <li key={item.id} className="flex gap-4 px-6 py-5">
                    {/* Image */}
                    <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden bg-muted">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="serif text-[15px] text-ink">{item.name}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                            {item.size} · {item.colour}
                          </p>
                          {liveStock !== undefined && liveStock <= 3 && (
                            <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-clay">
                              {liveStock === 0 ? "Out of stock" : `Only ${liveStock} left`}
                            </p>
                          )}
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
                        <div className="flex items-center border border-border">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="flex h-11 w-11 items-center justify-center text-ink/60 hover:text-ink transition-colors"
                          >
                            −
                          </button>
                          <span className="font-mono text-[12px] text-ink w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={atMax}
                            className="flex h-11 w-11 items-center justify-center text-ink/60 hover:text-ink transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          {item.originalPrice && (
                            <p className="font-mono text-[10px] text-muted-foreground line-through">
                              {item.originalPrice} €
                            </p>
                          )}
                          <p className={`font-mono text-[13px] ${item.originalPrice ? "text-clay" : "text-ink"}`}>
                            {(item.price * item.quantity).toFixed(0)} €
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
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
              <p className="serif text-xl text-ink">{total.toFixed(0)} €</p>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              Shipping calculated at checkout
            </p>
            <button
              onClick={() => { handleClose(); navigate({ to: "/checkout" }); }}
              className="w-full bg-ink py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90"
            >
              Checkout
            </button>
            <button
              onClick={handleClose}
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
