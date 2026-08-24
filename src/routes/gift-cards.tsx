import "@nebula-ltd/pok-payments-js/lib/index.css";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";
import { useState, useEffect, useRef, Suspense, lazy, useCallback } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useSession } from "@/lib/auth/client";
import { useAuthStore } from "@/store/authStore";
import { useCurrency } from "@/store/currencyStore";
import { useRate } from "@/components/Price";
import { formatMoney } from "@/lib/currency";
import { placeOrder } from "@/lib/orders";

const GuestCheckoutForm = lazy(() =>
  import("@nebula-ltd/pok-payments-js/react").then((m) => ({
    default: m.GuestCheckoutForm,
  }))
);

// ─── Server fns ───────────────────────────────────────────────────────────────

const getGiftCardConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("@/db");
  const { shippingConfig } = await import("@/db/schema");
  let eurToLekRate = 100;
  let paymentFeeEnabled = false;
  let paymentFeePercent = 0;
  let paymentFeeFixed = 0;
  try {
    const [cfg] = await db()
      .select({
        eurToLekRate: shippingConfig.eurToLekRate,
        paymentFeeEnabled: shippingConfig.paymentFeeEnabled,
        paymentFeePercent: shippingConfig.paymentFeePercent,
        paymentFeeFixed: shippingConfig.paymentFeeFixed,
      })
      .from(shippingConfig)
      .limit(1);
    if (cfg) {
      eurToLekRate = cfg.eurToLekRate ?? 100;
      paymentFeeEnabled = cfg.paymentFeeEnabled ?? false;
      paymentFeePercent = cfg.paymentFeePercent ?? 0;
      paymentFeeFixed = cfg.paymentFeeFixed ?? 0;
    }
  } catch { /* not migrated */ }
  return { eurToLekRate, paymentFeeEnabled, paymentFeePercent, paymentFeeFixed };
});

const CreateGiftCardPokOrderSchema = z.object({
  merchantReference: z.string().uuid(),
  currency: z.enum(["EUR", "ALL"]).default("EUR"),
  amountLek: z.number().positive(),
  recipientEmail: z.string().email(),
  recipientName: z.string().min(1),
  message: z.string().optional(),
  forSelf: z.boolean(),
  purchaserEmail: z.string().email(),
  purchaserFirstName: z.string(),
  purchaserLastName: z.string(),
});

