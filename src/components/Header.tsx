import { Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { useCart } from "@/store/cartStore";
import { useWishlist } from "@/store/wishlistStore";
import { useAuthStore } from "@/store/authStore";
import { useSession, signOut } from "@/lib/auth/client";
import { SearchOverlay } from "@/components/SearchOverlay";

export function Header() {
  const location = useLocation();
  const isSale = location.pathname === "/shop" && (location.search as Record<string, string>)["sale"] === "1";
  const isShop = location.pathname.startsWith("/shop") && !isSale;
  const isCollections = location.pathname.startsWith("/collections");
  const isStory = location.pathname === "/about";
  const isContact = location.pathname === "/contact";

  const [menuOpen, setMenuOpen] = useState(false);
  const [badgeBounce, setBadgeBounce] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { openCart, items } = useCart();
  const { openAuthModal } = useAuthStore();
  const { data: session } = useSession();
  const cartCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const prevCount = useRef(cartCount);

  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBadgeBounce(true);
      const t = setTimeout(() => setBadgeBounce(false), 500);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  // Close both dropdowns on any scroll
  useEffect(() => {
    function onScroll() {
      setMenuOpen(false);
      setUserMenuOpen(false);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
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
            to="/shop"
            search={{ sale: undefined }}
            className={`relative text-[14px] transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:bg-ink after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100 ${isShop ? "text-ink after:scale-x-100" : "text-ink/75 after:scale-x-0"}`}
          >
            Shop
          </Link>
          <Link to="/shop" // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search={(() => ({ sale: "1" })) as any} className={`relative text-[14px] text-clay after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:bg-clay after:transition-transform after:duration-300 hover:text-clay/80 hover:after:scale-x-100 ${isSale ? "after:scale-x-100" : "after:scale-x-0"}`}>Sale</Link>
          <Link to="/collections" className={`relative text-[14px] after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:bg-ink after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100 ${isCollections ? "text-ink after:scale-x-100" : "text-ink/75 after:scale-x-0"}`}>Collections</Link>
          <Link to="/about" className={`relative text-[14px] after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:bg-ink after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100 ${isStory ? "text-ink after:scale-x-100" : "text-ink/75 after:scale-x-0"}`}>Story</Link>
          <Link to="/contact" className={`relative text-[14px] after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:bg-ink after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100 ${isContact ? "text-ink after:scale-x-100" : "text-ink/75 after:scale-x-0"}`}>Contact</Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center">
          {/* Account — desktop only (mobile access moved into the menu) */}
          <div className="relative hidden md:block" onMouseLeave={() => setUserMenuOpen(false)}>
            {session?.user ? (
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink/75 transition-colors duration-200 hover:text-ink md:w-auto md:px-2"
                aria-label="Account"
              >
                <svg className="md:hidden" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="relative hidden text-[14px] md:inline">
                  {session.user.name?.split(" ")[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={() => openAuthModal("login")}
                className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink/75 transition-colors duration-200 hover:text-ink md:w-auto md:px-2"
                aria-label="Sign in"
              >
                <svg className="md:hidden" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="relative hidden text-[14px] after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 hover:after:scale-x-100 md:inline">
                  Sign in
                </span>
              </button>
            )}

            {/* User dropdown */}
            {userMenuOpen && session?.user && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-48 border border-border bg-background py-2 shadow-lg">
                  <div className="border-b border-border px-4 pb-2">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Signed in as</p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-ink">{session.user.email}</p>
                  </div>
                  <Link
                    to="/account/orders"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors hover:text-ink"
                  >
                    My orders
                  </Link>
                  <Link
                    to="/wishlist"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors hover:text-ink"
                  >
                    Saved items
                  </Link>
                  <button
                    onClick={async () => { await signOut(); setUserMenuOpen(false); }}
                    className="block w-full px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-ink/70 transition-colors hover:text-ink"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Search — after the name on desktop; first icon on mobile */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center text-ink/75 transition-colors duration-200 hover:text-ink md:w-auto md:px-2"
            aria-label="Search"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
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
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink font-mono text-[9px] text-background md:hidden"
                style={badgeBounce ? { animation: "cart-badge-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" } : undefined}
              >
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

      {/* Mobile menu backdrop */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)} />
      )}

      {/* Mobile dropdown */}
      <div
        className="relative z-50 overflow-hidden transition-[max-height] duration-500 ease-in-out md:hidden"
        style={{ maxHeight: menuOpen ? "420px" : "0px" }}
      >
        <nav className="flex flex-col gap-0 bg-background/95 px-5 pb-5 pt-3">
          <Link
            to="/shop"
            search={{ sale: undefined }}
            onClick={() => setMenuOpen(false)}
            className="border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink"
          >
            Shop
          </Link>
          <Link to="/shop" // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search={(() => ({ sale: "1" })) as any} onClick={() => setMenuOpen(false)} className="border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-clay transition-colors">Sale</Link>
          <Link to="/collections" onClick={() => setMenuOpen(false)} className="border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink">Collections</Link>
          <Link to="/about" onClick={() => setMenuOpen(false)} className="border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink">Story</Link>
          <Link to="/contact" onClick={() => setMenuOpen(false)} className="border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink">Contact</Link>

          {/* Profile — at the end of the menu on mobile */}
          {session?.user ? (
            <>
              <Link to="/account/orders" onClick={() => setMenuOpen(false)} className="border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink">My orders</Link>
              <Link to="/wishlist" onClick={() => setMenuOpen(false)} className="border-b border-border/30 py-4 font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink">Saved items</Link>
              <button
                onClick={async () => { await signOut(); setMenuOpen(false); }}
                className="py-4 text-left font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink"
              >
                Sign out — {session.user.name?.split(" ")[0]}
              </button>
            </>
          ) : (
            <button
              onClick={() => { openAuthModal("login"); setMenuOpen(false); }}
              className="py-4 text-left font-mono text-[11px] uppercase tracking-[0.25em] text-ink/70 transition-colors hover:text-ink"
            >
              Sign in
            </button>
          )}
        </nav>
      </div>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
