import { createFileRoute } from "@tanstack/react-router";
import aboutHero from "@/assets/about-hero.jpg";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="bg-background text-ink">

      {/* ── 1. CINEMATIC OPENER ──────────────────────────────────────── */}
      <section className="relative h-screen w-full overflow-hidden">
        <img
          src={aboutHero}
          alt="Notteshe"
          className="h-full w-full object-cover object-center scale-[1.02]"
        />
        {/* deep vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

        {/* top-left label */}
        <p className="absolute left-8 top-8 font-mono text-[9px] uppercase tracking-[0.4em] text-white/40 md:left-14 md:top-12">
          Our Story — Est. 2024
        </p>

        {/* bottom copy */}
        <div className="absolute bottom-0 left-0 w-full px-8 pb-14 md:px-14 md:pb-20">
          <h1 className="serif text-5xl font-light leading-[1.05] text-white md:text-7xl lg:text-[6rem]">
            Rooted in craft,<br />dressed in night.
          </h1>
          <p className="mt-5 max-w-sm text-[13px] font-light leading-relaxed text-white/50 md:text-sm">
            A fashion house born in Tirana. Made for the world.
          </p>
        </div>
      </section>

      {/* ── 2. OPENING STATEMENT ─────────────────────────────────────── */}
      <section className="px-8 py-24 md:px-14 md:py-36">
        <div className="mx-auto max-w-4xl">
          <p className="serif text-3xl font-light leading-[1.3] text-ink md:text-5xl md:leading-[1.2]">
            Notteshe was born from a belief that clothing should feel like a second skin — unhurried, intentional, and made to last far beyond a single season.
          </p>
          <div className="mt-12 flex items-center gap-8 border-t border-border pt-10">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Founded</p>
              <p className="serif mt-1 text-xl font-light">2024</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Origin</p>
              <p className="serif mt-1 text-xl font-light">Tirana, AL</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Craft</p>
              <p className="serif mt-1 text-xl font-light">IT · JP</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. ALTERNATING EDITORIAL PANELS ─────────────────────────── */}

      {/* Panel A — image right */}
      <section className="border-t border-border">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex flex-col justify-center px-8 py-20 md:px-14 md:py-28 lg:px-20">
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">The origin</p>
            <h2 className="serif mt-6 text-4xl font-light leading-[1.1] md:text-5xl">
              Born in Tirana,<br />cut for the world.
            </h2>
            <p className="mt-8 text-[14px] font-light leading-relaxed text-ink/65">
              Our collections draw from the textures and silences of the Mediterranean — natural fibres, muted tones, and shapes that move with the body rather than against it.
            </p>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-ink/50">
              Every piece is designed in-house and produced in small runs, working with workshops that share our commitment to craft. We believe in buying less and wearing more.
            </p>
          </div>
          <div className="aspect-[4/5] md:aspect-auto md:h-full min-h-[480px]">
            <img
              src={aboutHero}
              alt="Notteshe atelier"
              className="h-full w-full object-cover object-top"
            />
          </div>
        </div>
      </section>

      {/* Panel B — full-width quote break */}
      <section className="bg-notteshe-cream border-y border-border px-8 py-20 md:px-14 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">The name</p>
          <p className="serif mt-8 text-3xl font-light leading-[1.3] text-ink md:text-5xl md:leading-[1.2]">
            "Notteshe comes from the Albanian word for night — the quiet hours when creativity feels most honest."
          </p>
          <div className="mt-10 h-px w-16 bg-clay mx-auto" />
        </div>
      </section>

      {/* Panel C — image left */}
      <section className="border-b border-border">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="order-2 md:order-1 aspect-[4/5] md:aspect-auto min-h-[480px]">
            <img
              src={aboutHero}
              alt="Notteshe craft"
              className="h-full w-full object-cover object-bottom"
            />
          </div>
          <div className="order-1 md:order-2 flex flex-col justify-center px-8 py-20 md:px-14 md:py-28 lg:px-20">
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">The commitment</p>
            <h2 className="serif mt-6 text-4xl font-light leading-[1.1] md:text-5xl">
              Beauty that doesn't cost the earth.
            </h2>
            <p className="mt-8 text-[14px] font-light leading-relaxed text-ink/65">
              Our commitment extends beyond aesthetics. We work to reduce waste at every stage and partner only with suppliers who treat their workers fairly.
            </p>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-ink/50">
              Linen, silk, wool, cotton. We avoid synthetics wherever possible and choose suppliers who cultivate with care.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. PHILOSOPHY — FULL DARK ────────────────────────────────── */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-[1100px] px-8 py-24 md:px-14 md:py-36">
          <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/25">Philosophy</p>
          <h2 className="serif mt-8 text-5xl font-light leading-[1.05] md:text-7xl lg:text-[5.5rem]">
            We believe{" "}
            <em className="not-italic text-clay">restraint</em>{" "}
            is the most radical thing a garment can wear.
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-8 border-t border-white/10 pt-14 md:grid-cols-3">
            {[
              { label: "Slow fashion", body: "Two collections a year. No drops, no hype." },
              { label: "Natural craft", body: "Six mills in Italy and Japan. Cut in ateliers we visit ourselves." },
              { label: "Transparent", body: "We show our cost of production. No false markups, no false discounts." },
            ].map((v) => (
              <div key={v.label}>
                <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">{v.label}</p>
                <p className="mt-4 text-[14px] font-light leading-relaxed text-white/55">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. GRUA E FORTË ──────────────────────────────────────────── */}
      <section className="border-t border-border px-8 py-24 md:px-14 md:py-36">
        <div className="mx-auto max-w-[900px]">
          <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">Identity</p>
          <h2 className="serif mt-8 text-5xl font-light leading-[1.05] text-ink md:text-7xl">
            Notteshe —<br /><em className="not-italic text-clay">Grua e Fortë.</em>
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-12">
            <p className="text-[14px] font-light leading-relaxed text-ink/65">
              In Albanian, <em className="not-italic text-ink">grua e fortë</em> — the strong woman. Not strong in the way the world demands of her: loud, unyielding, armored. Strong in the way she has always known herself to be: quiet, certain, unbreakable.
            </p>
            <p className="text-[14px] font-light leading-relaxed text-ink/65">
              We design for the woman who moves through a room and leaves something behind. Who dresses not to be seen, but because she sees herself. Every silhouette is sculpted with intention — from the sun-warmed streets of Tirana to wherever she chooses to stand.
            </p>
          </div>
          <div className="mt-14 border-t border-border pt-10">
            <p className="serif text-2xl font-light text-ink md:text-3xl">Notteshe is born in Albania. Worn by the world.</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">This is not fashion. This is identity, cut in cloth.</p>
          </div>
        </div>
      </section>

      {/* ── 6. CTA ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-ink">
        <img
          src={aboutHero}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-20"
        />
        <div className="relative px-8 py-24 md:px-14 md:py-36">
          <div className="mx-auto max-w-[1100px] flex flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30">Explore</p>
              <h2 className="serif mt-4 text-5xl font-light text-white md:text-7xl">Wear the night.</h2>
            </div>
            <a
              href="/shop"
              className="shrink-0 border border-white/30 px-10 py-4 font-mono text-[10px] uppercase tracking-widest text-white/70 transition-all hover:border-white hover:text-white"
            >
              Shop now
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
