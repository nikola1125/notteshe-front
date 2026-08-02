import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Intro } from "@/components/Intro";
import { WishlistButton } from "@/components/WishlistButton";
import { products as allProducts } from "@/data/products";
import hero from "@/assets/hero1.jpg";
import look1 from "@/assets/look1.jpg";
import look2 from "@/assets/look2.jpg";
import look3 from "@/assets/look3.jpg";
import philosophy from "@/assets/philosophy.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

const featuredProducts = allProducts.filter((p) => p.isNew).slice(0, 4);
const saleProducts = allProducts.filter((p) => p.isSale).slice(0, 4);

// Evaluated once when the JS bundle loads. On true reload this is false;
// on client-side back/forward navigation the module stays in memory so it
// stays true after the intro has played, preventing it from showing again.
const _navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
let _introShown = _navType !== "reload";

function Index() {
  const [introDone, setIntroDone] = useState(() => _introShown);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {!introDone && (
        <Intro onComplete={() => { _introShown = true; setIntroDone(true); }} />
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
          Considered essentials, cut for stillness —<br />
          <em className="italic text-clay">and one long refusal to shout.</em>
        </p>
        <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-8 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {["28 Pieces", "6 Mills", "IT · JP", "AW26"].map((s, i) => (
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
      <section id="shop" className="mx-auto mt-14 max-w-[1600px] px-5 md:mt-20 md:px-12">
        <div className="reveal mb-10 flex items-end justify-between md:mb-14">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">New Arrivals</p>
            <h2 className="serif mt-2 text-3xl leading-tight text-ink md:text-5xl">The permanent wardrobe.</h2>
          </div>
          <a href="#" className="relative hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-clay hover:after:scale-x-100 md:inline-block">
            View all — 28
          </a>
        </div>

        {/* Mobile: horizontal scroll · Desktop: grid */}
        <div
          className="-mx-5 flex gap-4 overflow-x-auto scroll-pl-5 px-5 pb-6 snap-x snap-mandatory scrollbar-hide overscroll-x-contain md:mx-0 md:grid md:grid-cols-4 md:gap-x-6 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:scroll-pl-0"
          style={{ touchAction: "pan-x pinch-zoom" }}
        >
          {featuredProducts.map((p, i) => (
            <Link
              key={p.id}
              to="/shop/$slug"
              params={{ slug: p.slug }}
              className="reveal group w-[68vw] shrink-0 snap-start md:w-auto md:shrink"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <img
                  src={p.images[0]}
                  alt={p.name}
                  width={900}
                  height={1200}
                  loading={i < 2 ? "eager" : "lazy"}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                />

                {/* Badge */}
                {p.isSale ? (
                  <span className="absolute left-3 top-3 bg-clay px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-paper">
                    Sale
                  </span>
                ) : p.isNew ? (
                  <span className="absolute left-3 top-3 border border-ink/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-ink/70 backdrop-blur-sm">
                    New In
                  </span>
                ) : null}

                {/* Wishlist */}
                <WishlistButton
                  productId={p.id}
                  className="absolute right-3 top-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                />

                {/* Hover CTA */}
                <div className="absolute bottom-0 left-0 right-0 translate-y-full border-t border-ink/10 bg-background/90 py-3.5 text-center font-mono text-[10px] uppercase tracking-widest text-ink backdrop-blur-sm transition-transform duration-300 ease-out group-hover:translate-y-0">
                  View piece
                </div>
              </div>

              <div className="mt-4 flex items-start justify-between">
                <div>
                  <h3 className="relative inline-block serif text-[15px] text-ink after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink after:transition-transform after:duration-300 group-hover:after:scale-x-100">{p.name}</h3>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    {p.colours.length} {p.colours.length === 1 ? "colour" : "colours"}
                  </p>
                </div>
                <div className="text-right">
                  {p.originalPrice && (
                    <p className="font-mono text-[10px] text-muted-foreground line-through">€{p.originalPrice}</p>
                  )}
                  <p className={`font-mono text-[12px] ${p.isSale ? "text-clay" : "text-ink/70"}`}>
                    €{p.price}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Lookbook ─── */}
      <section className="mt-20 md:mt-32">
        <div className="reveal mx-auto flex max-w-[1600px] items-end justify-between px-5 md:px-12">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">The Lookbook</p>
            <h2 className="serif mt-2 text-3xl leading-tight text-ink md:text-5xl">
              Stillness, <em className="italic text-clay">in motion.</em>
            </h2>
          </div>
          <a href="#" className="relative hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-clay hover:after:scale-x-100 md:inline-block">
            AW26 · 03 chapters →
          </a>
        </div>

        {/* Mobile: editorial masonry grid — all 3 images visible at once */}
        <div className="mt-8 grid grid-cols-[3fr_2fr] gap-2 px-5 md:hidden">
          {/* Left — large portrait spanning both rows */}
          <figure className="group row-span-2 flex cursor-pointer flex-col">
            <div className="min-h-0 flex-1 overflow-hidden bg-muted">
              <img
                src={look1}
                alt="Lookbook chapter one"
                width={1000}
                height={1400}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
              Ch. 01 — Threshold
            </p>
          </figure>

          {/* Top right */}
          <figure className="group cursor-pointer">
            <div className="aspect-[3/4] overflow-hidden bg-muted">
              <img
                src={look2}
                alt="Lookbook chapter two"
                width={1000}
                height={1400}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
              Ch. 02 — Corridor
            </p>
          </figure>

          {/* Bottom right */}
          <figure className="group cursor-pointer">
            <div className="aspect-[3/4] overflow-hidden bg-muted">
              <img
                src={look3}
                alt="Lookbook chapter three"
                width={1000}
                height={1400}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
              />
            </div>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
              Ch. 03 — Cuff
            </p>
          </figure>
        </div>

        {/* Desktop: staggered grid */}
        <div className="mx-auto mt-10 hidden max-w-[1600px] grid-cols-12 gap-5 px-12 md:grid">
          {[
            { src: look1, alt: "Lookbook chapter one",   cap: "Ch. 01 — Threshold", time: "04:12 pm", cls: "col-span-5",         delay: 0   },
            { src: look2, alt: "Lookbook chapter two",   cap: "Ch. 02 — Corridor",  time: "05:38 pm", cls: "col-span-4 mt-20",   delay: 80  },
            { src: look3, alt: "Lookbook chapter three", cap: "Ch. 03 — Cuff",      time: "06:04 pm", cls: "col-span-3 mt-8",    delay: 160 },
          ].map((img) => (
            <figure
              key={img.cap}
              className={`reveal group cursor-pointer ${img.cls}`}
              style={{ transitionDelay: `${img.delay}ms` }}
            >
              <div className="aspect-[3/4] overflow-hidden bg-muted">
                <img
                  src={img.src}
                  alt={img.alt}
                  width={1000}
                  height={1400}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>
              <figcaption className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                <span>{img.cap}</span>
                <span>{img.time}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ─── Sale ─── */}
      <section className="mx-auto mt-20 max-w-[1600px] px-5 md:mt-32 md:px-12">
        <div className="reveal mb-10 flex items-end justify-between md:mb-14">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-clay">End of Season Sale</p>
            <h2 className="serif mt-2 text-3xl leading-tight text-ink md:text-5xl">
              Up to <em className="italic text-clay">40%</em> off.
            </h2>
          </div>
          <a href="#" className="relative hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-clay hover:after:scale-x-100 md:inline-block">
            View all sale →
          </a>
        </div>

        {/* Mobile: horizontal scroll · Desktop: grid */}
        <div
          className="-mx-5 flex gap-4 overflow-x-auto scroll-pl-5 px-5 pb-6 snap-x snap-mandatory scrollbar-hide overscroll-x-contain md:mx-0 md:grid md:grid-cols-4 md:gap-x-6 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:scroll-pl-0"
          style={{ touchAction: "pan-x pinch-zoom" }}
        >
          {saleProducts.map((p, i) => (
            <Link
              key={p.id}
              to="/shop/$slug"
              params={{ slug: p.slug }}
              className="reveal group w-[68vw] shrink-0 snap-start md:w-auto md:shrink"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <img
                  src={p.images[0]}
                  alt={p.name}
                  width={900}
                  height={1200}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                />
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
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    {p.colours.length} {p.colours.length === 1 ? "colour" : "colours"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-muted-foreground line-through">€{p.originalPrice}</p>
                  <p className="font-mono text-[12px] text-clay">€{p.price}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Philosophy ─── */}
      <section className="mx-auto mt-20 max-w-[1600px] px-5 md:mt-32 md:px-12">
        <div className="grid grid-cols-12 gap-8 md:gap-12">
          <div className="reveal col-span-12 md:col-span-5">
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
          <div className="reveal col-span-12 flex flex-col justify-center md:col-span-7 md:pl-6 md:pt-6" style={{ transitionDelay: "100ms" }}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Philosophy</p>
            <p className="serif mt-6 text-2xl leading-[1.25] text-ink md:text-[2.8rem] md:leading-[1.1]">
              We believe <em className="italic text-clay">restraint</em> is the most radical thing a garment can wear.
            </p>
            <div className="mt-8 space-y-4 border-l-2 border-border pl-6">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                No trend cycles. No noise. Every piece is designed once, made well, and left alone to do its quiet work — season after season, drawer after drawer.
              </p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Fabric sourced from six mills across Italy and Japan. Cut in ateliers we visit ourselves. Sold slowly, and only when we are certain.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-3 divide-x divide-border border-t border-border pt-8">
              {[{ k: "Mills", v: "06" }, { k: "Seasons", v: "Two" }, { k: "Made in", v: "IT · JP" }].map((s) => (
                <div key={s.k} className="pl-6 first:pl-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.k}</p>
                  <p className="serif mt-2 text-2xl text-ink">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Newsletter ─── */}
      <section className="reveal mx-auto mt-20 max-w-[1600px] px-5 md:mt-40 md:px-12">
        <div className="grid grid-cols-12 items-end gap-10 border-t border-border pt-16">
          <div className="col-span-12 md:col-span-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Correspondence</p>
            <h2 className="serif mt-4 text-4xl leading-tight text-ink md:text-6xl">
              Join the <em className="italic text-clay">quiet</em> list.
            </h2>
            <p className="mt-5 max-w-md text-[13px] leading-relaxed text-muted-foreground">
              New arrivals, early access, and the occasional word from us. Sent no more than once a month. Nothing more.
            </p>
          </div>
          <form className="col-span-12 md:col-span-6">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Your address
            </label>
            <div className="mt-3 flex items-center gap-4 border-b border-ink/20 pb-3 transition-colors focus-within:border-ink/50">
              <input
                type="email"
                placeholder="you@somewhere.com"
                className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted-foreground/35"
              />
              <button
                type="submit"
                className="relative min-h-[44px] shrink-0 font-mono text-[10px] uppercase tracking-widest text-clay transition-colors duration-200 after:absolute after:bottom-[-3px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100"
              >
                Subscribe →
              </button>
            </div>
            <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              English · French · Japanese · No spam, ever.
            </p>
          </form>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="mt-20 border-t border-border md:mt-24">
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
            {[
              { title: "Shop",  links: ["New Arrivals", "Collection", "Lookbook", "Archive"] },
              { title: "House", links: ["Our Story", "Ateliers", "Sustainability", "Journal"] },
              { title: "Help",  links: ["Shipping", "Returns", "Size Guide", "Contact"] },
            ].map((c) => (
              <div key={c.title} className="col-span-4 md:col-span-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-5">{c.title}</p>
                <ul className="space-y-3">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="relative inline-block text-[13px] text-ink/55 transition-colors duration-200 after:absolute after:bottom-[-2px] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-clay after:transition-transform after:duration-300 hover:text-clay hover:after:scale-x-100">{l}</a>
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
