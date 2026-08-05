import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, adminUser } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { useState, useMemo } from "react";

interface PaymentLogRow {
  id: string;
  action: string;
  pokOrderId: string | null;
  detail: Record<string, unknown>;
  adminName: string | null;
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
        entityType: auditLog.entityType,
        diff: auditLog.diff,
        adminName: adminUser.name,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(adminUser, eq(auditLog.adminId, adminUser.id))
      .where(
        or(
          eq(auditLog.entityType, "payment"),
          eq(auditLog.action, "order.status_change"),
        )
      )
      .orderBy(desc(auditLog.createdAt))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      pokOrderId: r.entityType === "payment" ? r.entityId : null,
      detail: ((r.diff as { after?: Record<string, unknown>; before?: Record<string, unknown> } | null) ?? {}) as Record<string, unknown>,
      adminName: r.adminName ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
);

export const Route = createFileRoute("/admin/audit")({
  loader: () => getPaymentLog(),
  staleTime: 0,
  component: AuditLogPage,
});

type FilterType = "ALL" | "payment.initiated" | "payment.success" | "payment.failure" | "payment.order_error" | "payment.webhook_recovery" | "payment.pok_action_failed" | "order.status_change";

const EVENT_META: Record<string, { label: string; color: string; bg: string }> = {
  "payment.initiated":          { label: "Initiated",        color: "text-[var(--color-muted-foreground)]", bg: "bg-[var(--color-muted)]/40" },
  "payment.success":            { label: "Success",          color: "text-green-400",                        bg: "bg-green-500/10" },
  "payment.failure":            { label: "Failed",           color: "text-[var(--color-clay)]",              bg: "bg-[var(--color-clay)]/10" },
  "payment.order_error":        { label: "Order Error",      color: "text-orange-400",                       bg: "bg-orange-500/10" },
  "payment.webhook_recovery":   { label: "Webhook Recovery", color: "text-yellow-400",                       bg: "bg-yellow-500/10" },
  "payment.pok_action_failed":  { label: "POK Failed",       color: "text-orange-400",                       bg: "bg-orange-500/10" },
  "order.status_change":        { label: "Status Change",    color: "text-blue-400",                         bg: "bg-blue-500/10" },
};

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "ALL",                        label: "All" },
  { key: "payment.success",            label: "Success" },
  { key: "payment.failure",            label: "Failed" },
  { key: "payment.initiated",          label: "Initiated" },
  { key: "payment.order_error",        label: "Errors" },
  { key: "payment.pok_action_failed",  label: "POK Failed" },
  { key: "payment.webhook_recovery",   label: "Webhook" },
  { key: "order.status_change",        label: "Status Changes" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function buildDetail(action: string, d: Record<string, unknown>): string {
  const after = (d.after ?? d) as Record<string, unknown>;
  switch (action) {
    case "payment.initiated":
      return `${after.itemCount ?? "?"} item(s) · ref: ${String(after.merchantReference ?? "—").slice(0, 8)}`;
    case "payment.success":
      return `Order ${String(after.orderId ?? "—").slice(0, 8)} created`;
    case "payment.failure":
      return `${after.errorType ?? "unknown"}: ${String(after.errorMessage ?? "—").slice(0, 80)}`;
    case "payment.order_error":
      return String(after.errorMessage ?? after.note ?? "—").slice(0, 100);
    case "payment.webhook_recovery":
      return `Order ${String(after.orderId ?? "—").slice(0, 8)} created via webhook`;
    case "order.status_change": {
      const before = (d.before ?? {}) as Record<string, unknown>;
      return `${before.status ?? "?"} → ${after.status ?? "?"}`;
    }
    default:
      return "—";
  }
}

function getAmount(action: string, d: Record<string, unknown>): string {
  const after = (d.after ?? d) as Record<string, unknown>;
  const n = after.amount ?? after.total;
  if (n == null) return "—";
  return `${n} L`;
}

function getEmail(action: string, d: Record<string, unknown>): string {
  const after = (d.after ?? d) as Record<string, unknown>;
  return (after.email as string | undefined) ?? "—";
}

function getOrderId(action: string, d: Record<string, unknown>): string | null {
  const after = (d.after ?? d) as Record<string, unknown>;
  if (action === "payment.success" || action === "payment.webhook_recovery") {
    return (after.orderId as string | undefined) ?? null;
  }
  if (action === "order.status_change") {
    return (after.orderId as string | undefined) ?? null;
  }
  return null;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title="Click to copy full ID"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="group flex items-center gap-1 font-mono text-[10px] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)]"
    >
      <span>{value.slice(0, 12)}…</span>
      <span className="opacity-0 transition group-hover:opacity-100">
        {copied ? (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 6l3 3 5-5" /></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="4" y="4" width="7" height="7" rx="1" /><path d="M8 4V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1" /></svg>
        )}
      </span>
    </button>
  );
}

