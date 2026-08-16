import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ─── Server fns ───────────────────────────────────────────────────────────────

const getGiftCard = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin/auth");
    await requireAdmin();
    const { db } = await import("@/db");
    const { giftCard, giftCardTransaction } = await import("@/db/schema");
    const { eq, desc } = await import("drizzle-orm");

    const [gc] = await db().select().from(giftCard).where(eq(giftCard.id, data.id)).limit(1);
    if (!gc) throw new Error("Gift card not found.");

    const txns = await db()
      .select()
      .from(giftCardTransaction)
      .where(eq(giftCardTransaction.giftCardId, data.id))
      .orderBy(desc(giftCardTransaction.createdAt));

    return { gc, txns };
  });

const adjustGiftCard = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      id: z.string(),
      action: z.enum(["refund", "disable", "enable", "adjust", "resend"]),
      amountLek: z.number().optional(),
      note: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("@/lib/admin/auth");
    const admin = await requireAdmin();
    const { db } = await import("@/db");
    const { giftCard, giftCardTransaction } = await import("@/db/schema");
    const { eq, sql } = await import("drizzle-orm");
    const { randomUUID } = await import("node:crypto");

    // sql is imported for completeness but only used in conditional updates
    void sql;

    const [gc] = await db().select().from(giftCard).where(eq(giftCard.id, data.id)).limit(1);
    if (!gc) throw new Error("Gift card not found.");

    if (data.action === "disable") {
      await db().update(giftCard).set({ status: "disabled" }).where(eq(giftCard.id, data.id));
      return { success: true };
    }

    if (data.action === "enable") {
      const newStatus = gc.balance <= 0 ? "depleted" : "active";
      await db().update(giftCard).set({ status: newStatus }).where(eq(giftCard.id, data.id));
      return { success: true };
    }

    if (data.action === "refund") {
      const refundAmount = gc.initialAmount;
      const newBalance = Math.min(gc.initialAmount, gc.balance + refundAmount);
      if (newBalance === gc.balance) return { success: true };
      await db().update(giftCard)
        .set({ balance: newBalance, status: newBalance > 0 ? "active" : gc.status })
        .where(eq(giftCard.id, data.id));
      await db().insert(giftCardTransaction).values({
        id: randomUUID(),
        giftCardId: gc.id,
        type: "refund",
        amount: newBalance - gc.balance,
        balanceAfter: newBalance,
        adminId: admin.id,
        note: data.note ?? "Admin refund",
      });
      return { success: true };
    }

    if (data.action === "adjust") {
      const delta = data.amountLek ?? 0;
      const newBalance = Math.max(0, gc.balance + delta);
      const newStatus = newBalance <= 0 ? "depleted" : gc.status === "depleted" ? "active" : gc.status;
      await db().update(giftCard)
        .set({ balance: newBalance, status: newStatus })
        .where(eq(giftCard.id, data.id));
      await db().insert(giftCardTransaction).values({
        id: randomUUID(),
        giftCardId: gc.id,
        type: "adjust",
        amount: delta,
        balanceAfter: newBalance,
        adminId: admin.id,
        note: data.note ?? "Admin adjustment",
      });
      return { success: true };
    }

    if (data.action === "resend") {
      const { sendGiftCardDelivery } = await import("@/lib/resend");
      await sendGiftCardDelivery({
        to: gc.recipientEmail,
        recipientName: gc.recipientName,
        senderName: gc.purchaserEmail,
        code: gc.code,
        amountLek: gc.balance,
        message: gc.message ?? null,
      });
      return { success: true };
    }

    return { success: false };
  });

// ─── Types ────────────────────────────────────────────────────────────────────

type PageData = Awaited<ReturnType<typeof getGiftCard>>;

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/gift-cards/$id")({
  loader: async ({ params }) => getGiftCard({ data: { id: params.id } }),
  component: AdminGiftCardDetailPage,
});

// ─── Component ────────────────────────────────────────────────────────────────

