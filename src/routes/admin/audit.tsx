import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, adminUser } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";

interface AuditRow {
  id: string;
  adminName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  diff: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
  createdAt: string;
}

const getAuditLog = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuditRow[]> => {
    await requireAdmin();

    const rows = await db()
      .select({
        id: auditLog.id,
        adminName: adminUser.name,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        diff: auditLog.diff,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(adminUser, eq(auditLog.adminId, adminUser.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      adminName: r.adminName,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      diff: (r.diff as AuditRow["diff"]) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
);

export const Route = createFileRoute("/admin/audit")({
  loader: () => getAuditLog(),
  staleTime: 30_000,
  component: AuditLogPage,
});

function buildDetail(action: string, diff: AuditRow["diff"]): string {
  const before = diff?.before ?? {};
  const after  = diff?.after  ?? {};

  switch (action) {
    case "order.status_change":
      return `Status: ${before.status ?? "?"} → ${after.status ?? "?"}`;

    case "order.note_update":
      return "Admin note updated";

    case "product.create":
      return `Created "${after.name ?? "?"}"`;

    case "product.update": {
      const changed: string[] = [];
      for (const key of Object.keys(after)) {
        const bVal = before[key];
        const aVal = after[key];
        if (bVal !== aVal) {
          if (key === "price" || key === "originalPrice") {
            changed.push(`${key}: €${bVal ?? "—"} → €${aVal ?? "—"}`);
          } else if (key === "isVisible" || key === "inStock" || key === "isNew" || key === "isSale") {
            changed.push(`${key}: ${bVal} → ${aVal}`);
          } else {
            const bStr = String(bVal ?? "—").slice(0, 30);
            const aStr = String(aVal ?? "—").slice(0, 30);
            changed.push(`${key}: "${bStr}" → "${aStr}"`);
          }
        }
      }
      return changed.length > 0 ? changed.join(" · ") : `Updated "${after.name ?? "?"}"`;
    }

    case "product.toggle_visibility":
      return `Visibility: ${before.isVisible ? "visible" : "hidden"} → ${after.isVisible ? "visible" : "hidden"}`;

    case "discount.create":
      return `Code "${after.code ?? "?"}" — ${after.type === "percent" ? `${after.value}% off` : `€${after.value} off`}`;

    case "discount.toggle":
      return `Code toggled ${after.active ? "active" : "inactive"}`;

    case "discount.delete":
      return "Discount code deleted";

    case "shipping.update": {
      const parts: string[] = [];
      if (before.freeThreshold !== after.freeThreshold)
        parts.push(`free threshold: €${before.freeThreshold} → €${after.freeThreshold}`);
      if (before.flatRate !== after.flatRate)
        parts.push(`flat rate: €${before.flatRate} → €${after.flatRate}`);
      return parts.length > 0 ? parts.join(" · ") : "Shipping config updated";
    }

    case "newsletter.export":
      return `Exported ${after.count ?? "?"} subscribers`;

    default:
      return "—";
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditLogPage() {
  const rows = Route.useLoaderData();

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Audit Log
      </h1>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Admin", "Action", "Detail", "Entity", "ID", "Date"].map((h) => (
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
                  No entries yet
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[var(--color-muted)]/30">
                <td className="px-4 py-3 text-xs text-[var(--color-foreground)]">
                  {r.adminName ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-clay)] whitespace-nowrap">
                  {r.action}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-foreground)] max-w-xs">
                  {buildDetail(r.action, r.diff)}
                </td>
                <td className="px-4 py-3">
                  {r.entityType && (
                    <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      {r.entityType}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                  {r.entityId?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)] whitespace-nowrap">
                  {fmtDate(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