function AuditLogPage() {
  const initialRows = Route.useLoaderData();
  const [rows, setRows] = useState(initialRows);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rows.length };
    for (const r of rows) {
      c[r.action] = (c[r.action] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (filter !== "ALL") result = result.filter((r) => r.action === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          getEmail(r.action, r.detail).toLowerCase().includes(q) ||
          (r.pokOrderId ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, filter, search]);

  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await getPaymentLog();
      setRows(fresh);
      setLastRefresh(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">Payment Log</h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            All card payment events — attempts, failures, successes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-[var(--color-muted-foreground)]/50">
            Updated {lastRefresh.toLocaleTimeString("en-GB")}
          </span>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded border border-[var(--color-border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)] disabled:opacity-40"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className={refreshing ? "animate-spin" : ""}>
              <path d="M10 6A4 4 0 1 1 6 2" /><path d="M10 2v4H6" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${filter === t.key ? "bg-[var(--color-clay)] text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
          >
            {t.label}
            <span className={`rounded px-1 py-0.5 text-[8px] ${filter === t.key ? "bg-white/20" : "bg-[var(--color-border)]"}`}>
              {counts[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or POK order ID…"
          className="w-72 border border-[var(--color-border)] bg-[var(--color-paper)] px-3 py-2 font-mono text-xs text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]/40 focus:border-[var(--color-clay)]"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Date", "Event", "POK Order ID", "Email", "Amount", "Detail", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-paper)]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]">
                  No events
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const meta = EVENT_META[r.action] ?? { label: r.action, color: "text-[var(--color-foreground)]", bg: "" };
              const detail = buildDetail(r.action, r.detail);
              const orderId = getOrderId(r.action, r.detail);
              const isExpanded = expanded === r.id;
              return (
                <>
                  <tr
                    key={r.id}
                    className={`cursor-pointer transition-colors ${isExpanded ? "bg-[var(--color-muted)]/20" : "hover:bg-[var(--color-muted)]/20"}`}
                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                  >
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)] whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${meta.color} ${meta.bg}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.pokOrderId ? <CopyButton value={r.pokOrderId} /> : <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]/40">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--color-foreground)]">
                      {getEmail(r.action, r.detail)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--color-foreground)]">
                      {getAmount(r.action, r.detail)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)] max-w-xs">
                      {detail}
                      {r.adminName && (
                        <span className="ml-2 text-[9px] opacity-60">by {r.adminName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {orderId && (
                          <Link
                            to="/admin/orders/$id"
                            params={{ id: orderId }}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-clay)] hover:underline"
                          >
                            View order →
                          </Link>
                        )}
                        <svg
                          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"
                          className={`text-[var(--color-muted-foreground)]/40 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <path d="M2 3l3 4 3-4" />
                        </svg>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.id}-expanded`} className="bg-[var(--color-muted)]/10">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="space-y-2">
                          <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/60">Raw payload</p>
                          <pre className="overflow-x-auto rounded border border-[var(--color-border)] bg-[var(--color-background)] p-4 font-mono text-[10px] text-[var(--color-foreground)] leading-relaxed">
                            {JSON.stringify(r.detail, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 font-mono text-[9px] text-[var(--color-muted-foreground)]/40">
        Showing {filtered.length} of {rows.length} events (last 500)
      </p>
    </div>
  );
}