function AdminGiftCardDetailPage() {
  const loaded = Route.useLoaderData() as PageData;
  const navigate = useNavigate();
  const [data, setData] = useState(loaded);
  const { gc, txns } = data;

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Adjust modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  async function doAction(action: "refund" | "disable" | "enable" | "adjust" | "resend", extra?: { amountLek?: number; note?: string }) {
    setBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await adjustGiftCard({ data: { id: gc.id, action, ...extra } });
      // Reload
      const fresh = await getGiftCard({ data: { id: gc.id } });
      setData(fresh);
      setActionSuccess(`${action} applied successfully.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdjust() {
    const parsed = parseFloat(adjustDelta.replace(",", "."));
    if (isNaN(parsed) || parsed === 0) { setActionError("Enter a non-zero amount (positive to add, negative to deduct)"); return; }
    setShowAdjust(false);
    await doAction("adjust", { amountLek: parsed, note: adjustNote || undefined });
    setAdjustDelta("");
    setAdjustNote("");
  }

  function statusColor(status: string) {
    if (status === "active") return "text-green-400";
    if (status === "depleted") return "text-muted-foreground/40";
    if (status === "disabled") return "text-clay";
    return "text-muted-foreground/60";
  }

  function txnColor(type: string) {
    if (type === "issue" || type === "refund") return "text-green-400";
    if (type === "redeem") return "text-clay";
    return "text-muted-foreground/60";
  }

  return (
    <div className="p-6 md:p-10">
      <button
        onClick={() => void navigate({ to: "/admin/gift-cards" })}
        className="mb-8 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 transition-colors hover:text-ink"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1"><path d="M8 1 3 6l5 5" /></svg>
        Gift cards
      </button>

      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gift card</p>
        <h1 className="serif mt-1 text-3xl text-ink">{gc.code}</h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">

        {/* Details */}
        <div className="space-y-8">
          <div className="border border-border p-6 space-y-4">
            <Row label="Status" value={<span className={`font-mono text-[11px] uppercase tracking-widest ${statusColor(gc.status)}`}>{gc.status}</span>} />
            <Row label="Balance" value={`${gc.balance.toLocaleString()} L`} />
            <Row label="Initial amount" value={`${gc.initialAmount.toLocaleString()} L`} />
            <Row label="Recipient" value={`${gc.recipientName} — ${gc.recipientEmail}`} />
            <Row label="Purchaser" value={gc.purchaserEmail} />
            {gc.message && <Row label="Message" value={gc.message} />}
            <Row label="Issued" value={new Date(gc.createdAt).toLocaleString()} />
            {gc.lastUsedAt && <Row label="Last used" value={new Date(gc.lastUsedAt).toLocaleString()} />}
            {gc.expiresAt && <Row label="Expires" value={new Date(gc.expiresAt).toLocaleString()} />}
            {gc.sourceOrderId && <Row label="Source order" value={gc.sourceOrderId.slice(0, 8).toUpperCase()} />}
          </div>

          {/* Transaction ledger */}
          <div>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Transaction history</p>
            {txns.length === 0 ? (
              <p className="font-mono text-[11px] text-muted-foreground/40">No transactions yet.</p>
            ) : (
              <div className="border border-border divide-y divide-border/40">
                {txns.map((t) => (
                  <div key={t.id} className="flex items-start justify-between px-5 py-4">
                    <div>
                      <p className={`font-mono text-[10px] uppercase tracking-widest ${txnColor(t.type)}`}>{t.type}</p>
                      {t.note && <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">{t.note}</p>}
                      <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/40">{new Date(t.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-[11px] ${t.amount >= 0 ? "text-green-400" : "text-clay"}`}>
                        {t.amount >= 0 ? "+" : ""}{t.amount.toLocaleString()} L
                      </p>
                      <p className="font-mono text-[9px] text-muted-foreground/40">→ {t.balanceAfter.toLocaleString()} L</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions sidebar */}
        <div className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Actions</p>

          {actionSuccess && <p className="font-mono text-[9px] uppercase tracking-widest text-green-400">{actionSuccess}</p>}
          {actionError && <p className="font-mono text-[9px] uppercase tracking-widest text-clay">{actionError}</p>}

          <ActionBtn
            label="Resend delivery email"
            onClick={() => doAction("resend")}
            disabled={busy}
          />

          <ActionBtn
            label={gc.status === "disabled" ? "Re-enable card" : "Disable card"}
            onClick={() => doAction(gc.status === "disabled" ? "enable" : "disable")}
            disabled={busy}
            destructive={gc.status !== "disabled"}
          />

          <ActionBtn
            label="Adjust balance"
            onClick={() => { setShowAdjust(true); setActionError(null); setActionSuccess(null); }}
            disabled={busy}
          />

          <ActionBtn
            label="Full refund (restore to initial)"
            onClick={() => {
              if (window.confirm(`Restore this gift card to its full initial balance of ${gc.initialAmount.toLocaleString()} L?`)) {
                void doAction("refund");
              }
            }}
            disabled={busy}
          />
        </div>
      </div>

      {/* Adjust modal */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowAdjust(false); }}>
          <div className="w-full max-w-sm border border-border bg-background p-8">
            <p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-ink">Adjust balance</p>
            <div className="space-y-5">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Amount (Lek) — positive to add, negative to deduct</label>
                <input
                  type="text"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  placeholder="+1000 or -500"
                  style={{ fontSize: '16px' }}
                  className="mt-2 w-full border-b border-border bg-transparent pb-2 font-mono text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Note (optional)</label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Reason for adjustment"
                  style={{ fontSize: '16px' }}
                  className="mt-2 w-full border-b border-border bg-transparent pb-2 font-mono text-ink outline-none placeholder:text-muted-foreground/30 focus:border-ink/60"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAdjust(false)} className="flex-1 border border-border py-3 font-mono text-[10px] uppercase tracking-widest text-ink transition-colors hover:border-ink/50">
                  Cancel
                </button>
                <button onClick={handleAdjust} className="flex-1 bg-foreground py-3 font-mono text-[10px] uppercase tracking-widest text-background transition-opacity hover:opacity-80">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="font-mono text-[11px] text-ink text-right">{value}</p>
    </div>
  );
}

function ActionBtn({ label, onClick, disabled, destructive }: {
  label: string; onClick: () => void; disabled?: boolean; destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full border py-3 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 ${
        destructive
          ? "border-clay/40 text-clay hover:border-clay"
          : "border-border text-ink hover:border-ink/50"
      }`}
    >
      {label}
    </button>
  );
}
