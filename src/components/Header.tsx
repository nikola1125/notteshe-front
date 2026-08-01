import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCart } from "@/store/cartStore";
import { useWishlist } from "@/store/wishlistStore";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openCart, items } = useCart();
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const wishlistCount = useWishlist((s) => s.ids.length);

  return (
    <header className="fixed top-0 z-50 w-full bg-background/50 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-2 md:px-12 md:py-4">
        {/* Logo */}
        <Link to="/" className="serif text-[17px] tracking-tight text-ink">
          Notteshe<span className="text-clay">.</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-10 md:flex">
          <Link
            to="/shop/"
            className="relative text-[14px] text-ink/75 transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100"
          >
            Shop
          </Link>
          {["Sale", "Lookbook", "Story", "Contact"].map((l) => (
            <a
              key={l}
              href="#"
              className={`relative text-[14px] transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:transition-transform after:duration-300 hover:after:scale-x-100 ${
                l === "Sale"
                  ? "text-clay after:bg-clay hover:text-clay/80"
                  : "text-ink/75 after:bg-ink hover:text-ink"
              }`}
            >
              {l}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center">
          {/* Search */}
          <button
            className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink/75 transition-colors duration-200 hover:text-ink md:w-auto md:px-2"
            aria-label="Search"
          >
            <svg className="md:hidden" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="relative hidden text-[14px] after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 hover:after:scale-x-100 md:inline">
              Search
            </span>
          </button>

          {/* Wishlist */}
          <Link
            to="/wishlist"
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center text-ink/75 transition-colors duration-200 hover:text-clay md:w-auto md:px-2"
            aria-label="Wishlist"
          >
            <svg
              width="17" height="17" viewBox="0 0 24 24"
              fill={wishlistCount > 0 ? "currentColor" : "none"}
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className={wishlistCount > 0 ? "text-clay" : ""}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {wishlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-clay font-mono text-[9px] text-paper md:-right-1 md:-top-1">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Bag */}
          <button
            onClick={openCart}
            className="relative flex h-11 w-11 cursor-pointer items-center justify-center text-ink/75 transition-colors duration-200 hover:text-ink md:w-auto md:px-2"
            aria-label="Bag"
          >
            <svg className="md:hidden" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="relative hidden text-[14px] after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 hover:after:scale-x-100 md:inline">
              Bag{" "}
              <span className="text-muted-foreground">({cartCount})</span>
            </span>
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink font-mono text-[9px] text-background md:hidden">
                {cartCount}
              </span>
            )}
          </button>

          {/* Hamburger — mobile only */}
          <button
            className="flex h-11 w-11 cursor-pointer flex-col items-center justify-center gap-[5px] md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className={`block h-px w-5 bg-ink/80 transition-all duration-300 origin-center ${menuOpen ? "translate-y-[5px] rotate-45" : ""}`} />
            <span className={`block h-px w-5 bg-ink/80 transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block h-px w-5 bg-ink/80 transition-all duration-300 origin-center ${menuOpen ? "-translate-y-[5px] -rotate-45" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mx-5 border-b border-border/40 md:mx-12" />

      {/* Mobile dropdown */}
      <div
        className="overflow-hidden transition-[max-height] duration-500 ease-in-out md:hidden"
        style={{ maxHeight: menuOpen ? "360px" : "0px" }}
      >
        <nav className="flex flex-col gap-0 bg-background/95 px-5 pb-5 pt-3">
          <Link
            to="/shop/"
            onClick={() => setMenuOpen(false)}
            className="border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink"
          >
            Shop
          </Link>
          {["Sale", "Lookbook", "Story", "Contact"].map((l) => (
            <a
              key={l}
              href="#"
              onClick={() => setMenuOpen(false)}
              className={`border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] transition-colors ${
                l === "Sale" ? "text-clay" : "text-ink/70 hover:text-ink"
              }`}
            >
              {l}
            </a>
          ))}
          <a
            href="#"
            onClick={() => setMenuOpen(false)}
            className="pt-4 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 hover:text-ink"
          >
            Search
          </a>
        </nav>
      </div>
    </header>
  );
}
