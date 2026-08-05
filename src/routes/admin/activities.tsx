import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, not, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, adminUser } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { useState, useMemo } from "react";

interface ActivityRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  adminName: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

const getActivities = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActivityRow[]> => {
    await requireAdmin();

    const rows = await db()
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        diff: auditLog.diff,
        adminName: adminUser.name,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(adminUser, eq(auditLog.adminId, adminUser.id))
      .where(not(eq(auditLog.entityType, "payment")))
      .orderBy(desc(auditLog.createdAt))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      adminName: r.adminName ?? null,
      detail: (r.diff ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt.toISOString(),
    }));
  }
);

export const Route = createFileRoute("/admin/activities")({
  loader: () => getActivities(),
  staleTime: 0,
  component: ActivitiesPage,
});

const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  "order.status_change":    { label: "Status Change",   color: "text-blue-400",                         bg: "bg-blue-500/10" },
  "order.note_update":      { label: "Note Updated",    color: "text-[var(--color-muted-foreground)]",  bg: "bg-[var(--color-muted)]/40" },
  "product.update":         { label: "Product Updated", color: "text-purple-400",                       bg: "bg-purple-500/10" },
  "product.create":         { label: "Product Created", color: "text-green-400",                        bg: "bg-green-500/10" },
  "product.delete":         { label: "Product Deleted", color: "text-[var(--color-clay)]",              bg: "bg-[var(--color-clay)]/10" },
  "shipping.update":        { label: "Shipping Config", color: "text-yellow-400",                       bg: "bg-yellow-500/10" },
  "discount.create":        { label: "Discount Created",color: "text-green-400",                        bg: "bg-green-500/10" },
  "discount.update":        { label: "Discount Updated",color: "text-purple-400",                       bg: "bg-purple-500/10" },
  "discount.delete":        { label: "Discount Deleted",color: "text-[var(--color-clay)]",              bg: "bg-[var(--color-clay)]/10" },
  "admin.login":            { label: "Admin Login",     color: "text-[var(--color-muted-foreground)]",  bg: "bg-[var(--color-muted)]/40" },
};

const ENTITY_LINK: Record<string, (id: string) => string> = {
  order:   (id) => `/admin/orders/${id}`,
  product: (id) => `/admin/products/${id}`,
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function buildSummary(action: string, d: Record<string, unknown>): string {
  const after  = (d.after  ?? {}) as Record<string, unknown>;
  const before = (d.before ?? {}) as Record<string, unknown>;
  switch (action) {
    case "order.status_change":
      return `${before.status ?? "?"} → ${after.status ?? "?"}${after.pokWarning ? " ⚠ POK failed" : ""}`;
    case "order.note_update":
      return "Admin note saved";
    case "shipping.update":
      return `fee=${after.fee ?? "?"} L, threshold=${after.freeThreshold ?? "?"} L`;
    case "discount.create":
    case "discount.update":
      return String(after.code ?? after.name ?? "—");
    default:
      return String(after.name ?? after.title ?? after.email ?? "—").slice(0, 80);
  }
}

function ActivitiesPage() {
  const initialRows = Route.useLoaderData();
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const actionTypes = useMemo(() => {
    const types = new Set(rows.map((r) => r.action));
    return ["ALL", ...Array.from(types)];
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (filterType !== "ALL") result = result.filter((r) => r.action === filterType);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          (r.adminName ?? "").toLowerCase().includes(q) ||
          (r.entityId ?? "").toLowerCase().includes(q) ||
          r.action.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, filterType, search]);

  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await getActivities();
      setRows(fresh);
      setLastRefresh(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">Activities</h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Admin actions — orders, products, config changes
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

      {/* Filter + search */}
      <div className="mb-4 flex flex-wrap gap-2">
        {actionTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`whitespace-nowrap rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${filterType === t ? "bg-[var(--color-clay)] text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
          >
            {t === "ALL" ? "All" : (ACTION_META[t]?.label ?? t)}
          </button>
        ))}
      </div>
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by admin, entity ID, or action…"
          className="w-72 border border-[var(--color-border)] bg-[var(--color-paper)] px-3 py-2 font-mono text-xs text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]/40 focus:border-[var(--color-clay)]"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Date", "Action", "By", "Entity", "Summary", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-paper)]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]">No activities</td>
              </tr>
            )}
            {filtered.map((r) => {
              const meta = ACTION_META[r.action] ?? { label: r.action, color: "text-[var(--color-foreground)]", bg: "" };
              const isExpanded = expanded === r.id;
              const link = r.entityType && r.entityId && ENTITY_LINK[r.entityType]
                ? ENTITY_LINK[r.entityType](r.entityId) : null;
              const after = (r.detail.after ?? {}) as Record<string, unknown>;
              const hasWarning = Boolean(after.pokWarning);

              return (
                <>
                  <tr
                    key={r.id}
                    className={`cursor-pointer transition-colors ${isExpanded ? "bg-[var(--color-muted)]/20" : "hover:bg-[var(--color-muted)]/20"} ${hasWarning ? "border-l-2 border-orange-400" : ""}`}
                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                  >
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)] whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${meta.color} ${meta.bg}`}>
                        {meta.label}
                      </span>
                      {hasWarning && (
                        <span className="ml-2 rounded bg-orange-500/10 px-1.5 py-0.5 font-mono text-[9px] text-orange-400">POK failed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--color-muted-foreground)]">
                      {r.adminName ?? "system"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                      {link ? (
                        <Link
                          to={link}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[var(--color-clay)] hover:underline"
                        >
                          {(r.entityId ?? "").slice(0, 8)}…
                        </Link>
                      ) : (
                        <span>{(r.entityId ?? "—").slice(0, 8)}{r.entityId && r.entityId.length > 8 ? "…" : ""}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)] max-w-xs truncate">
                      {buildSummary(r.action, r.detail)}
                    </td>
                    <td className="px-4 py-3">
                      <svg
                        width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2"
                        className={`text-[var(--color-muted-foreground)]/40 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="M2 3l3 4 3-4" />
                      </svg>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${r.id}-exp`} className="bg-[var(--color-muted)]/10">
                      <td colSpan={6} className="px-6 py-4">
                        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/60">Raw payload</p>
                        <pre className="overflow-x-auto rounded border border-[var(--color-border)] bg-[var(--color-background)] p-4 font-mono text-[10px] text-[var(--color-foreground)] leading-relaxed">
                          {JSON.stringify(r.detail, null, 2)}
                        </pre>
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
        Showing {filtered.length} of {rows.length} activities (last 500)
      </p>
    </div>
  );
}
