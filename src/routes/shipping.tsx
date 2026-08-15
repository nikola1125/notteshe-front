import { createFileRoute, Link } from "@tanstack/react-router";
import { useRate } from "@/components/Price";
import { useCurrency } from "@/store/currencyStore";
import { formatMoney } from "@/lib/currency";

export const Route = createFileRoute("/shipping")({
  component: ShippingPage,
});

function ShippingPage() {
  const currency = useCurrency();
  const rate = useRate();

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
                { zone: "Albania", time: "1–2 business days", cost: "5" },
                { zone: "Europe", time: "3–5 business days", cost: "12" },
                { zone: "Rest of world", time: "7–14 business days", cost: "20" },
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
            <p className="mt-4 font-mono text-[11px] text-muted-foreground">Free shipping on all orders over {formatMoney(200, currency, rate)}.</p>
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
