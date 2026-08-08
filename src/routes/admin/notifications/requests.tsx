import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { db } from "@/db";
import { contactMessage } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { desc } from "drizzle-orm";

interface RequestItem {
  id: string;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const getRequests = createServerFn({ method: "GET" }).handler(async (): Promise<RequestItem[]> => {
  await requireAdmin();
  const rows = await db()
    .select()
    .from(contactMessage)
    .orderBy(desc(contactMessage.createdAt))
    .limit(50);

  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    message: m.message,
    isRead: m.isRead,
    createdAt: String(m.createdAt),
  }));
});

export const Route = createFileRoute("/admin/notifications/requests")({
  loader: () => getRequests(),
  component: RequestsPage,
});

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function RequestsPage() {
  const requests = Route.useLoaderData();
  const unread = requests.filter((r: RequestItem) => !r.isRead).length;

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="p-6 lg:p-8">
        <BackButton />
        <div className="mt-6 mb-8 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Notifications</p>
            <h1 className="mt-1 font-serif text-3xl italic text-[var(--color-foreground)]">Requests</h1>
          </div>
          {unread > 0 && (
            <span className="flex h-6 items-center rounded-full bg-[var(--color-clay)]/15 px-3 font-mono text-[10px] text-[var(--color-clay)]">
              {unread} unread
            </span>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]/50">No requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req: RequestItem) => (
              <div
                key={req.id}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[11px] font-medium text-[var(--color-foreground)]">{req.name}</p>
                      {!req.isRead && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-clay)]" />
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)]">{req.email}</p>
                  </div>
                  <p className="shrink-0 font-mono text-[10px] text-[var(--color-muted-foreground)]/60">{timeAgo(req.createdAt)}</p>
                </div>
                <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[13px] leading-relaxed text-[var(--color-foreground)]/80">
                  {req.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