const createGiftCardPokOrder = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateGiftCardPokOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/lib/auth/session");
    const session = await requireAuth();
    const { db } = await import("@/db");
    const { shippingConfig, pendingOrder } = await import("@/db/schema");
    const { randomUUID } = await import("node:crypto");

    let eurToLekRate = 100;
    let paymentFeeEnabled = false;
    let paymentFeePercent = 0;
    let paymentFeeFixed = 0;
    try {
      const [cfg] = await db()
        .select({
          eurToLekRate: shippingConfig.eurToLekRate,
          paymentFeeEnabled: shippingConfig.paymentFeeEnabled,
          paymentFeePercent: shippingConfig.paymentFeePercent,
          paymentFeeFixed: shippingConfig.paymentFeeFixed,
        })
        .from(shippingConfig)
        .limit(1);
      if (cfg) {
        eurToLekRate = cfg.eurToLekRate ?? 100;
        paymentFeeEnabled = cfg.paymentFeeEnabled ?? false;
        paymentFeePercent = cfg.paymentFeePercent ?? 0;
        paymentFeeFixed = cfg.paymentFeeFixed ?? 0;
      }
    } catch { /* not migrated */ }

    // Minimum gift card: €10 in EUR, ALL 1,000 in Lek. Enforced server-side so
    // it can't be bypassed by calling the endpoint directly.
    const minGiftLek = data.currency === "ALL" ? 1000 : Math.round(10 * eurToLekRate);
    if (data.amountLek < minGiftLek) {
      throw new Error(`Minimum gift card amount is ${data.currency === "ALL" ? "ALL 1,000" : "€10"}.`);
    }

    const priceEur = Math.round((data.amountLek / eurToLekRate) * 100) / 100;
    const paymentFee = paymentFeeEnabled
      ? Math.round((priceEur * (paymentFeePercent / 100) + paymentFeeFixed) * 100) / 100
      : 0;
    const total = Math.round((priceEur + paymentFee) * 100) / 100;

    // POK charge in selected currency
    const toCharge = (eur: number) =>
      data.currency === "ALL"
        ? Math.round(eur * eurToLekRate)
        : Math.round(eur * 100) / 100;
    const chargeTotal = toCharge(total);

    const minCharge = data.currency === "ALL" ? 50 : 0.5;
    if (chargeTotal < minCharge) {
      const label = data.currency === "ALL" ? "50 L" : "0.50 €";
      throw new Error(`Amount is below the minimum required for card payment (${label}).`);
    }

    // Build the order data for pendingOrder (reused by placeOrder and webhook)
    const orderData = {
      email: data.purchaserEmail,
      phone: "",
      firstName: data.purchaserFirstName,
      lastName: data.purchaserLastName,
      address: "Digital delivery",
      city: "—",
      postalCode: "—",
      country: "AL",
      discountCode: null,
      discountAmount: 0,
      giftCardCode: null,
      giftCardAmountLek: 0,
      items: [{
        productId: `gift-card-${data.amountLek}`,
        name: `Gift Card — ALL ${data.amountLek.toLocaleString()}`,
        size: "",
        colour: "",
        image: "/images/gift-card-placeholder.jpg",
        price: priceEur,
        originalPrice: null,
        quantity: 1,
        isGiftCard: true,
        giftCardAmountLek: data.amountLek,
        giftCardRecipientEmail: data.forSelf ? data.purchaserEmail : data.recipientEmail,
        giftCardRecipientName: data.forSelf ? data.purchaserFirstName : data.recipientName,
        giftCardMessage: data.message ?? null,
        giftCardForSelf: data.forSelf,
      }],
      subtotal: priceEur,
      shippingFee: 0,
      paymentFee,
      total,
      currency: data.currency,
      pokAmount: chargeTotal,
    };

    // Authenticate with POK (inline — pokAuth is not exported from pok.ts)
    const POK_BASE = process.env.POK_ENV === "production"
      ? "https://api.pokpay.io/"
      : "https://api-staging.pokpay.io/";

    const authRes = await fetch(`${POK_BASE}auth/sdk/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId: process.env.POK_KEY_ID, keySecret: process.env.POK_KEY_SECRET }),
    });
    if (!authRes.ok) throw new Error(`POK auth failed (${authRes.status})`);
    const authJson = await authRes.json();
    const token = authJson?.data?.accessToken as string;
    if (!token) throw new Error("POK auth returned no token");

    const pokBody: Record<string, unknown> = {
      amount: chargeTotal,
      currencyCode: data.currency,
      autoCapture: true,
      products: [{ name: orderData.items[0].name, quantity: 1, price: chargeTotal }],
      shippingCost: 0,
      merchantCustomReference: data.merchantReference,
      expiresAfterMinutes: 30,
    };
    const { pokWebhookUrl } = await import("@/lib/pok");
    const webhookUrl = pokWebhookUrl();
    if (webhookUrl) pokBody.webhookUrl = webhookUrl;

    const orderRes = await fetch(
      `${POK_BASE}merchants/${process.env.POK_MERCHANT_ID}/sdk-orders`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(pokBody),
      }
    );
    if (!orderRes.ok) {
      const body = await orderRes.text().catch(() => "");
      throw new Error(`POK order creation failed (${orderRes.status}): ${body}`);
    }
    const orderJson = await orderRes.json();
    const pokOrderId = (orderJson?.data?.sdkOrder?.id ?? orderJson?.data?.id ?? orderJson?.id) as string | undefined;
    if (!pokOrderId) throw new Error("POK did not return an order ID");

    // Store in pendingOrder so webhook recovery + placeOrder can finalise
    const expiresAt = new Date(Date.now() + 35 * 60 * 1000);
    await db().insert(pendingOrder).values({
      id: randomUUID(),
      pokOrderId,
      userId: session.user.id,
      orderData,
      expiresAt,
    });

    return { pokOrderId };
  });

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/gift-cards")({
  head: () => ({
    meta: [
      { title: "Gift Cards — Notteshe" },
      { name: "description", content: "Give the gift of Notteshe — send a digital gift card in any amount, delivered instantly by email." },
      { property: "og:title", content: "Gift Cards — Notteshe" },
      { property: "og:description", content: "Give the gift of Notteshe — send a digital gift card, delivered instantly by email." },
      { property: "og:url", content: `${SITE_URL}/gift-cards` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/gift-cards` }],
  }),
  loader: async () => getGiftCardConfig(),
  component: GiftCardsPage,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_AMOUNTS_LEK = [2000, 5000, 10000, 20000];
