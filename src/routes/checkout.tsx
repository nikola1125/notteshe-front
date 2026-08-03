import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { useCart } from "@/store/cartStore";
import { useSession } from "@/lib/auth/client";
import { useAuthStore } from "@/store/authStore";
import { createPaymentIntent } from "@/lib/payment";

const getShipping = createServerFn({ method: "GET" }).handler(async () => {
  const { db } = await import("@/db");
  const { shippingConfig } = await import("@/db/schema");
  const rows = await db().select().from(shippingConfig).where(eq(shippingConfig.id, "default")).limit(1);
  if (rows[0]) return { enabled: rows[0].enabled, fee: rows[0].fee, freeThreshold: rows[0].freeThreshold };
  return { enabled: true, fee: 12, freeThreshold: 200 };
});

export const Route = createFileRoute("/checkout")({
  loader: () => getShipping(),
  component: CheckoutPage,
});

// Stripe publishable key — safe to expose in client
const stripePromise = loadStripe(
  typeof window !== "undefined"
    ? (import.meta.env["VITE_STRIPE_PUBLISHABLE_KEY"] as string) ?? ""
    : ""
);

interface ShippingForm {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  address2: string;
  city: string;
  postalCode: string;
  country: string;
}

const EMPTY_FORM: ShippingForm = {
  email: "", phone: "", firstName: "", lastName: "",
  address: "", address2: "", city: "", postalCode: "", country: "",
};

