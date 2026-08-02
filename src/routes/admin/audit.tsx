import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/start-server-core/request-response";
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
  createdAt: string;
}

const getAuditLog = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuditRow[]> => {
    const request = getRequest();
    await requireAdmin(request);

    const rows = await db()
      .select({
        id: auditLog.id,
        adminName: adminUser.name,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
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
      createdAt: r.createdAt.toISOString(),
    }));
  }
);

export const Route = createFileRoute("/admin/audit")({
  loader: () => getAuditLog(),
  component: AuditLogPage,
});

function AuditLogPage() {
  const rows = Route.useLoaderData();

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Audit Log
      </h1>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Admin", "Action", "Entity", "ID", "Date"].map((h) => (
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
                  colSpan={5}
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
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-clay)]">
                  {r.action}
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
