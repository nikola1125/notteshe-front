import { createFileRoute, Link } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/exchanges")({
  head: () => ({
    meta: [
      { title: "Returns & Exchanges — Notteshe" },
      { name: "description", content: "Exchange policy, process and eligible items. All sales are final — exchanges accepted within 14 days of delivery." },
      { property: "og:title", content: "Returns & Exchanges — Notteshe" },
      { property: "og:url", content: `${SITE_URL}/exchanges` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/exchanges` }],
  }),
  component: ExchangesPage,
});

function ExchangesPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[800px] px-5 pb-32 pt-20 md:px-12 md:pt-28">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-clay"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M8 2L4 6l4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">After purchase</p>
        <h1 className="serif mt-4 text-5xl font-light text-ink">Exchanges</h1>

        <div className="mt-16 space-y-16">
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Exchange policy</h2>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-muted-foreground">
              All sales are final — we don't offer refunds. What we do offer is an <strong className="font-medium text-ink">exchange within 14 days</strong> of delivery, for a different size or another piece of equal value. Items must be unworn, unwashed, and returned with all original tags attached. We reserve the right to refuse exchanges that don't meet these conditions.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Not eligible for exchange</h2>
            <ul className="mt-4 space-y-2 text-[14px] font-light text-muted-foreground">
              {["Sale and discounted items", "Swimwear and intimates", "Items marked as final sale"].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">How to exchange</h2>
            <ol className="mt-4 space-y-4">
              {[
                { step: "01", text: "Email us at hello@notteshe.com with your order number and the size or piece you'd like instead." },
                { step: "02", text: "We'll confirm availability and send you exchange instructions within 1 business day." },
                { step: "03", text: "Send the original item back to us, securely packaged with all tags attached." },
                { step: "04", text: "Once received and inspected, we'll ship your exchange out to you." },
              ].map((s) => (
                <li key={s.step} className="flex gap-6">
                  <span className="font-mono text-[11px] text-muted-foreground/40">{s.step}</span>
                  <p className="text-[14px] font-light leading-relaxed text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Good to know</h2>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-muted-foreground">
              Exchanges are subject to stock availability. If your requested piece is unavailable, we'll issue <strong className="font-medium text-ink">store credit</strong> instead. Original and return shipping costs are covered by you — unless the item arrived faulty or was sent in error, in which case we handle it at no cost.
            </p>
          </section>

          <section className="border border-border p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Need help?</p>
            <p className="serif mt-3 text-2xl text-ink">We're here for you.</p>
            <Link
              to="/contact"
              className="mt-6 inline-block bg-ink px-8 py-3 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90"
            >
              Contact us
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
