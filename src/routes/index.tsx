import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState, useRef } from "react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Intro } from "@/components/Intro";
import { cellSpanClass, cellAspectClass, rowDef, isStructured, type RowType } from "@/lib/homeLayout";
import { getLenis } from "@/hooks/useSmoothScroll";
import { WishlistButton } from "@/components/WishlistButton";
import { cldImg, cldSrcSet } from "@/lib/cldImage";
import { Price } from "@/components/Price";
import { db } from "@/db";
import { product, productImage, productColour, collection, homeCollections } from "@/db/schema";
import hero from "@/assets/hero1.jpg";
import philosophy from "@/assets/philosophy.jpg";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HomeProduct {
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

interface CollectionCell {
  id: string;
  name: string;
  slug: string;
  coverImage: string;
  caption: string;
  captionMeta: string;
}

interface HomeRowResolved {
  type: RowType;
  cells: (CollectionCell | null)[]; // positional; null = empty/removed collection
}

interface HomeData {
  wardrobe: HomeProduct[];
  wardrobeTotal: number;
  sale: HomeProduct[];
  homeRows: HomeRowResolved[];
}

// ─── Server function ──────────────────────────────────────────────────────────

const getHomeData = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> => {
  const database = db();

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
        isPermanentWardrobe: product.isPermanentWardrobe,
        wardrobeOrder: product.wardrobeOrder,
      })
      .from(product)
      .where(and(eq(product.isVisible, true), eq(product.inStock, true)))
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

  const toHomeProduct = (p: typeof prods[number]): HomeProduct => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    originalPrice: p.originalPrice != null ? Number(p.originalPrice) : null,
    isNew: p.isNew,
    isSale: p.isSale,
    coverImage: coverMap.get(p.id) ?? null,
    colourCount: colourMap.get(p.id) ?? 0,
  });

  const wardrobeAll = prods
    .filter((p) => p.isPermanentWardrobe)
    .sort((a, b) => (a.wardrobeOrder - b.wardrobeOrder) || ((b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)));

  // Landing collections composition — admin-controlled rows (falls back to the
  // legacy 3 slots). Wrapped defensively so the homepage renders pre-migration.
  let homeRows: HomeRowResolved[] = [];
  try {
    const homeConfigRows = await database
      .select()
      .from(homeCollections)
      .where(eq(homeCollections.id, "default"))
      .limit(1);
    const home = homeConfigRows[0];

    // Prefer the flexible layout; fall back to the old slot1/2/3 as one row.
    let rawRows: { type: string; items: (string | null)[] }[] =
      Array.isArray(home?.layout) ? (home!.layout as { type: string; items: (string | null)[] }[]) : [];
    if (rawRows.length === 0) {
      const slotIds = [home?.slot1CollectionId ?? null, home?.slot2CollectionId ?? null, home?.slot3CollectionId ?? null];
      if (slotIds.some(Boolean)) rawRows = [{ type: "three", items: slotIds }];
    }

    const ids = [...new Set(rawRows.flatMap((r) => r.items).filter((x): x is string => Boolean(x)))];
    if (ids.length > 0) {
      const cols = await database
        .select()
        .from(collection)
        .where(and(inArray(collection.id, ids), eq(collection.isVisible, true)));
      const byId = new Map(cols.map((c) => [c.id, c]));
      homeRows = rawRows
        .map((r) => ({
          type: r.type as RowType,
          cells: r.items.map((id) => {
            const c = id ? byId.get(id) : undefined;
            if (!c || !c.coverImageUrl) return null;
            return {
              id: c.id,
              name: c.name,
              slug: c.slug,
              coverImage: c.coverImageUrl,
              caption: c.homeCaption?.trim() || c.name,
              captionMeta: c.homeCaptionMeta?.trim() || "",
            };
          }),
        }))
        .filter((r) => r.cells.some(Boolean));
    }
  } catch {
    homeRows = [];
  }

  return {
    wardrobe: wardrobeAll.map(toHomeProduct),
    wardrobeTotal: wardrobeAll.length,
    sale: prods.filter((p) => p.isSale).slice(0, 4).map(toHomeProduct),
    homeRows,
  };
});

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/")({
  loader: () => getHomeData(),
  staleTime: 0,
  component: Index,
});

// The intro plays once per browser session (on first entry) and never again
// while browsing — including back/forward navigation. Persisted in
// sessionStorage so it survives both SPA navigation and full reloads.
const INTRO_KEY = "notteshe:intro-played";

// Permanent wardrobe: responsive grid (2 mobile → 4 desktop), paginated in place.
const WARDROBE_PER_PAGE = 8;

