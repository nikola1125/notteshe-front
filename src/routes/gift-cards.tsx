import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCart } from "@/store/cartStore";
import { useCurrency } from "@/store/currencyStore";
import { useRate } from "@/components/Price";
import { formatMoney } from "@/lib/currency";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ─── Server fn: get EUR→Lek rate ─────────────────────────────────────────────

const getGiftCardRate = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("@/db");
  const { shippingConfig } = await import("@/db/schema");
  let eurToLekRate = 100;
  try {
    const [cfg] = await db().select({ eurToLekRate: shippingConfig.eurToLekRate }).from(shippingConfig).limit(1);
    if (cfg) eurToLekRate = cfg.eurToLekRate ?? 100;
  } catch { /* not migrated */ }
  return { eurToLekRate };
});

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/gift-cards")({
  loader: async () => getGiftCardRate(),
  component: GiftCardsPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_AMOUNTS_LEK = [2000, 5000, 10000, 20000];

// ─── Component ────────────────────────────────────────────────────────────────

function GiftCardsPage() {
  const { eurToLekRate } = Route.useLoaderData();
  const { addGiftCard, openCart } = useCart();
  const navigate = useNavigate();
  const currency = useCurrency();
  const rate = useRate();

  const [selectedLek, setSelectedLek] = useState<number | null>(5000);
  const [customLek, setCustomLek] = useState("");
  const [forSelf, setForSelf] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  const amountLek = selectedLek !== null ? selectedLek : (parseInt(customLek.replace(/\D/g, ""), 10) || 0);
  const amountEur = amountLek / eurToLekRate;

  function formatLek(amount: number) {
    return `${amount.toLocaleString()} L`;
  }

  function formatDisplay(eur: number) {
    return formatMoney(eur, currency, rate);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (amountLek < 500) next.amount = "Minimum amount is 500 L";
    if (amountLek > 100000) next.amount = "Maximum amount is 100,000 L";
    if (!forSelf) {
      if (!recipientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
        next.recipientEmail = "Enter a valid email address";
      if (!recipientName.trim())
        next.recipientName = "Enter the recipient's name";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleAddToCart() {
    if (!validate()) return;

    addGiftCard({
      productId: `gift-card-${amountLek}`,
      name: `Gift Card — ${formatLek(amountLek)}`,
      price: amountEur,
      image: "/images/gift-card-placeholder.jpg",
      isGiftCard: true,
      giftCardAmountLek: amountLek,
      giftCardRecipientEmail: forSelf ? undefined : recipientEmail.trim(),
      giftCardRecipientName: forSelf ? undefined : recipientName.trim(),
      giftCardMessage: message.trim() || undefined,
      giftCardForSelf: forSelf,
    });

    setAdded(true);
    setTimeout(() => {
      openCart();
      void navigate({ to: "/checkout" });
    }, 600);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 pb-24 pt-24 md:px-8 md:pt-32">

        <div className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gift</p>
          <h1 className="serif mt-2 text-4xl text-ink md:text-5xl">Gift cards</h1>
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-muted-foreground/70">
            Give the gift of Notteshe. Delivered instantly by email — the recipient can redeem it at checkout.
          </p>
        </div>

        <div className="space-y-10">

          {/* Amount selector */}
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Amount</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRESET_AMOUNTS_LEK.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => { setSelectedLek(amount); setCustomLek(""); setErrors((e) => ({ ...e, amount: undefined! })); }}
                  className={`border py-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                    selectedLek === amount
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-transparent text-ink hover:border-ink/50"
                  }`}
                >
                  {formatLek(amount)}
                </button>
              ))}
            </div>

            <div className="mt-3">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Custom amount (Lek)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={customLek}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setCustomLek(v);
                  setSelectedLek(null);
                  setErrors((er) => ({ ...er, amount: undefined! }));
                }}
                placeholder="e.g. 7500"
                style={{ fontSize: '16px' }}
                className="mt-2 w-full border-b border-border bg-transparent pb-2.5 font-mono text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
              />
            </div>
            {errors.amount && <p className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-clay">{errors.amount}</p>}

            {amountLek > 0 && (
              <p className="mt-3 font-mono text-[11px] text-muted-foreground/60">
                ≈ {formatDisplay(amountEur)}
              </p>
            )}
          </div>

          {/* For self or gift */}
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Recipient</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setForSelf(false)}
                className={`flex-1 border py-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                  !forSelf ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-ink hover:border-ink/50"
                }`}
              >
                Send as gift
              </button>
              <button
                type="button"
                onClick={() => setForSelf(true)}
                className={`flex-1 border py-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                  forSelf ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-ink hover:border-ink/50"
                }`}
              >
                For myself
              </button>
            </div>
          </div>

          {/* Recipient details — only for gift */}
          {!forSelf && (
            <div className="space-y-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gift details</p>
              <GiftField
                label="Recipient name"
                value={recipientName}
                onChange={setRecipientName}
                error={errors.recipientName}
                placeholder="Their first name"
              />
              <GiftField
                label="Recipient email"
                value={recipientEmail}
                onChange={setRecipientEmail}
                error={errors.recipientEmail}
                type="email"
                placeholder="they@somewhere.com"
              />
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Personal message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write a message to include with the gift card…"
                  maxLength={280}
                  rows={3}
                  style={{ fontSize: '16px' }}
                  className="mt-2 w-full resize-none border-b border-border bg-transparent pb-2.5 font-mono text-[12px] text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
                />
                <p className="mt-1 font-mono text-[9px] text-muted-foreground/40">{message.length}/280</p>
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="border border-border p-5 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">How it works</p>
            <ul className="space-y-1.5 font-mono text-[10px] text-muted-foreground/60">
              <li>• The gift card is delivered by email immediately after purchase.</li>
              <li>• The recipient enters the code at checkout to redeem their balance.</li>
              <li>• Gift cards never expire and can be used across multiple orders.</li>
              <li>• Gift cards cannot be used to purchase other gift cards.</li>
            </ul>
          </div>

          {/* Add to cart CTA */}
          <button
            onClick={handleAddToCart}
            disabled={added || amountLek === 0}
            className="w-full bg-foreground py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {added
              ? "Added — redirecting to checkout…"
              : amountLek > 0
                ? `Add to cart — ${formatLek(amountLek)}`
                : "Select an amount"}
          </button>

        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface GiftFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}

function GiftField({ label, value, onChange, error, type = "text", placeholder }: GiftFieldProps) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ fontSize: '16px' }}
        className={`mt-2 w-full border-b bg-transparent pb-2.5 font-mono text-ink outline-none placeholder:text-muted-foreground/30 transition-colors focus:border-ink/60 ${
          error ? "border-clay" : "border-border"
        }`}
      />
      {error && <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-clay">{error}</p>}
    </div>
  );
}