const PRESET_AMOUNTS_EUR = [20, 50, 100, 200];
const POK_ENV = (typeof import.meta !== "undefined" && import.meta.env?.VITE_POK_ENV as "production" | "staging") || "staging";

function safeUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch { /* insecure context */ }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type Step = "form" | "initiating" | "payment" | "confirmed";

// ─── Component ────────────────────────────────────────────────────────────────

function GiftCardsPage() {
  const { eurToLekRate, paymentFeeEnabled, paymentFeePercent, paymentFeeFixed } = Route.useLoaderData();
  const { data: session } = useSession();
  const { openAuthModal } = useAuthStore();
  const navigate = useNavigate();
  const currency = useCurrency();
  const rate = useRate();

  const [step, setStep] = useState<Step>("form");
  const [pokOrderId, setPokOrderId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successFiredRef = useRef(false);
  const initiatingRef = useRef(false);

  const [presetIdx, setPresetIdx] = useState<number | null>(1); // index into PRESET_AMOUNTS_LEK / EUR
  const [customInput, setCustomInput] = useState("");
  const [forSelf, setForSelf] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => setMounted(true), []);

  const amountLek = presetIdx !== null
    ? (currency === "ALL"
        ? PRESET_AMOUNTS_LEK[presetIdx]
        : Math.round(PRESET_AMOUNTS_EUR[presetIdx] * eurToLekRate))
    : currency === "ALL"
      ? (parseInt(customInput.replace(/\D/g, ""), 10) || 0)
      : Math.round((parseFloat(customInput) || 0) * eurToLekRate);
  const amountEur = amountLek / eurToLekRate;
  const paymentFee = paymentFeeEnabled
    ? Math.round((amountEur * (paymentFeePercent / 100) + paymentFeeFixed) * 100) / 100
    : 0;
  const totalEur = Math.round((amountEur + paymentFee) * 100) / 100;

  // Show amounts in the selected currency; hint shows the other currency below
  function displayAmount(lek: number) {
    if (currency === "ALL") return `ALL ${lek.toLocaleString()}`;
    return formatMoney(lek / eurToLekRate, "EUR", 1);
  }
  function hintAmount(lek: number) {
    if (currency === "ALL") return formatMoney(lek / eurToLekRate, "EUR", 1);
    return `ALL ${lek.toLocaleString()}`;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const minGiftLek = currency === "ALL" ? 1000 : Math.round(10 * eurToLekRate);
    if (amountLek <= 0) next.amount = "Select or enter an amount";
    else if (amountLek < minGiftLek) next.amount = `Minimum gift card is ${currency === "ALL" ? "ALL 1,000" : "€10"}`;
    else if (amountLek > 100000) next.amount = `Maximum amount is ${displayAmount(100000)}`;
    if (!forSelf) {
      if (!recipientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))
        next.recipientEmail = "Enter a valid email address";
      if (!recipientName.trim())
        next.recipientName = "Enter the recipient's name";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleBuy() {
    if (!session?.user) { openAuthModal("login"); return; }
    if (initiatingRef.current) return;
    if (!validate()) return;

    initiatingRef.current = true;
    successFiredRef.current = false;
    setInitiating(true);
    setError(null);

    try {
      const ref = safeUUID();
      const fullName = session.user.name ?? "";
      const spaceIdx = fullName.indexOf(" ");
      const firstName = spaceIdx > -1 ? fullName.slice(0, spaceIdx) : fullName;
      const lastName = spaceIdx > -1 ? fullName.slice(spaceIdx + 1) : "";

      const { pokOrderId: id } = await createGiftCardPokOrder({
        data: {
          merchantReference: ref,
          currency,
          amountLek,
          recipientEmail: forSelf ? session.user.email : recipientEmail.trim(),
          recipientName: forSelf ? firstName : recipientName.trim(),
          message: message.trim() || undefined,
          forSelf,
          purchaserEmail: session.user.email,
          purchaserFirstName: firstName,
          purchaserLastName: lastName,
        },
      });
      setPokOrderId(id);
      setStep("payment");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to payment provider. Please try again.");
      setStep("form");
    } finally {
      setInitiating(false);
      initiatingRef.current = false;
    }
  }

  const handlePokSuccess = useCallback(async () => {
    if (successFiredRef.current) return;
    successFiredRef.current = true;
    setPlacing(true);
    setError(null);
    try {
      await placeOrder({ data: { pokOrderId: pokOrderId! } });
      setStep("confirmed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : null;
      setError(
        `Your payment was processed but we couldn't confirm the order${msg ? `: ${msg}` : "."}  Please contact hello@notteshe.com.`
      );
    } finally {
      setPlacing(false);
    }
  }, [pokOrderId]);

  const handlePokError = useCallback((err: { type?: string; message?: string }) => {
    setError(err.message ?? "Payment was not completed. Please try again.");
    setStep("form");
    setPokOrderId(null);
  }, []);

  // ── Confirmed screen ──────────────────────────────────────────────────────────

  if (step === "confirmed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-5 text-center">
        <p className="serif text-4xl text-ink">Gift card sent.</p>
        <p className="font-mono text-[11px] text-muted-foreground/70">
          {forSelf ? "Your gift card has been delivered to your email." : `The gift card has been delivered to ${forSelf ? "you" : recipientEmail}.`}
        </p>
        <button
          onClick={() => void navigate({ to: "/shop", search: { sale: undefined } })}
          className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 transition hover:text-ink"
        >
          Continue shopping →
        </button>
      </div>
    );
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

        {/* ── Payment form (after POK order created) ── */}
        {(step === "payment" || step === "initiating") && pokOrderId && (
          <div>
            <button
              onClick={() => { setStep("form"); setPokOrderId(null); setError(null); successFiredRef.current = false; }}
              className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 transition-colors hover:text-ink"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><path d="M8 1 3 6l5 5" /></svg>
              Back
            </button>

            <div className="mb-6 border border-border p-5">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {forSelf ? "Gift card for yourself" : `Gift card for ${recipientName}`}
                </p>
                <p className="serif text-2xl text-ink">{displayAmount(amountLek)}</p>
              </div>
              {paymentFee > 0 && (
                <p className="mt-1 font-mono text-[9px] text-muted-foreground/50">
                  + {formatMoney(paymentFee, currency, rate)} payment fee · Total {formatMoney(totalEur, currency, rate)}
                </p>
              )}
            </div>

            <div className="border border-border">
              <div className="border-b border-border px-5 py-3">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">Secured payment — POK Pay</p>
              </div>
              <div className="p-5">
                {placing ? (
                  <div className="flex items-center justify-center gap-3 py-6">
                    <Spinner />
                    <p className="font-mono text-[11px] text-muted-foreground">Confirming your order…</p>
                  </div>
                ) : mounted ? (
                  <Suspense fallback={
                    <div className="flex items-center justify-center gap-3 py-10">
                      <Spinner />
                      <p className="font-mono text-[11px] text-muted-foreground">Loading payment form…</p>
                    </div>
                  }>
                    <GuestCheckoutForm
                      orderId={pokOrderId}
                      onSuccess={handlePokSuccess}
                      onError={handlePokError}
                      options={{
                        env: POK_ENV,
                        locale: "en",
                        countrySelect: "modal",
                        initialState: {
                          email: session?.user?.email ?? "",
                          holdersName: session?.user?.name ?? "",
                          address1: "",
                          locality: "",
                          postalCode: "",
                          phoneNumber: "",
                          countryCode: "AL",
                          cardNumber: "",
                          expiration: "",
                          securityCode: "",
                          administrativeArea: "",
                        },
                      }}
                    />
                  </Suspense>
                ) : (
                  <div className="flex items-center justify-center gap-3 py-10">
                    <Spinner />
                    <p className="font-mono text-[11px] text-muted-foreground">Loading…</p>
                  </div>
                )}
              </div>
            </div>

            {error && <p className="mt-4 font-mono text-[11px] text-clay">{error}</p>}
          </div>
        )}

        {/* ── Gift card form ── */}
        {step === "form" && (
          <div className="space-y-10">

            {/* Amount selector */}
            <div>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Amount</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRESET_AMOUNTS_LEK.map((lek, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => { setPresetIdx(idx); setCustomInput(""); setFieldErrors((e) => ({ ...e, amount: "" })); }}
                    className={`border py-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                      presetIdx === idx
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-transparent text-ink hover:border-ink/50"
                    }`}
                  >
                    {currency === "ALL" ? displayAmount(lek) : formatMoney(PRESET_AMOUNTS_EUR[idx], "EUR", 1)}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Custom amount ({currency === "ALL" ? "Lek" : "EUR"})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customInput}
                  onChange={(e) => {
                    const v = currency === "ALL"
                      ? e.target.value.replace(/\D/g, "")
                      : e.target.value.replace(/[^\d.]/g, "");
                    setCustomInput(v);
                    setPresetIdx(null);
                    setFieldErrors((er) => ({ ...er, amount: "" }));
                  }}
                  placeholder={currency === "ALL" ? "e.g. 7500" : "e.g. 75"}
                  style={{ fontSize: "16px" }}
                  className="mt-2 w-full border-b border-border bg-transparent pb-2.5 font-mono text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
                />
              </div>
              {fieldErrors.amount && <p className="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-clay">{fieldErrors.amount}</p>}

              {amountLek > 0 && (
                <p className="mt-3 font-mono text-[11px] text-muted-foreground/60">
                  ≈ {hintAmount(amountLek)}
                  {paymentFee > 0 && <span className="ml-2 text-muted-foreground/40">+ {formatMoney(paymentFee, currency, rate)} payment fee</span>}
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

            {/* Recipient details */}
            {!forSelf && (
              <div className="space-y-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gift details</p>
                <GiftField
                  label="Recipient name"
                  value={recipientName}
                  onChange={setRecipientName}
                  error={fieldErrors.recipientName}
                  placeholder="Their first name"
                />
                <GiftField
                  label="Recipient email"
                  value={recipientEmail}
                  onChange={setRecipientEmail}
                  error={fieldErrors.recipientEmail}
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
                    style={{ fontSize: "16px" }}
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

            {error && <p className="font-mono text-[11px] text-clay">{error}</p>}

            {/* CTA */}
            <button
              onClick={handleBuy}
              disabled={initiating || amountLek === 0}
              className="w-full bg-foreground py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {initiating
                ? <span className="flex items-center justify-center gap-3"><Spinner />Preparing payment…</span>
                : amountLek > 0
                  ? `Buy gift card — ${displayAmount(amountLek)}`
                  : "Select an amount"}
            </button>

            {!session?.user && (
              <p className="text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                You'll be asked to sign in before payment
              </p>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

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
        style={{ fontSize: "16px" }}
        className={`mt-2 w-full border-b bg-transparent pb-2.5 font-mono text-ink outline-none placeholder:text-muted-foreground/30 transition-colors focus:border-ink/60 ${
          error ? "border-clay" : "border-border"
        }`}
      />
      {error && <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-clay">{error}</p>}
    </div>
  );
}
