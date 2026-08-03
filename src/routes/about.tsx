import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative flex h-[70vh] items-end bg-notteshe-cream px-5 pb-16 md:px-20 md:pb-24">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Our story</p>
          <h1 className="serif mt-4 text-5xl font-light leading-tight text-ink md:text-7xl">
            Rooted in craft,<br />dressed in light.
          </h1>
        </div>
      </div>

      {/* Story */}
      <div className="mx-auto max-w-[1600px] px-5 py-24 md:px-20 md:py-32">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2 md:gap-32">
          <div className="space-y-8">
            <p className="text-lg font-light leading-relaxed text-ink/80">
              Notteshe was born from a belief that clothing should feel like a second skin — unhurried, intentional, and made to last far beyond a single season.
            </p>
            <p className="text-base font-light leading-relaxed text-muted-foreground">
              Founded in Tirana, our collections draw from the textures and silences of the Mediterranean — natural fibres, muted tones, and shapes that move with the body rather than against it.
            </p>
            <p className="text-base font-light leading-relaxed text-muted-foreground">
              Every piece is designed in-house and produced in small runs, working with workshops that share our commitment to craft. We believe in buying less and wearing more.
            </p>
          </div>
          <div className="space-y-8">
            <p className="text-base font-light leading-relaxed text-muted-foreground">
              The name Notteshe comes from the Albanian word for &ldquo;night&rdquo; — a nod to the quiet hours when creativity feels most honest, and to the timeless quality we bring to everything we make.
            </p>
            <p className="text-base font-light leading-relaxed text-muted-foreground">
              Our commitment extends beyond aesthetics. We work to reduce waste at every stage — from pattern cutting to packaging — and we partner only with suppliers who treat their workers fairly.
            </p>
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-[1600px] px-5 py-24 md:px-20">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">What we stand for</p>
          <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-3">
            {[
              { title: "Slow fashion", body: "We release two collections per year. No drops, no hype — just considered design that earns a place in your wardrobe for years." },
              { title: "Natural materials", body: "Linen, silk, wool, cotton. We avoid synthetics wherever possible and choose suppliers who cultivate with care." },
              { title: "Transparent pricing", body: "We show our cost of production so you understand what you're paying for. No inflated markups, no false discounts." },
            ].map((v) => (
              <div key={v.title} className="border-t border-border pt-8">
                <h3 className="serif text-xl text-ink">{v.title}</h3>
                <p className="mt-4 text-[13px] font-light leading-relaxed text-muted-foreground">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
