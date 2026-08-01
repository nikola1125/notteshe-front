import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useCart } from "@/store/cartStore";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  address2: string;
  city: string;
  postalCode: string;
  country: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
}

const EMPTY_FORM: FormState = {
  email: "",
  firstName: "",
  lastName: "",
  address: "",
  address2: "",
  city: "",
  postalCode: "",
  country: "",
  cardNumber: "",
  cardExpiry: "",
  cardCvc: "",
};

function formatCard(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
  return digits;
}

function CheckoutPage() {
  const { items, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [orderRef] = useState(() => `NTS-${Math.floor(10000 + Math.random() * 90000)}`);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = subtotal >= 200 ? 0 : 12;
  const total = subtotal + shipping;

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const required: (keyof FormState)[] = [
      "email", "firstName", "lastName", "address", "city", "postalCode", "country",
      "cardNumber", "cardExpiry", "cardCvc",
    ];
    const next: Partial<FormState> = {};
    for (const k of required) {
      if (!form[k].trim()) next[k] = "Required";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Enter a valid email";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setTimeout(() => {
      clearCart();
      setConfirmed(true);
      setSubmitting(false);
    }, 1400);
  }

  if (items.length === 0 && !confirmed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-5 text-center">
        <p className="serif text-3xl text-ink">Your bag is empty.</p>
        <Link
          to="/shop"
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink"
        >
          ← Back to shop
        </Link>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border">
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-ink">
            <polyline points="1 8 7 14 21 1" />
          </svg>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Order confirmed</p>
          <h1 className="serif mt-3 text-4xl text-ink md:text-5xl">Thank you.</h1>
          <p className="mt-4 font-mono text-[11px] text-muted-foreground/70">
            Ref. <span className="text-ink">{orderRef}</span>
          </p>
        </div>
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          A confirmation has been sent to <span className="text-ink">{form.email}</span>. Your order will be dispatched within 2 working days.
        </p>
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1600px] px-5 pb-24 pt-24 md:px-12 md:pt-32">

        {/* Page title */}
        <div className="mb-10 md:mb-14">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Checkout</p>
          <h1 className="serif mt-2 text-4xl text-ink md:text-5xl">Your order</h1>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_400px] lg:gap-20">

            {/* ── Left: form ── */}
            <div className="space-y-10">

              {/* Contact */}
              <fieldset>
                <legend className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Contact
                </legend>
                <Field
                  label="Email address"
                  value={form.email}
                  onChange={(v) => set("email", v)}
                  error={errors.email}
                  type="email"
                  placeholder="you@somewhere.com"
                />
              </fieldset>

              {/* Shipping */}
              <fieldset>
                <legend className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Shipping address
                </legend>
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First name" value={form.firstName} onChange={(v) => set("firstName", v)} error={errors.firstName} />
                    <Field label="Last name"  value={form.lastName}  onChange={(v) => set("lastName", v)}  error={errors.lastName}  />
                  </div>
                  <Field label="Address" value={form.address}  onChange={(v) => set("address", v)}  error={errors.address}  placeholder="Street and number" />
                  <Field label="Apartment, suite, etc. (optional)" value={form.address2} onChange={(v) => set("address2", v)} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="City"        value={form.city}       onChange={(v) => set("city", v)}       error={errors.city}       />
                    <Field label="Postal code" value={form.postalCode} onChange={(v) => set("postalCode", v)} error={errors.postalCode} />
                  </div>
                  <Field label="Country" value={form.country} onChange={(v) => set("country", v)} error={errors.country} placeholder="e.g. Italy" />
                </div>
              </fieldset>

              {/* Payment */}
              <fieldset>
                <legend className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Payment
                </legend>
                <div className="space-y-5">
                  <Field
                    label="Card number"
                    value={form.cardNumber}
                    onChange={(v) => set("cardNumber", formatCard(v))}
                    error={errors.cardNumber}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    inputMode="numeric"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Expiry"
                      value={form.cardExpiry}
                      onChange={(v) => set("cardExpiry", formatExpiry(v))}
                      error={errors.cardExpiry}
                      placeholder="MM / YY"
                      maxLength={7}
                      inputMode="numeric"
                    />
                    <Field
                      label="CVC"
                      value={form.cardCvc}
                      onChange={(v) => set("cardCvc", v.replace(/\D/g, "").slice(0, 4))}
                      error={errors.cardCvc}
                      placeholder="123"
                      maxLength={4}
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="1" y="5" width="8" height="6" rx="0.5" />
                    <path d="M3 5V3.5a2 2 0 0 1 4 0V5" />
                  </svg>
                  SSL secured · Your data is never stored
                </p>
              </fieldset>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-ink py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    Placing order…
                  </span>
                ) : (
                  `Place order — €${total.toFixed(0)}`
                )}
              </button>

              <p className="text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                By placing your order you agree to our{" "}
                <a href="#" className="underline underline-offset-2 hover:text-muted-foreground">Terms</a> and{" "}
                <a href="#" className="underline underline-offset-2 hover:text-muted-foreground">Privacy policy</a>
              </p>
            </div>

            {/* ── Right: order summary ── */}
            <div className="lg:sticky lg:top-28 lg:self-start">
              <div className="border border-border p-6">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Order summary
                </p>

                {/* Items */}
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
                    <span>Subtotal</span>
                    <span>€{subtotal.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[11px] text-ink/60">
                    <span>Shipping</span>
                    <span>{shipping === 0 ? "Free" : `€${shipping}`}</span>
                  </div>
                  {shipping > 0 && (
                    <p className="font-mono text-[9px] text-muted-foreground/40">
                      Free shipping on orders over €200
                    </p>
                  )}
                </div>

                <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total</p>
                  <p className="serif text-2xl text-ink">€{total.toFixed(0)}</p>
                </div>
              </div>

              <Link
                to="/shop"
                className="mt-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 transition hover:text-ink"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M8 1 3 6l5 5" />
                </svg>
                Continue shopping
              </Link>
            </div>

          </div>
        </form>
      </div>
    </div>
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
      <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
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
      {error && (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-clay">{error}</p>
      )}
    </div>
  );
}
