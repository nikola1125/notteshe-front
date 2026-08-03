import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/returns")({
  component: ReturnsPage,
});

function ReturnsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[800px] px-5 pb-32 pt-32 md:px-12 md:pt-40">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">After purchase</p>
        <h1 className="serif mt-4 text-5xl font-light text-ink">Returns & exchanges</h1>

        <div className="mt-16 space-y-16">
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Return policy</h2>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-muted-foreground">
              We accept returns within <strong className="font-medium text-ink">14 days</strong> of delivery. Items must be unworn, unwashed, and returned with all original tags attached. We reserve the right to refuse returns that do not meet these conditions.
            </p>
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Non-returnable items</h2>
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
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">How to return</h2>
            <ol className="mt-4 space-y-4">
              {[
                { step: "01", text: "Email us at hello@notteshe.com with your order number and reason for return." },
                { step: "02", text: "We will send you a return label within 1 business day." },
                { step: "03", text: "Package the item securely and drop it off at your nearest courier point." },
                { step: "04", text: "Once received and inspected, your refund will be processed within 5 business days." },
              ].map((s) => (
                <li key={s.step} className="flex gap-6">
                  <span className="font-mono text-[11px] text-muted-foreground/40">{s.step}</span>
                  <p className="text-[14px] font-light leading-relaxed text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Refunds</h2>
            <p className="mt-4 text-[14px] font-light leading-relaxed text-muted-foreground">
              Refunds are issued to the original payment method. Original shipping costs are non-refundable unless the item was faulty or incorrectly sent.
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
