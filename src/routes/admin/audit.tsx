import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";

interface PaymentLogRow {
  id: string;
  action: string;
  pokOrderId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

const getPaymentLog = createServerFn({ method: "GET" }).handler(
  async (): Promise<PaymentLogRow[]> => {
    await requireAdmin();

    const rows = await db()
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityId: auditLog.entityId,
        diff: auditLog.diff,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(eq(auditLog.entityType, "payment"))
      .orderBy(desc(auditLog.createdAt))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      pokOrderId: r.entityId,
      detail: ((r.diff as { after?: Record<string, unknown> } | null)?.after ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(),
    }));
  }
);

export const Route = createFileRoute("/admin/audit")({
  loader: () => getPaymentLog(),
  staleTime: 15_000,
  component: AuditLogPage,
});

const EVENT_META: Record<string, { label: string; color: string }> = {
  "payment.initiated":        { label: "Initiated",      color: "text-[var(--color-muted-foreground)]" },
  "payment.success":          { label: "Success",        color: "text-green-400" },
  "payment.failure":          { label: "Failed",         color: "text-[var(--color-clay)]" },
  "payment.order_error":      { label: "Order Error",    color: "text-orange-400" },
  "payment.webhook_recovery": { label: "Webhook Recovery", color: "text-yellow-400" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function AuditLogPage() {
  const rows = Route.useLoaderData();

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-2 font-serif text-2xl italic text-[var(--color-foreground)]">
        Payment Log
      </h1>
      <p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
        All card payment events — attempts, failures, successes
      </p>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Date", "Event", "POK Order ID", "Email", "Amount", "Detail"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-paper)]">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]"
                >
                  No payment events yet
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const meta = EVENT_META[r.action] ?? { label: r.action, color: "text-[var(--color-foreground)]" };
              const detail = buildDetail(r.action, r.detail);
              return (
                <tr key={r.id} className="hover:bg-[var(--color-muted)]/30">
                  <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)] whitespace-nowrap">
                    {fmtDate(r.createdAt)}
                  </td>
                  <td className={`px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap ${meta.color}`}>
                    {meta.label}
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                    {r.pokOrderId ? (
                      <span title={r.pokOrderId}>{r.pokOrderId.slice(0, 12)}…</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--color-foreground)]">
                    {(r.detail.email as string | undefined) ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--color-foreground)]">
                    {r.detail.amount != null ? `${r.detail.amount} L` : r.detail.total != null ? `${r.detail.total} L` : "—"}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[var(--color-muted-foreground)] max-w-xs">
                    {detail}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildDetail(action: string, d: Record<string, unknown>): string {
  switch (action) {
    case "payment.initiated":
      return `${d.itemCount ?? "?"} item(s) · ref: ${String(d.merchantReference ?? "—").slice(0, 8)}`;
    case "payment.success":
      return `Order ${String(d.orderId ?? "—").slice(0, 8)} created`;
    case "payment.failure":
      return `${d.errorType ?? "unknown"}: ${String(d.errorMessage ?? "—").slice(0, 80)}`;
    case "payment.order_error":
      return String(d.errorMessage ?? d.note ?? "—").slice(0, 100);
    case "payment.webhook_recovery":
      return `Order ${String(d.orderId ?? "—").slice(0, 8)} created via webhook`;
    default:
      return "—";
  }
}
