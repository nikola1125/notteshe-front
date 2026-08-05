import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/lookbook")({
  component: LookbookPage,
});

const LOOKS = [
  { id: 1, title: "Study in linen", season: "SS 2026", description: "Soft tailoring for warm evenings." },
  { id: 2, title: "The quiet hour", season: "SS 2026", description: "Draped silk, unhurried mornings." },
  { id: 3, title: "Terra", season: "SS 2026", description: "Earth tones, natural structure." },
  { id: 4, title: "Between seasons", season: "SS 2026", description: "Layering for the transition months." },
  { id: 5, title: "Night study", season: "SS 2026", description: "Evening dressing, reimagined." },
  { id: 6, title: "Still life", season: "SS 2026", description: "Minimal forms, maximal presence." },
];

function LookbookPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="mx-auto max-w-[1600px] px-5 pb-16 pt-32 md:px-12 md:pt-40">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SS 2026</p>
        <h1 className="serif mt-4 text-5xl font-light text-ink md:text-7xl">Lookbook</h1>
        <p className="mt-6 max-w-md text-[14px] font-light leading-relaxed text-muted-foreground">
          A collection of images from our Spring/Summer 2026 season, shot in Tirana and the Albanian Riviera.
        </p>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-[1600px] px-5 pb-32 md:px-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {LOOKS.map((look, i) => (
            <div key={look.id} className={`group relative overflow-hidden bg-notteshe-cream ${i === 0 ? "md:col-span-2 aspect-[16/7]" : "aspect-[4/5]"}`}>
              {/* Placeholder — replace with actual lookbook images */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">Image {look.id}</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-8 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                <p className="font-mono text-[9px] uppercase tracking-widest text-white/70">{look.season}</p>
                <h2 className="serif mt-1 text-2xl text-white">{look.title}</h2>
                <p className="mt-1 font-mono text-[11px] text-white/60">{look.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-[1600px] flex-col items-center gap-6 px-5 py-24 text-center md:px-12">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Shop the collection</p>
          <h2 className="serif text-4xl text-ink">Ready to wear.</h2>
          <Link
            to="/shop"
            search={{ sale: undefined }}
            className="mt-2 bg-ink px-8 py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90"
          >
            Shop SS 2026
          </Link>
        </div>
      </div>
    </div>
  );
}
