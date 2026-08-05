import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { toast } from "sonner";
import { useState } from "react";
import { db } from "@/db";
import { shippingConfig } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import type { ShippingConfig } from "@/db/schema";

const getShippingConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShippingConfig> => {
    await requireAdmin();
    const rows = await db()
      .select()
      .from(shippingConfig)
      .where(eq(shippingConfig.id, "default"))
      .limit(1);

    if (rows[0]) return rows[0];

    // Create default row if not present
    const defaults: ShippingConfig = {
      id: "default",
      enabled: true,
      fee: 12,
      freeThreshold: 200,
      updatedAt: new Date(),
    };
    await db().insert(shippingConfig).values(defaults);
    return defaults;
  }
);

const saveShippingConfig = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as { enabled: boolean; fee: number; freeThreshold: number; paymentFeeEnabled: boolean; paymentFeePercent: number; paymentFeeFixed: number }
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(shippingConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shippingConfig.id, "default"));
    await logAudit(admin.id, "shipping.update", "shipping_config", "default", {
      after: data,
    });
    return { success: true };
  });

export const Route = createFileRoute("/admin/shipping")({
  loader: () => getShippingConfig(),
  staleTime: 60_000,
  component: Shipping,
});

function Shipping() {
  const config = Route.useLoaderData();
  const [enabled, setEnabled] = useState(config.enabled);
  const [fee, setFee] = useState(String(config.fee));
  const [threshold, setThreshold] = useState(String(config.freeThreshold));
  const [paymentFeeEnabled, setPaymentFeeEnabled] = useState(config.paymentFeeEnabled ?? false);
  const [paymentFeePercent, setPaymentFeePercent] = useState(String(config.paymentFeePercent ?? 0));
  const [paymentFeeFixed, setPaymentFeeFixed] = useState(String(config.paymentFeeFixed ?? 0));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveShippingConfig({
        data: {
          enabled,
          fee: parseFloat(fee) || 0,
          freeThreshold: parseFloat(threshold) || 0,
          paymentFeeEnabled,
          paymentFeePercent: parseFloat(paymentFeePercent) || 0,
          paymentFeeFixed: parseFloat(paymentFeeFixed) || 0,
        },
      });
      toast.success("Shipping config saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]";
  const labelClass =
    "block mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]";

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Shipping
      </h1>

      <form
        onSubmit={handleSubmit}
        className="max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-6 space-y-5"
      >
        {/* Enabled toggle */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-[var(--color-foreground)]">
            Shipping enabled
          </span>
          <div
            role="checkbox"
            aria-checked={enabled}
            tabIndex={0}
            onClick={() => setEnabled((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") setEnabled((v) => !v);
            }}
            className={`h-5 w-9 cursor-pointer rounded-full transition-colors ${enabled ? "bg-[var(--color-clay)]" : "bg-[var(--color-muted)]"}`}
          >
            <div
              className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="sh-fee" className={labelClass}>
            Flat fee (L)
          </label>
          <input
            id="sh-fee"
            type="number"
            step="0.01"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="sh-threshold" className={labelClass}>
            Free shipping threshold (L)
          </label>
          <input
            id="sh-threshold"
            type="number"
            step="0.01"
            min="0"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 font-mono text-[10px] text-[var(--color-muted-foreground)]">
            Orders above this amount get free shipping
          </p>
        </div>

        <div className="border-t border-[var(--color-border)] pt-5">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Payment Processing Fee
          </p>

          <div className="mb-4 flex items-center justify-between">
            <span className="font-mono text-xs text-[var(--color-foreground)]">
              Charge fee to customer
            </span>
            <div
              role="checkbox"
              aria-checked={paymentFeeEnabled}
              tabIndex={0}
              onClick={() => setPaymentFeeEnabled((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") setPaymentFeeEnabled((v) => !v);
              }}
              className={`h-5 w-9 cursor-pointer rounded-full transition-colors ${paymentFeeEnabled ? "bg-[var(--color-clay)]" : "bg-[var(--color-muted)]"}`}
            >
              <div
                className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white transition-transform ${paymentFeeEnabled ? "translate-x-4" : "translate-x-0"}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pf-percent" className={labelClass}>
                Percentage (%)
              </label>
              <input
                id="pf-percent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={paymentFeePercent}
                onChange={(e) => setPaymentFeePercent(e.target.value)}
                disabled={!paymentFeeEnabled}
                className={`${inputClass} disabled:opacity-40`}
              />
            </div>
            <div>
              <label htmlFor="pf-fixed" className={labelClass}>
                Fixed amount (L)
              </label>
              <input
                id="pf-fixed"
                type="number"
                step="0.01"
                min="0"
                value={paymentFeeFixed}
                onChange={(e) => setPaymentFeeFixed(e.target.value)}
                disabled={!paymentFeeEnabled}
                className={`${inputClass} disabled:opacity-40`}
              />
            </div>
          </div>
          {paymentFeeEnabled && (
            <p className="mt-2 font-mono text-[10px] text-[var(--color-muted-foreground)]">
              Fee = {paymentFeePercent}% of order total + {paymentFeeFixed} L per transaction
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded bg-[var(--color-clay)] px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
