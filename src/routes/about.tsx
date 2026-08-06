import { createFileRoute } from "@tanstack/react-router";
import aboutHero from "@/assets/about-hero.jpg";
import aboutMid from "@/assets/about-mid.png";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="bg-background">

      {/* ── 1. HERO ──────────────────────────────────────────────────── */}
      <section className="relative h-[100svh] w-full overflow-hidden">
        <img
          src={aboutHero}
          alt="Notteshe"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/55" />

        <div className="absolute inset-0 flex flex-col justify-between px-8 py-10 pt-20 md:px-14 md:py-14 md:pt-20">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/40">Our Story</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/40">Est. 2024</span>
          </div>
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/30 mb-4">Tirana, Albania</p>
            <h1 className="serif text-[clamp(3rem,10vw,7rem)] font-light leading-[1.0] text-white">
              Rooted<br />in craft,<br />dressed<br />in night.
            </h1>
          </div>
        </div>
      </section>

      {/* ── 2. MANIFESTO BAR ─────────────────────────────────────────── */}
      <section className="bg-muted px-8 py-14 md:px-14 md:py-20">
        <p className="serif text-2xl font-light leading-[1.4] text-white md:text-4xl md:leading-[1.3] max-w-3xl">
          "Notteshe was born from a belief that clothing should feel like a second skin — unhurried, intentional, and made to last far beyond a single season."
        </p>
        <div className="mt-8 flex gap-8 border-t border-white/10 pt-6">
          {[["Founded", "2024"], ["Origin", "Tirana, AL"], ["Made in", "IT · JP"], ["Seasons", "Two / year"]].map(([k, v]) => (
            <div key={k}>
              <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-white/25">{k}</p>
              <p className="mt-1 font-mono text-[11px] text-white/70">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. ORIGIN ────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr]">
          <div className="px-8 py-14 md:px-14 md:py-20">
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">01 — The Origin</p>
            <h2 className="serif mt-6 text-4xl font-light leading-[1.1] text-ink md:text-5xl">
              Born in Tirana,<br />cut for the world.
            </h2>
            <p className="mt-6 text-[14px] font-light leading-relaxed text-ink/60">
              Our collections draw from the textures and silences of the Mediterranean — natural fibres, muted tones, and shapes that move with the body rather than against it.
            </p>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-ink/45">
              Every piece is designed in-house and produced in small runs, working with workshops that share our commitment to craft. We believe in buying less and wearing more.
            </p>
          </div>

          <div className="hidden md:block bg-border" />

          <div className="px-8 py-14 md:px-14 md:py-20">
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">02 — The Name</p>
            <h2 className="serif mt-6 text-4xl font-light leading-[1.1] text-ink md:text-5xl">
              Notte — the quiet<br />hours of making.
            </h2>
            <p className="mt-6 text-[14px] font-light leading-relaxed text-ink/60">
              Notteshe comes from the Albanian word for "night" — a nod to the quiet hours when creativity feels most honest, and to the timeless quality we bring to everything we make.
            </p>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-ink/45">
              Our commitment extends beyond aesthetics. We work to reduce waste at every stage and partner only with suppliers who treat their workers fairly.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. FULL IMAGE BREAK ──────────────────────────────────────── */}
      <section className="h-[70vw] max-h-[560px] min-h-[260px] overflow-hidden md:h-[50vw]">
        <img
          src={aboutMid}
          alt="Notteshe"
          className="h-full w-full object-cover object-center"
        />
      </section>

      {/* ── 5. PHILOSOPHY ────────────────────────────────────────────── */}
      <section className="bg-muted text-white px-8 py-14 md:px-14 md:py-20">
        <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/25">Philosophy</p>
        <h2 className="serif mt-6 text-[clamp(2.2rem,6vw,4.5rem)] font-light leading-[1.05] max-w-4xl">
          We believe{" "}
          <em className="not-italic text-clay">restraint</em>{" "}
          is the most radical thing a garment can wear.
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-0 border-t border-white/10 md:grid-cols-3">
          {[
            { n: "I", title: "Slow fashion", body: "Two collections a year. No drops, no hype — just considered design." },
            { n: "II", title: "Natural craft", body: "Six mills in Italy and Japan. Cut in ateliers we visit ourselves." },
            { n: "III", title: "Transparent", body: "We show our cost of production. No inflated markups." },
          ].map((v, i) => (
            <div key={v.n} className={`py-8 pr-8 md:py-10 md:pr-14 ${i > 0 ? "border-t border-white/10 md:border-t-0 md:border-l md:pl-14 md:pr-0" : ""}`}>
              <p className="serif text-sm text-white/20">{v.n}</p>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">{v.title}</p>
              <p className="mt-3 text-[13px] font-light leading-relaxed text-white/50">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. GRUA E FORTË ──────────────────────────────────────────── */}
      <section className="border-b border-border px-8 py-14 md:px-14 md:py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.2fr] md:gap-16">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground">Identity</p>
            <h2 className="serif mt-6 text-5xl font-light leading-[1.05] md:text-6xl">
              Notteshe —<br />
              <em className="not-italic text-clay">Grua e Fortë.</em>
            </h2>
            <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">
              The strong woman.
            </p>
          </div>

          <div className="space-y-5">
            <p className="text-[14px] font-light leading-relaxed text-ink/65">
              In Albanian, <em className="not-italic text-ink font-normal">grua e fortë</em> — the strong woman. Not strong in the way the world demands of her: loud, unyielding, armored. Strong in the way she has always known herself to be: quiet, certain, unbreakable.
            </p>
            <p className="text-[14px] font-light leading-relaxed text-ink/65">
              We design for the woman who moves through a room and leaves something behind. Who dresses not to be seen, but because she sees herself.
            </p>
            <p className="text-[14px] font-light leading-relaxed text-ink/50">
              Every silhouette is sculpted with intention — from the sun-warmed streets of Tirana to wherever she chooses to stand.
            </p>
            <div className="border-t border-border pt-6">
              <p className="serif text-xl font-light text-ink md:text-2xl">
                Notteshe is born in Albania.<br />Worn by the world.
              </p>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground/50">
                This is not fashion. This is identity, cut in cloth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. CTA ───────────────────────────────────────────────────── */}
      <section className="bg-muted px-8 py-14 md:px-14 md:py-20">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/25">Explore the collection</p>
            <h2 className="serif mt-4 text-6xl font-light text-white md:text-8xl">
              Wear<br />the night.
            </h2>
          </div>
          <a
            href="/shop"
            className="self-start border border-white/20 px-10 py-4 font-mono text-[10px] uppercase tracking-widest text-white/60 transition-all duration-300 hover:border-white hover:text-white md:self-auto"
          >
            Shop now
          </a>
        </div>
      </section>

    </div>
  );
}
