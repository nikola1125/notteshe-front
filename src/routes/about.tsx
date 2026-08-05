import { createFileRoute } from "@tanstack/react-router";
import aboutHero from "@/assets/about-hero.jpg";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const CHAPTERS = [
  {
    num: "01",
    label: "The belief",
    heading: "Rooted in craft,\ndressed in night.",
    body: [
      "Notteshe was born from a belief that clothing should feel like a second skin — unhurried, intentional, and made to last far beyond a single season.",
      "We design for the quiet moments. The ones that don't ask for attention, but hold it anyway.",
    ],
  },
  {
    num: "02",
    label: "The origin",
    heading: "Born in Tirana,\ncut for the world.",
    body: [
      "Our collections draw from the textures and silences of the Mediterranean — natural fibres, muted tones, and shapes that move with the body rather than against it.",
      "Every piece is designed in-house and produced in small runs, working with workshops that share our commitment to craft. We believe in buying less and wearing more.",
    ],
  },
  {
    num: "03",
    label: "The name",
    heading: "Notte — the quiet\nhours of making.",
    body: [
      "Notteshe comes from the Albanian word for \"night\" — a nod to the quiet hours when creativity feels most honest, and to the timeless quality we bring to everything we make.",
      "Our commitment extends beyond aesthetics. We work to reduce waste at every stage and partner only with suppliers who treat their workers fairly.",
    ],
  },
];

const VALUES = [
  {
    index: "I",
    title: "Slow fashion",
    body: "Two collections per year. No drops, no hype — just considered design that earns a place in your wardrobe for years.",
  },
  {
    index: "II",
    title: "Natural materials",
    body: "Linen, silk, wool, cotton. We avoid synthetics wherever possible and choose suppliers who cultivate with care.",
  },
  {
    index: "III",
    title: "Transparent pricing",
    body: "We show our cost of production so you understand what you're paying for. No inflated markups, no false discounts.",
  },
];

function AboutPage() {
  return (
    <div className="bg-background">

      {/* ── Sticky split layout ───────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row">

        {/* Left — sticky image */}
        <div className="relative h-[60vw] shrink-0 md:h-auto md:w-[48%]">
          <div className="md:sticky md:top-0 md:h-screen h-full w-full">
            <img
              src={aboutHero}
              alt="Notteshe — black dress on hanger beside a black panther on a velvet sofa"
              className="h-full w-full object-cover object-center"
            />
            {/* Subtle right edge fade on desktop */}
            <div className="absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-background to-transparent md:block" />
          </div>
        </div>

        {/* Right — scrolling chapters */}
        <div className="flex flex-col md:w-[52%]">
          {/* Top label row */}
          <div className="flex items-center justify-between border-b border-border px-8 py-5 md:px-14">
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">
              Our story
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              Est. 2024
            </p>
          </div>

          {CHAPTERS.map((ch, i) => (
            <div
              key={ch.num}
              className={[
                "px-8 py-16 md:px-14 md:py-24",
                i < CHAPTERS.length - 1 ? "border-b border-border" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-5">
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground/50 pt-1">
                  {ch.num}
                </span>
                <div className="space-y-8">
                  <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                    {ch.label}
                  </p>
                  <h2 className="serif text-4xl font-light leading-[1.1] text-ink md:text-5xl whitespace-pre-line">
                    {ch.heading}
                  </h2>
                  <div className="space-y-4">
                    {ch.body.map((p, j) => (
                      <p key={j} className="text-[14px] font-light leading-relaxed text-ink/70">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Philosophy ───────────────────────────────────────────────── */}
      <section className="border-t border-border bg-ink text-white">
        <div className="mx-auto max-w-[900px] px-8 py-24 md:px-16 md:py-36">
          <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30">
            Philosophy
          </p>

          <h2 className="serif mt-8 text-5xl font-light leading-[1.05] md:text-7xl">
            We believe{" "}
            <em className="not-italic text-clay">restraint</em>{" "}
            is the most radical thing a garment can wear.
          </h2>

          <div className="mt-12 space-y-5 border-l border-white/10 pl-6 md:mt-16">
            <p className="text-[15px] font-light leading-relaxed text-white/60 md:text-base">
              No trend cycles. No noise. Every piece is designed once, made well, and left alone to do its quiet work — season after season, drawer after drawer.
            </p>
            <p className="text-[15px] font-light leading-relaxed text-white/60 md:text-base">
              Fabric sourced from six mills across Italy and Japan. Cut in ateliers we visit ourselves. Sold slowly, and only when we are certain.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-10">
            {[
              { label: "Mills", value: "06" },
              { label: "Seasons", value: "Two" },
              { label: "Made in", value: "IT · JP" },
            ].map((stat) => (
              <div key={stat.label} className="px-6 first:pl-0 last:pr-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">
                  {stat.label}
                </p>
                <p className="serif mt-2 text-2xl font-light text-white md:text-3xl">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ────────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-[1200px] px-8 py-20 md:px-16 md:py-28">
          <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">
            What we stand for
          </p>

          <div className="mt-14 space-y-0">
            {VALUES.map((v, i) => (
              <div
                key={v.title}
                className="grid grid-cols-[3rem_1fr] items-start gap-6 border-t border-border py-10 md:grid-cols-[5rem_1fr_1fr] md:gap-12 md:py-12"
              >
                <span className="serif text-2xl font-light text-ink/20 md:text-3xl">
                  {v.index}
                </span>
                <h3 className="serif text-xl font-light text-ink md:text-2xl">
                  {v.title}
                </h3>
                <p className="col-start-2 text-[13px] font-light leading-relaxed text-muted-foreground md:col-start-3">
                  {v.body}
                </p>
              </div>
            ))}
            <div className="border-t border-border" />
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="overflow-hidden bg-ink px-8 py-20 md:py-32">
        <div className="mx-auto max-w-[1200px] flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30">
              Explore the collection
            </p>
            <h2 className="serif mt-4 text-4xl font-light text-white md:text-6xl">
              Wear the night.
            </h2>
          </div>
          <a
            href="/shop"
            className="self-start border border-white/30 px-10 py-3.5 font-mono text-[10px] uppercase tracking-widest text-white/80 transition-all hover:border-white hover:text-white md:self-auto"
          >
            Shop now
          </a>
        </div>
      </section>

    </div>
  );
}
