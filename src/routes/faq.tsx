import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
});

const FAQS = [
  {
    q: "How do I find my size?",
    a: "We recommend checking our size guide for detailed measurements. Our pieces are generally true to size, but some styles have a more relaxed or oversized fit — this is noted in each product description.",
  },
  {
    q: "What is your return policy?",
    a: "We accept returns within 14 days of delivery for unworn, unwashed items with all original tags attached. Sale items are final sale. Please visit our returns page to start a return.",
  },
  {
    q: "How long does shipping take?",
    a: "Standard shipping within Europe takes 3–5 business days. International orders typically arrive within 7–10 business days. Express options are available at checkout.",
  },
  {
    q: "Do you ship internationally?",
    a: "Yes, we ship worldwide. Shipping costs and estimated delivery times are calculated at checkout based on your location.",
  },
  {
    q: "How do I care for my garments?",
    a: "Care instructions are printed on the label of every garment. In general, we recommend cold wash or hand wash for natural fibres, and laying flat to dry to preserve the shape.",
  },
  {
    q: "Can I change or cancel my order?",
    a: "Orders can be modified or cancelled within 1 hour of placement. After that, our fulfilment process has begun and changes may not be possible. Please contact us as soon as possible at hello@notteshe.com.",
  },
  {
    q: "Are your fabrics sustainable?",
    a: "We prioritise natural, low-impact fibres such as linen, GOTS-certified organic cotton, and recycled materials. Each product page lists the fabric composition and origin.",
  },
  {
    q: "Do you restock sold-out items?",
    a: "We produce in small quantities, so not all items are restocked. You can sign up for restock notifications on the product page, and we'll email you if it becomes available again.",
  },
];

function FaqPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[800px] px-5 pb-32 pt-32 md:px-12 md:pt-40">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Help</p>
        <h1 className="serif mt-4 text-5xl font-light text-ink">FAQ</h1>
        <p className="mt-6 text-[14px] font-light leading-relaxed text-muted-foreground">
          Answers to our most common questions. Can't find what you're looking for?{" "}
          <a href="/contact" className="text-ink underline underline-offset-2">Contact us.</a>
        </p>

        <div className="mt-16 divide-y divide-border">
          {FAQS.map((faq, i) => (
            <div key={i} className="py-6">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <span className="serif text-[17px] text-ink">{faq.q}</span>
                <svg
                  width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"
                  className={`mt-1 shrink-0 text-muted-foreground transition-transform duration-300 ${open === i ? "rotate-45" : ""}`}
                >
                  <path d="M8 2v12M2 8h12" />
                </svg>
              </button>
              {open === i && (
                <p className="mt-4 text-[13px] font-light leading-relaxed text-muted-foreground">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