function CheckoutPage() {
  const { items } = useCart();
  const { data: session, isPending: sessionLoading } = useSession();
  const { openAuthModal } = useAuthStore();
  const shippingCfg = Route.useLoaderData();

  const [form, setForm] = useState<ShippingForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<ShippingForm>>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);

  // Autofill from session
  useEffect(() => {
    if (!session?.user) return;
    const fullName = session.user.name ?? "";
    const spaceIdx = fullName.indexOf(" ");
    const firstName = spaceIdx > -1 ? fullName.slice(0, spaceIdx) : fullName;
    const lastName = spaceIdx > -1 ? fullName.slice(spaceIdx + 1) : "";
    setForm((f) => ({
      ...f,
      email: f.email || session.user.email || "",
      firstName: f.firstName || firstName,
      lastName: f.lastName || lastName,
    }));
  }, [session?.user?.id]);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = !shippingCfg.enabled ? 0
    : subtotal >= shippingCfg.freeThreshold ? 0
    : shippingCfg.fee;
  const total = subtotal + shipping;

  function set(field: keyof ShippingForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validateShipping(): boolean {
    const required: (keyof ShippingForm)[] = [
      "email", "phone", "firstName", "lastName", "address", "city", "postalCode", "country",
    ];
    const next: Partial<ShippingForm> = {};
    for (const k of required) {
      if (!form[k].trim()) next[k] = "Required";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const handleProceedToPayment = useCallback(async () => {
    if (!validateShipping()) return;
    setIntentLoading(true);
    setIntentError(null);
    try {
      const { clientSecret: secret } = await createPaymentIntent({
        data: {
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            originalPrice: i.originalPrice,
            image: i.image,
            size: i.size,
            colour: i.colour,
            quantity: i.quantity,
          })),
          shippingAddress: {
            email: form.email,
            phone: form.phone,
            firstName: form.firstName,
            lastName: form.lastName,
            address: form.address,
            address2: form.address2 || undefined,
            city: form.city,
            postalCode: form.postalCode,
            country: form.country,
          },
        },
      });
      setClientSecret(secret);
    } catch {
      setIntentError("Something went wrong. Please try again.");
    } finally {
      setIntentLoading(false);
    }
  }, [form, items]);

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <svg className="animate-spin text-muted-foreground" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      </div>
    );
  }

  if (!session?.user && items.length > 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-5 text-center">
        <p className="serif text-3xl text-ink">Sign in to continue.</p>
        <p className="font-mono text-[11px] text-muted-foreground">You need an account to place an order.</p>
        <button
          onClick={() => openAuthModal("login")}
          className="bg-ink px-8 py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90"
        >
          Sign in / Create account
        </button>
        <Link to="/shop" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink">
          ← Back to shop
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-5 text-center">
        <p className="serif text-3xl text-ink">Your bag is empty.</p>
        <Link to="/shop" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink">
          ← Back to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1600px] px-5 pb-24 pt-24 md:px-12 md:pt-32">

        <div className="mb-10 md:mb-14">
          <button
            onClick={() => window.history.back()}
            className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M9 2 4 7l5 5" />
            </svg>
            Back
          </button>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Checkout</p>
          <h1 className="serif mt-2 text-4xl text-ink md:text-5xl">Your order</h1>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_400px] lg:gap-20">

          {/* Order summary */}
          <div className="order-first lg:order-last lg:sticky lg:top-28 lg:self-start">
            <div className="border border-border p-6">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Order summary</p>
              <ul className="mt-6 space-y-5">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-4">
                    <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden bg-muted">
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink font-mono text-[9px] text-background">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col justify-between py-0.5">
                      <div>
                        <p className="serif text-[14px] text-ink">{item.name}</p>
                        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                          {item.size} · {item.colour}
                        </p>
                      </div>
                      <div>
                        {item.originalPrice && (
                          <p className="font-mono text-[10px] text-muted-foreground line-through">€{item.originalPrice}</p>
                        )}
                        <p className={`font-mono text-[12px] ${item.originalPrice ? "text-clay" : "text-ink"}`}>
                          €{(item.price * item.quantity).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <div className="flex justify-between font-mono text-[11px] text-ink/60">
                  <span>Subtotal</span><span>€{subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-ink/60">
                  <span>Shipping</span><span>{shipping === 0 ? "Free" : `€${shipping}`}</span>
                </div>
                {shippingCfg.enabled && shipping > 0 && (
                  <p className="font-mono text-[9px] text-muted-foreground/40">Free shipping on orders over €{shippingCfg.freeThreshold}</p>
                )}
              </div>
              <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
                <p className="serif text-2xl text-ink">€{total.toFixed(0)}</p>
              </div>
            </div>
            <Link to="/shop" className="mt-4 hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 transition hover:text-ink lg:flex">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><path d="M8 1 3 6l5 5" /></svg>
              Continue shopping
            </Link>
          </div>

          {/* Form */}
          <div className="space-y-10 lg:order-first">
            {!clientSecret ? (
              <>
                {/* Contact */}
                <fieldset>
                  <legend className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Contact</legend>
                  <div className="space-y-5">
                    <Field label="Email address" value={form.email} onChange={(v) => set("email", v)} error={errors.email} type="email" placeholder="you@somewhere.com" />
                    <Field label="Phone number" value={form.phone} onChange={(v) => set("phone", v)} error={errors.phone} type="tel" placeholder="+355 69 123 4567" inputMode="tel" />
                  </div>
                </fieldset>

                {/* Shipping */}
                <fieldset>
                  <legend className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Shipping address</legend>
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="First name" value={form.firstName} onChange={(v) => set("firstName", v)} error={errors.firstName} />
                      <Field label="Last name" value={form.lastName} onChange={(v) => set("lastName", v)} error={errors.lastName} />
                    </div>
                    <Field label="Address" value={form.address} onChange={(v) => set("address", v)} error={errors.address} placeholder="Street and number" />
                    <Field label="Apartment, suite, etc. (optional)" value={form.address2} onChange={(v) => set("address2", v)} />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="City" value={form.city} onChange={(v) => set("city", v)} error={errors.city} />
                      <Field label="Postal code" value={form.postalCode} onChange={(v) => set("postalCode", v)} error={errors.postalCode} />
                    </div>
                    <Field label="Country" value={form.country} onChange={(v) => set("country", v)} error={errors.country} placeholder="e.g. Italy" />
                  </div>
                </fieldset>

                {intentError && (
                  <p className="font-mono text-[11px] text-clay">{intentError}</p>
                )}

                <button
                  onClick={handleProceedToPayment}
                  disabled={intentLoading}
                  className="w-full bg-ink py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90 disabled:opacity-50"
                >
                  {intentLoading ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Preparing payment…
                    </span>
                  ) : (
                    `Continue to payment — €${total.toFixed(0)}`
                  )}
                </button>
              </>
            ) : (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#111111",
                      colorBackground: "#FAFAFA",
                      colorText: "#111111",
                      colorDanger: "#DC2626",
                      fontFamily: "Montserrat, sans-serif",
                      borderRadius: "0px",
                    },
                  },
                }}
              >
                <PaymentStep total={total} onBack={() => setClientSecret(null)} />
              </Elements>
            )}

            <p className="text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
              By placing your order you agree to our{" "}
              <a href="#" className="underline underline-offset-2 hover:text-muted-foreground">Terms</a> and{" "}
              <a href="#" className="underline underline-offset-2 hover:text-muted-foreground">Privacy policy</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentStep({ total, onBack }: { total: number; onBack: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { clearCart } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmed`,
      },
    });

    if (stripeError) {
      setError(stripeError.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
    } else {
      clearCart();
      void navigate({ to: "/order-confirmed" });
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-8">
      <div>
        <div className="mb-6 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Payment</p>
          <button
            type="button"
            onClick={onBack}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 transition hover:text-ink"
          >
            ← Edit details
          </button>
        </div>
        <PaymentElement />
      </div>

      {error && <p className="font-mono text-[11px] text-clay">{error}</p>}

      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full bg-ink py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            Processing…
          </span>
        ) : (
          `Pay €${total.toFixed(0)}`
        )}
      </button>

      <p className="flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="1" y="5" width="8" height="6" rx="0.5" />
          <path d="M3 5V3.5a2 2 0 0 1 4 0V5" />
        </svg>
        Secured by Stripe · SSL encrypted
      </p>
    </form>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}

function Field({ label, value, onChange, error, type = "text", placeholder, maxLength, inputMode }: FieldProps) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        className={`mt-2 w-full border-b bg-transparent pb-2.5 text-[14px] text-ink outline-none placeholder:text-muted-foreground/30 transition-colors focus:border-ink/60 ${
          error ? "border-clay" : "border-border"
        }`}
      />
      {error && <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-clay">{error}</p>}
    </div>
  );
}