function CarouselArrows({ trackRef }: { trackRef: React.RefObject<HTMLDivElement | null> }) {
  function slide(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector("a, div") as HTMLElement | null;
    const cardWidth = card ? card.offsetWidth : 320;
    const gap = parseInt(getComputedStyle(track).gap) || 16;
    track.scrollBy({ left: dir * (cardWidth + gap), behavior: "smooth" });
  }
  return (
    <div className="hidden md:flex items-center gap-2">
      <button
        onClick={() => slide(-1)}
        className="flex h-9 w-9 items-center justify-center border border-border text-ink/60 transition-colors hover:border-ink hover:text-ink"
        aria-label="Previous"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M9 2 4 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={() => slide(1)}
        className="flex h-9 w-9 items-center justify-center border border-border text-ink/60 transition-colors hover:border-ink hover:text-ink"
        aria-label="Next"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M5 2l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// A single collection card. The name sits INSIDE the image (gradient overlay).
// `compact` scales the label down for small cells (e.g. the stacked pair).
function CollectionTile({ cell, imgClass, className, compact }: { cell: CollectionCell; imgClass: string; className?: string; compact?: boolean }) {
  return (
    <Link to="/collections/$slug" params={{ slug: cell.slug }} className={`reveal group block ${className ?? ""}`}>
      <div className={`relative overflow-hidden bg-muted ${imgClass}`}>
        <img
          src={cldImg(cell.coverImage, 900)}
          srcSet={cldSrcSet(cell.coverImage, 900)}
          alt={cell.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-background/85 via-background/15 to-transparent p-4 pt-14 md:p-5 md:pt-20">
          <div className="min-w-0">
            <p className={`serif leading-none text-ink ${compact ? "text-base md:text-2xl" : "text-xl md:text-2xl"}`}>{cell.caption}</p>
            {cell.captionMeta && (
              <p className={`mt-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-ink/55 ${compact ? "hidden md:block" : ""}`}>{cell.captionMeta}</p>
            )}
          </div>
          {/* Narrow cards (compact) show name only on mobile; full button on desktop. */}
          <span className={`shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-widest text-ink transition-opacity duration-200 group-hover:opacity-70 md:text-[10px] ${compact ? "hidden md:inline-flex" : "inline-flex"}`}>
            Shop collection <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// Wide card beside a column of two stacked cards that fill its height.
function StructuredRow({ row }: { row: HomeRowResolved }) {
  const wideFirst = row.type === "wide-stack";
  const wide = wideFirst ? row.cells[0] : row.cells[2];
  const top = wideFirst ? row.cells[1] : row.cells[0];
  const bottom = wideFirst ? row.cells[2] : row.cells[1];

  const wideCol = wideFirst ? "col-start-1" : "col-start-5";
  const stackCol = wideFirst ? "col-start-9" : "col-start-1";

  return (
    <div className="grid grid-cols-12 grid-rows-2 gap-3 md:gap-5">
      {wide && (
        <CollectionTile
          cell={wide}
          imgClass="flex-1 min-h-0"
          className={`col-span-8 row-span-2 row-start-1 ${wideCol} flex flex-col`}
        />
      )}
      {top && (
        <CollectionTile cell={top} imgClass="aspect-[3/4]" className={`col-span-4 row-start-1 ${stackCol}`} compact />
      )}
      {bottom && (
        <CollectionTile cell={bottom} imgClass="aspect-[3/4]" className={`col-span-4 row-start-2 ${stackCol}`} compact />
      )}
    </div>
  );
}

function Index() {
  const { wardrobe, wardrobeTotal, sale, homeRows } = Route.useLoaderData();
  const router = useRouter();
  // Default to "done" (no intro) so SSR and back/forward navigation never show
  // it; a first-entry check below opts in to playing it once per session.
  const [introDone, setIntroDone] = useState(true);
  const saleRef = useRef<HTMLDivElement>(null);
  const wardrobeSectionRef = useRef<HTMLElement>(null);
  const [wardrobePage, setWardrobePage] = useState(0);
  const wardrobePageCount = Math.max(1, Math.ceil(wardrobe.length / WARDROBE_PER_PAGE));
  const wardrobePageItems = wardrobe.slice(wardrobePage * WARDROBE_PER_PAGE, (wardrobePage + 1) * WARDROBE_PER_PAGE);

  function goToWardrobePage(page: number) {
    setWardrobePage(page);
    const el = wardrobeSectionRef.current;
    if (!el) return;
    // Lenis hijacks scrolling; use its scrollTo (offset clears the fixed header).
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(el, { offset: -90, duration: 0.8 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    let played = false;
    try { played = sessionStorage.getItem(INTRO_KEY) === "1"; } catch { /* storage blocked */ }
    const navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
    // Play only on a genuine first entry this session — not on back/forward.
    if (!played && navType !== "back_forward") {
      setIntroDone(false);
    } else {
      try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* storage blocked */ }
    }
  }, []);

  // Refetch when the tab regains focus/visibility (e.g. switching back from admin)
  // so wardrobe/collection order changes appear without a manual refresh.
  useEffect(() => {
    function refetch() {
      if (document.visibilityState === "visible") router.invalidate();
    }
    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("focus", refetch);
    window.addEventListener("pageshow", refetch);
    return () => {
      document.removeEventListener("visibilitychange", refetch);
      window.removeEventListener("focus", refetch);
      window.removeEventListener("pageshow", refetch);
    };
  }, [router]);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // Re-run when the wardrobe page changes so newly rendered cards get observed.
  }, [wardrobePage]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!introDone && (
        <Intro onComplete={() => { try { sessionStorage.setItem(INTRO_KEY, "1"); } catch { /* storage blocked */ } setIntroDone(true); }} />
      )}

      {/* ─── Hero ─── */}
      <section
        className="relative h-[100svh] w-full"
        style={{
          backgroundImage: `url(${hero})`,
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/60" />

        {/* Bottom overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-10 md:px-12 md:pb-16">
          <div className="flex items-end justify-between">
            <div className="space-y-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">
                New Season · Vol. 26
              </p>
              <a
                href="#shop"
                className="group inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink/70 transition hover:text-ink"
              >
                <span className="inline-block h-px w-5 bg-current transition-all duration-300 group-hover:w-8" />
                Shop the collection
              </a>
            </div>
            <h1 className="serif text-[15vw] leading-[0.82] tracking-tight text-ink md:text-[13vw] lg:text-[11vw]">
              Notteshe
            </h1>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 md:bottom-16">
          <div className="flex h-10 w-px flex-col items-center overflow-hidden">
            <div className="h-full w-px animate-[scroll-line_1.8s_ease-in-out_infinite] bg-ink/30" />
          </div>
        </div>
      </section>

      {/* ─── Manifesto ─── */}
      <section className="reveal border-y border-border/40 py-12 text-center md:py-20">
        <p className="serif mx-auto max-w-3xl px-8 text-2xl leading-[1.25] text-ink md:text-5xl md:leading-[1.1]">
          <em className="italic text-clay">— Grua e Fortë —</em>
        </p>
        <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-8 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {[`${wardrobeTotal} Pieces`, "Born in Albania", "Made to last", "Worn by the world"].map((s, i) => (
            <span key={s} className="flex items-center gap-5">
              {i > 0 && <span className="text-border">·</span>}
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Press ticker ─── */}
      <div className="border-y border-border py-4">
        <div className="flex overflow-hidden">
          <div className="marquee-track flex shrink-0 items-center gap-16 whitespace-nowrap pr-16 font-mono text-[10px] uppercase tracking-[0.28em] text-ink/40">
            {[...["Kinfolk", "The Cut", "Vogue", "Elle", "The Wall Street Journal", "Harper's Bazaar", "i-D", "Nylon"], ...["Kinfolk", "The Cut", "Vogue", "Elle", "The Wall Street Journal", "Harper's Bazaar", "i-D", "Nylon"]].map((t, i) => (
              <span key={i} className="flex items-center gap-16">
                {t}
                <span className="text-clay/50">◦</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Products ─── */}
      <section ref={wardrobeSectionRef} id="shop" className="mx-auto mt-16 max-w-[1600px] scroll-mt-24 px-5 md:mt-20 md:px-12">
        <div className="reveal mb-10 flex items-end justify-between md:mb-14">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">New Arrivals</p>
            <h2 className="serif mt-2 text-3xl leading-tight text-ink md:text-5xl">The permanent wardrobe.</h2>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/shop" search={{ sale: undefined }} className="relative hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-clay hover:after:scale-x-100 md:inline-block">
              View all — {wardrobeTotal}
            </Link>
          </div>
        </div>

        {wardrobe.length === 0 ? (
          <p className="py-16 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
            No pieces in the permanent wardrobe yet.
          </p>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
            {wardrobePageItems.map((p, i) => (
            <Link
              key={p.id}
              to="/shop/$slug"
              params={{ slug: p.slug }}
              className="reveal group"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                {p.coverImage ? (
                  <img
                    src={cldImg(p.coverImage, 420)}
                    srcSet={cldSrcSet(p.coverImage, 420)}
                    alt={p.name}
                    width={900}
                    height={1200}
                    loading={i < 2 ? "eager" : "lazy"}
                    draggable={false}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">No image</span>
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
                  <h3 className="relative inline-block serif text-[15px] text-ink after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 group-hover:after:scale-x-100">{p.name}</h3>
                  {p.colourCount > 0 && (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      {p.colourCount} {p.colourCount === 1 ? "colour" : "colours"}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {p.originalPrice && (
                    <p className="font-mono text-[10px] text-muted-foreground line-through"><Price value={p.originalPrice} /></p>
                  )}
                  <p className={`font-mono text-[12px] ${p.isSale ? "text-clay" : "text-ink/70"}`}>
                    <Price value={p.price} />
                  </p>
                </div>
              </div>
            </Link>
            ))}
          </div>

          {wardrobePageCount > 1 && (
            <div className="mt-12 flex items-center justify-center gap-3 md:mt-16">
              <button
                onClick={() => goToWardrobePage(Math.max(0, wardrobePage - 1))}
                disabled={wardrobePage === 0}
                aria-label="Previous page"
                className="flex h-9 w-9 items-center justify-center text-ink/60 transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-ink/60"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 2L4 6l4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {Array.from({ length: wardrobePageCount }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToWardrobePage(idx)}
                  aria-label={`Page ${idx + 1}`}
                  aria-current={idx === wardrobePage ? "true" : undefined}
                  className={`h-9 w-9 font-mono text-[11px] transition-colors ${idx === wardrobePage ? "text-ink underline underline-offset-4" : "text-muted-foreground/60 hover:text-ink"}`}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                onClick={() => goToWardrobePage(Math.min(wardrobePageCount - 1, wardrobePage + 1))}
                disabled={wardrobePage === wardrobePageCount - 1}
                aria-label="Next page"
                className="flex h-9 w-9 items-center justify-center text-ink/60 transition-colors hover:text-ink disabled:opacity-30 disabled:hover:text-ink/60"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          )}
          </>
        )}
      </section>

      {/* ─── Collections (admin-controlled row layout) ─── */}
      {homeRows.length > 0 && (
        <section className="mt-16 md:mt-32">
          <div className="reveal mx-auto flex max-w-[1600px] items-end justify-between px-5 md:px-12">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">The Lookbook</p>
              <h2 className="serif mt-2 text-3xl leading-tight text-ink md:text-5xl">
                Stillness, <em className="italic text-clay">in motion.</em>
              </h2>
            </div>
            <Link to="/collections" className="relative hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-clay hover:after:scale-x-100 md:inline-block">
              View all →
            </Link>
          </div>

          <div className="mx-auto mt-8 max-w-[1600px] space-y-4 px-5 md:mt-10 md:space-y-5 md:px-12">
            {homeRows.map((row, ri) => {
              if (isStructured(row.type)) return <StructuredRow key={ri} row={row} />;
              const def = rowDef(row.type);
              return (
                <div key={ri} className="grid grid-cols-12 gap-4 md:gap-5">
                  {row.cells.map((cell, ci) =>
                    cell ? (
                      <CollectionTile
                        key={cell.id}
                        cell={cell}
                        imgClass={cellAspectClass(row.type, ci)}
                        className={cellSpanClass(row.type, ci)}
                        compact={(def.mobile[ci] ?? 12) <= 4}
                      />
                    ) : null
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Sale ─── */}
      <section className="mx-auto mt-16 max-w-[1600px] px-5 md:mt-32 md:px-12">
        <div className="reveal mb-10 flex items-end justify-between md:mb-14">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-clay">End of Season Sale</p>
            <h2 className="serif mt-2 text-3xl leading-tight text-ink md:text-5xl">
              Up to <em className="italic text-clay">40%</em> off.
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="relative hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-clay hover:after:scale-x-100 md:inline-block">
              View all sale →
            </a>
            <CarouselArrows trackRef={saleRef} />
          </div>
        </div>

        <div
          ref={saleRef}
          className="-mx-5 flex gap-4 overflow-x-auto overflow-y-hidden scroll-pl-5 px-5 pb-6 snap-x snap-mandatory scrollbar-hide overscroll-x-contain md:-mx-12 md:scroll-pl-12 md:px-12 md:pb-8 md:overflow-x-hidden"
        >
          {sale.length === 0 ? (
            <p className="col-span-4 py-16 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              No sale items right now.
            </p>
          ) : sale.map((p, i) => (
            <Link
              key={p.id}
              to="/shop/$slug"
              params={{ slug: p.slug }}
              className="reveal group w-[68vw] shrink-0 snap-start md:w-[22vw] md:max-w-[320px]"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                {p.coverImage ? (
                  <img
                    src={cldImg(p.coverImage, 420)}
                    srcSet={cldSrcSet(p.coverImage, 420)}
                    alt={p.name}
                    width={900}
                    height={1200}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">No image</span>
                  </div>
                )}
                <span className="absolute left-3 top-3 bg-clay px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-paper">
                  Sale
                </span>
                <div className="absolute bottom-0 left-0 right-0 translate-y-full border-t border-ink/10 bg-background/90 py-3.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink backdrop-blur-sm transition-transform duration-300 ease-out group-hover:translate-y-0">
                  View piece
                </div>
              </div>
              <div className="mt-4 flex items-start justify-between">
                <div>
                  <h3 className="relative inline-block serif text-[15px] text-ink after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 group-hover:after:scale-x-100">{p.name}</h3>
                  {p.colourCount > 0 && (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                      {p.colourCount} {p.colourCount === 1 ? "colour" : "colours"}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {p.originalPrice && (
                    <p className="font-mono text-[10px] text-muted-foreground line-through"><Price value={p.originalPrice} /></p>
                  )}
                  <p className="font-mono text-[12px] text-clay"><Price value={p.price} /></p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Philosophy ─── */}
      <section className="mx-auto mt-16 max-w-[1600px] px-5 md:mt-32 md:px-12">
        {/* Mobile: heading shown above the image */}
        <div className="mb-6 md:hidden">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Philosophy</p>
          <p className="serif mt-4 text-2xl leading-[1.25] text-ink">
            Notteshe — <em className="italic text-clay">Grua e Fortë.</em>
          </p>
        </div>

        <div className="grid grid-cols-12 gap-8 md:gap-12">
          <div className="col-span-12 md:col-span-5">
            <div className="aspect-[3/4] overflow-hidden bg-muted md:aspect-[4/5] md:sticky md:top-24">
              <img
                src={philosophy}
                alt="Notteshe atelier"
                width={1400}
                height={1000}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="col-span-12 flex flex-col justify-center md:col-span-7 md:pl-6 md:pt-6">
            {/* Desktop: heading inside the grid */}
            <p className="hidden md:block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Philosophy</p>
            <p className="hidden md:block serif mt-6 text-[2.8rem] leading-[1.1] text-ink">
              Notteshe — <em className="italic text-clay">Grua e Fortë.</em>
            </p>
            <p className="mt-8 text-[13px] leading-relaxed text-muted-foreground border-l-2 border-clay pl-5">
              Quiet, certain, unbreakable. We design for the woman who moves through a room and leaves something behind — not to be seen, but because she sees herself.
            </p>
            <div className="mt-10 flex flex-col gap-3">
              <p className="serif text-xl text-ink md:text-2xl">Born in Albania. Worn by the world.</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">This is not fashion. This is identity.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="mt-16 border-t border-border md:mt-24">
        <div className="mx-auto max-w-[1600px] px-5 py-12 md:px-12 md:py-16">
          <div className="grid grid-cols-12 gap-8 md:gap-10">
            <div className="col-span-12 md:col-span-4">
              <div className="serif text-3xl text-ink">Notteshe<span className="text-clay">.</span></div>
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground/70">
                Quiet clothes for loud lives. Designed in Milan, made across Italy and Japan.
              </p>
              <div className="mt-6 flex gap-5">
                {["Instagram", "Substack"].map((s) => (
                  <a key={s} href="#" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 transition hover:text-clay">
                    {s}
                  </a>
                ))}
              </div>
            </div>
            {([
              { title: "Shop",  links: [{ label: "Shop all", to: "/shop" }, { label: "Sale", to: "/shop", search: { sale: "1" } }, { label: "Collections", to: "/collections" }] },
              { title: "House", links: [{ label: "Our Story", to: "/about" }, { label: "Contact", to: "/contact" }, { label: "FAQ", to: "/faq" }] },
              { title: "Help",  links: [{ label: "Shipping", to: "/shipping" }, { label: "Exchanges", to: "/exchanges" }, { label: "Size Guide", to: "/size-guide" }] },
            ] as const).map((c) => (
              <div key={c.title} className="col-span-4 md:col-span-2">
                <p className="mb-5 inline-block border-b border-border pb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{c.title}</p>
                <ul className="space-y-3">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <Link to={l.to} search={("search" in l ? l.search : undefined) as any} className="relative inline-block text-[13px] text-ink/55 transition-colors duration-200 after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-clay hover:after:scale-x-100">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
              © 2026 Notteshe — All rights reserved
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
              Privacy · Terms · Cookies
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
              Ref. NTS/26 · v.1.0
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
