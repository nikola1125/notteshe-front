import { createFileRoute, Link } from "@tanstack/react-router";
import aboutHero from "@/assets/about-hero.jpg";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">

      {/* ── Full-bleed hero ───────────────────────────────────────────── */}
      <section className="relative h-[90vh] w-full overflow-hidden md:h-screen">
        <img
          src={aboutHero}
          alt="Notteshe — black dress on hanger beside a black panther on a velvet sofa"
          className="h-full w-full object-cover object-center"
        />
        {/* dark gradient overlay so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute bottom-0 left-0 w-full px-6 pb-12 md:px-16 md:pb-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/50">
            Our story
          </p>
          <h1 className="serif mt-4 text-5xl font-light leading-[1.1] text-white md:text-7xl lg:text-8xl">
            Rooted in craft,<br />dressed in night.
          </h1>
        </div>
      </section>

      {/* ── Intro statement ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center md:py-32">
        <p className="serif text-2xl font-light leading-relaxed text-ink md:text-3xl">
          Notteshe was born from a belief that clothing should feel like a second skin —
          unhurried, intentional, and made to last far beyond a single season.
        </p>
      </section>

      {/* ── Two-column story ──────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-16 md:py-28">
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2 md:gap-24 lg:gap-40">

            <div className="space-y-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                The origin
              </p>
              <p className="text-base font-light leading-relaxed text-ink/80">
                Founded in Tirana, our collections draw from the textures and silences
                of the Mediterranean — natural fibres, muted tones, and shapes that move
                with the body rather than against it.
              </p>
              <p className="text-base font-light leading-relaxed text-muted-foreground">
                Every piece is designed in-house and produced in small runs, working with
                workshops that share our commitment to craft. We believe in buying less
                and wearing more.
              </p>
            </div>

            <div className="space-y-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                The name
              </p>
              <p className="text-base font-light leading-relaxed text-ink/80">
                Notteshe comes from the Albanian word for &ldquo;night&rdquo; — a nod to
                the quiet hours when creativity feels most honest, and to the timeless
                quality we bring to everything we make.
              </p>
              <p className="text-base font-light leading-relaxed text-muted-foreground">
                Our commitment extends beyond aesthetics. We work to reduce waste at every
                stage and partner only with suppliers who treat their workers fairly.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────────────────────── */}
      <section className="bg-notteshe-cream">
        <div className="mx-auto max-w-[1400px] px-6 py-20 md:px-16 md:py-28">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            What we stand for
          </p>
          <div className="mt-12 grid grid-cols-1 gap-px border border-border md:grid-cols-3">
            {[
              {
                title: "Slow fashion",
                body: "We release two collections per year. No drops, no hype — just considered design that earns a place in your wardrobe for years.",
              },
              {
                title: "Natural materials",
                body: "Linen, silk, wool, cotton. We avoid synthetics wherever possible and choose suppliers who cultivate with care.",
              },
              {
                title: "Transparent pricing",
                body: "We show our cost of production so you understand what you're paying for. No inflated markups, no false discounts.",
              },
            ].map((v) => (
              <div key={v.title} className="border border-border bg-notteshe-cream p-8 md:p-10">
                <h3 className="serif text-xl font-light text-ink">{v.title}</h3>
                <p className="mt-4 text-[13px] font-light leading-relaxed text-muted-foreground">
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-20 text-center md:py-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Explore the collection
        </p>
        <h2 className="serif mt-4 text-3xl font-light text-ink md:text-4xl">
          Wear the night.
        </h2>
        <Link
          to="/shop"
          className="mt-8 inline-block border border-ink px-10 py-3 font-mono text-[11px] uppercase tracking-widest text-ink transition-colors hover:bg-ink hover:text-white"
        >
          Shop now
        </Link>
      </section>

    </div>
  );
}
