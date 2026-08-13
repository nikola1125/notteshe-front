import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
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
    const database = db();

    const rows = await database
      .select({ id: shippingConfig.id, enabled: shippingConfig.enabled, fee: shippingConfig.fee, freeThreshold: shippingConfig.freeThreshold, updatedAt: shippingConfig.updatedAt })
      .from(shippingConfig)
      .where(eq(shippingConfig.id, "default"))
      .limit(1);

    if (!rows[0]) {
      const defaults: ShippingConfig = {
        id: "default", enabled: true, fee: 12, freeThreshold: 200,
        paymentFeeEnabled: false, paymentFeePercent: 0, paymentFeeFixed: 0,
        updatedAt: new Date(),
      };
      await database.insert(shippingConfig).values(defaults);
      return defaults;
    }

    // Payment fee columns added in migration 0003 — read separately so page works before migration
    let paymentFeeEnabled = false;
    let paymentFeePercent = 0;
    let paymentFeeFixed = 0;
    try {
      const pf = await database
        .select({ paymentFeeEnabled: shippingConfig.paymentFeeEnabled, paymentFeePercent: shippingConfig.paymentFeePercent, paymentFeeFixed: shippingConfig.paymentFeeFixed })
        .from(shippingConfig)
        .where(eq(shippingConfig.id, "default"))
        .limit(1);
      paymentFeeEnabled = pf[0]?.paymentFeeEnabled ?? false;
      paymentFeePercent = pf[0]?.paymentFeePercent ?? 0;
      paymentFeeFixed = pf[0]?.paymentFeeFixed ?? 0;
    } catch { /* columns not yet migrated */ }

    return { ...rows[0], paymentFeeEnabled, paymentFeePercent, paymentFeeFixed };
  }
);

const saveShippingConfig = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as { enabled: boolean; fee: number; freeThreshold: number; paymentFeeEnabled: boolean; paymentFeePercent: number; paymentFeeFixed: number }
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();

    // Always save core fields
    await database
      .update(shippingConfig)
      .set({ enabled: data.enabled, fee: data.fee, freeThreshold: data.freeThreshold, updatedAt: new Date() })
      .where(eq(shippingConfig.id, "default"));

    // Save payment fee fields only if migration has been run
    try {
      await database
        .update(shippingConfig)
        .set({ paymentFeeEnabled: data.paymentFeeEnabled, paymentFeePercent: data.paymentFeePercent, paymentFeeFixed: data.paymentFeeFixed })
        .where(eq(shippingConfig.id, "default"));
    } catch { /* columns not yet migrated */ }

    await logAudit(admin.id, "shipping.update", "shipping_config", "default", { after: data });
    return { success: true };
  });

export const Route = createFileRoute("/admin/shipping")({
  loader: () => getShippingConfig(),
  staleTime: 60_000,
  component: Shipping,
});

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="checkbox"
      aria-checked={value}
      tabIndex={0}
      onClick={() => onChange(!value)}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange(!value); }}
      className={`h-5 w-9 cursor-pointer rounded-full transition-colors ${value ? "bg-[var(--color-clay)]" : "bg-[var(--color-muted)]"}`}
    >
      <div className={`mt-0.5 ml-0.5 h-4 w-4 rounded-full bg-white transition-transform ${value ? "translate-x-4" : "translate-x-0"}`} />
    </div>
  );
}

function Shipping() {
  const config = Route.useLoaderData();
  const [enabled, setEnabled] = useState(config.enabled);
  const [fee, setFee] = useState(String(config.fee));
  const [threshold, setThreshold] = useState(String(config.freeThreshold));
  const [percentEnabled, setPercentEnabled] = useState((config.paymentFeeEnabled ?? false) && (config.paymentFeePercent ?? 0) > 0);
  const [fixedEnabled, setFixedEnabled] = useState((config.paymentFeeEnabled ?? false) && (config.paymentFeeFixed ?? 0) > 0);
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
          paymentFeeEnabled: percentEnabled || fixedEnabled,
          paymentFeePercent: percentEnabled ? (parseFloat(paymentFeePercent) || 0) : 0,
          paymentFeeFixed: fixedEnabled ? (parseFloat(paymentFeeFixed) || 0) : 0,
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
      <BackButton />
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Shipping
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* ── Left: Shipping ── */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-6 space-y-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Shipping</p>

            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[var(--color-foreground)]">Shipping enabled</span>
              <Toggle value={enabled} onChange={setEnabled} />
            </div>

            <div>
              <label htmlFor="sh-fee" className={labelClass}>Flat fee (€)</label>
              <input
                id="sh-fee"
                type="number"
                step="0.01"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                disabled={!enabled}
                className={`${inputClass} disabled:opacity-40`}
              />
            </div>

            <div>
              <label htmlFor="sh-threshold" className={labelClass}>Free shipping threshold (€)</label>
              <input
                id="sh-threshold"
                type="number"
                step="0.01"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={!enabled}
                className={`${inputClass} disabled:opacity-40`}
              />
              <p className="mt-1 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                Orders above this amount get free shipping
              </p>
            </div>
          </div>

          {/* ── Right: Payment Processing Fee ── */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-6 space-y-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Payment Processing Fee</p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[var(--color-foreground)]">Percentage fee</span>
                <Toggle value={percentEnabled} onChange={setPercentEnabled} />
              </div>
              <div>
                <label htmlFor="pf-percent" className={labelClass}>Percentage (%)</label>
                <input
                  id="pf-percent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={paymentFeePercent}
                  onChange={(e) => setPaymentFeePercent(e.target.value)}
                  disabled={!percentEnabled}
                  className={`${inputClass} disabled:opacity-40`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-[var(--color-foreground)]">Fixed fee per transaction</span>
                <Toggle value={fixedEnabled} onChange={setFixedEnabled} />
              </div>
              <div>
                <label htmlFor="pf-fixed" className={labelClass}>Fixed amount (€)</label>
                <input
                  id="pf-fixed"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentFeeFixed}
                  onChange={(e) => setPaymentFeeFixed(e.target.value)}
                  disabled={!fixedEnabled}
                  className={`${inputClass} disabled:opacity-40`}
                />
              </div>
            </div>

            {(percentEnabled || fixedEnabled) && (
              <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                Fee per order:{" "}
                {[
                  percentEnabled && `${paymentFeePercent}% of total`,
                  fixedEnabled && `${paymentFeeFixed} € fixed`,
                ].filter(Boolean).join(" + ")}
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded bg-[var(--color-clay)] px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-50 lg:max-w-xs"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
