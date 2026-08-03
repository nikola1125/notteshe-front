import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/shipping")({
  component: ShippingPage,
});

function ShippingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[800px] px-5 pb-32 pt-32 md:px-12 md:pt-40">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Delivery</p>
        <h1 className="serif mt-4 text-5xl font-light text-ink">Shipping</h1>

        <div className="mt-16 space-y-16">
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Processing time</h2>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-muted-foreground">
              Orders are processed within 1–2 business days. You will receive a shipping confirmation email with tracking details once your order has been dispatched.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Delivery times</h2>
            <div className="mt-6 divide-y divide-border">
              {[
                { zone: "Albania", time: "1–2 business days", cost: "€5" },
                { zone: "Europe", time: "3–5 business days", cost: "€12" },
                { zone: "Rest of world", time: "7–14 business days", cost: "€20" },
              ].map((row) => (
                <div key={row.zone} className="flex items-center justify-between py-5">
                  <div>
                    <p className="text-[14px] text-ink">{row.zone}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.time}</p>
                  </div>
                  <p className="font-mono text-[13px] text-ink">{row.cost}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 font-mono text-[11px] text-muted-foreground">Free shipping on all orders over €200.</p>
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Tracking</h2>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-muted-foreground">
              Once your order ships, you'll receive a tracking number by email. You can also check your order status in your{" "}
              <Link to="/account/orders" className="text-ink underline underline-offset-2">account</Link>.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Customs & duties</h2>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-muted-foreground">
              Orders shipped outside the EU may be subject to import duties and taxes. These charges are the responsibility of the recipient. We are not able to predict or cover these costs.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
