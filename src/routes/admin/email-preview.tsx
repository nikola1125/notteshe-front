import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

// Build the three email variants with sample data — no email is sent. Server-only
// (resend.ts pulls in node-mailjet), so the builders are dynamically imported.
const getEmailPreviews = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("@/lib/admin/auth");
  await requireAdmin();
  const { buildOrderConfirmationHtml, buildGiftCardDelivery } = await import("@/lib/resend");
  const { DEFAULT_RATE } = await import("@/lib/currency");

  const order = buildOrderConfirmationHtml(
    {
      to: "customer@example.com",
      firstName: "Elira",
      orderId: "a1b2c3d4-0000-0000-0000-000000000000",
      currency: "ALL",
      items: [
        { name: "Silk Slip Dress — Noir", size: "M", colour: "Black", quantity: 1, unitPrice: 189, image: null },
        { name: "Wide-Leg Trouser", size: "S", colour: "Sand", quantity: 2, unitPrice: 96, image: null },
      ],
      subtotal: 381,
      shippingFee: 0,
      discountAmount: 40,
      total: 341,
      paymentMethod: "Card (POK Pay)",
      shippingAddress: {
        firstName: "Elira", lastName: "Hoxha",
        line1: "Rr. Myslym Shyri 42", line2: "Apt 7",
        city: "Tiranë", postalCode: "1001", country: "Albania", phone: "+355 69 000 0000",
      },
    },
    DEFAULT_RATE,
  );

  const giftToSomeone = buildGiftCardDelivery({
    to: "recipient@example.com",
    recipientName: "Ana",
    senderName: "Elira",
    code: "NOTT-7F3A-9K2C-QX41",
    amountLek: 10000,
    message: "For all the late nights and loud laughs — wear something that's just yours. Happy birthday.",
  }).html;

  const giftToSelf = buildGiftCardDelivery({
    to: "self@example.com",
    recipientName: "Elira",
    senderName: null,
    code: "NOTT-2B8D-5M1E-Z093",
    amountLek: 5000,
    message: null,
  }).html;

  return { order, giftToSomeone, giftToSelf };
});

export const Route = createFileRoute("/admin/email-preview")({
  loader: async () => getEmailPreviews(),
  component: EmailPreviewPage,
});

const TABS = [
  { id: "order", label: "Order confirmation" },
  { id: "giftToSomeone", label: "Gift card — to someone" },
  { id: "giftToSelf", label: "Gift card — to self" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function EmailPreviewPage() {
  const data = Route.useLoaderData();
  const [tab, setTab] = useState<TabId>("order");
  const [width, setWidth] = useState<number>(680);

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Admin · Dev</p>
        <h1 className="serif mt-1 text-3xl text-ink">Email preview</h1>
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Rendered from the live templates with sample data — nothing is sent. Refresh after a deploy to see changes.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                tab === t.id ? "border-ink bg-ink text-background" : "border-border text-muted-foreground hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="mx-2 text-border">|</span>
          <button
            onClick={() => setWidth(680)}
            className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${width === 680 ? "border-ink text-ink" : "border-border text-muted-foreground hover:text-ink"}`}
          >
            Desktop
          </button>
          <button
            onClick={() => setWidth(390)}
            className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${width === 390 ? "border-ink text-ink" : "border-border text-muted-foreground hover:text-ink"}`}
          >
            Mobile
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <iframe
            key={`${tab}-${width}`}
            title="Email preview"
            srcDoc={data[tab]}
            style={{ width, height: "1500px", border: "1px solid var(--color-border)", maxWidth: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
