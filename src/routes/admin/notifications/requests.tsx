import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { db } from "@/db";
import { contactMessage, cancellationRequest } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { desc, eq } from "drizzle-orm";
import { Link } from "@tanstack/react-router";

interface ContactItem {
  kind: "contact";
  id: string;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface CancellationItem {
  kind: "cancellation";
  id: string;
  orderId: string;
  orderRef: string;
  userName: string;
  userEmail: string;
  message: string | null;
  status: string;
  isRead: boolean;
  createdAt: string;
}

type RequestItem = ContactItem | CancellationItem;

const markRequestsRead = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  await db()
    .update(cancellationRequest)
    .set({ isRead: true })
    .where(eq(cancellationRequest.isRead, false));
  await db()
    .update(contactMessage)
    .set({ isRead: true })
    .where(eq(contactMessage.isRead, false));
  return { ok: true };
});

const getRequests = createServerFn({ method: "GET" }).handler(async (): Promise<RequestItem[]> => {
  await requireAdmin();

  const [contacts, cancellations] = await Promise.all([
    db().select().from(contactMessage).orderBy(desc(contactMessage.createdAt)).limit(50),
    db().select().from(cancellationRequest).orderBy(desc(cancellationRequest.createdAt)).limit(50),
  ]);

  const items: RequestItem[] = [
    ...contacts.map((m): ContactItem => ({
      kind: "contact",
      id: m.id,
      name: m.name,
      email: m.email,
      message: m.message,
      isRead: m.isRead,
      createdAt: String(m.createdAt),
    })),
    ...cancellations.map((c): CancellationItem => ({
      kind: "cancellation",
      id: c.id,
      orderId: c.orderId,
      orderRef: c.orderId.slice(0, 8).toUpperCase(),
      userName: c.userName,
      userEmail: c.userEmail,
      message: c.message ?? null,
      status: c.status,
      isRead: c.isRead,
      createdAt: String(c.createdAt),
    })),
  ];

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
});

export const Route = createFileRoute("/admin/notifications/requests")({
  loader: async () => {
    const data = await getRequests();
    markRequestsRead();
    return data;
  },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unread = (requests as any[]).filter((r) => r.kind === "contact" && !r.isRead).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unreadCancellations = (requests as any[]).filter((r) => r.kind === "cancellation" && !r.isRead).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingCancellations = (requests as any[]).filter((r) => r.kind === "cancellation" && r.status === "pending").length;

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="p-6 lg:p-8">
        <BackButton />
        <div className="mt-6 mb-8 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Notifications</p>
            <h1 className="mt-1 font-serif text-3xl italic text-[var(--color-foreground)]">Requests</h1>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <span className="flex h-6 items-center rounded-full bg-green-400/10 px-3 font-mono text-[10px] text-green-400">
                {unread} message{unread > 1 ? "s" : ""}
              </span>
            )}
            {(pendingCancellations > 0 || unreadCancellations > 0) && (
              <span className="flex h-6 items-center rounded-full bg-[var(--color-clay)]/15 px-3 font-mono text-[10px] text-[var(--color-clay)]">
                {pendingCancellations} cancellation{pendingCancellations > 1 ? "s" : ""}
                {unreadCancellations > 0 && ` · ${unreadCancellations} new`}
              </span>
            )}
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]/50">No requests yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(requests as any[]).map((req) => {
              if (req.kind === "cancellation") {
                return (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <Link key={req.id} to={`/admin/orders/${req.orderId}` as any} className={`block rounded-lg border px-5 py-4 transition-colors hover:border-[var(--color-clay)] ${req.isRead ? "border-[var(--color-clay)]/25 bg-[var(--color-paper)]" : "border-[var(--color-clay)] bg-[var(--color-clay)]/[0.04]"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-[var(--color-clay)]/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--color-clay)]">
                          Cancel Request
                        </span>
                        <p className="font-mono text-[11px] text-[var(--color-foreground)]">{req.userName}</p>
                        <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]/60">·</span>
                        <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">Order #{req.orderRef}</p>
                        {!req.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-clay)]" />}
                      </div>
                      <p className="shrink-0 font-mono text-[10px] text-[var(--color-muted-foreground)]/60">{timeAgo(req.createdAt)}</p>
                    </div>
                    <p className="mt-1.5 font-mono text-[10px] text-[var(--color-muted-foreground)]">{req.userEmail}</p>
                    {req.message && (
                      <p className="mt-3 border-l-2 border-[var(--color-clay)]/30 pl-3 font-mono text-[11px] leading-relaxed text-[var(--color-foreground)]/70 italic">
                        {req.message}
                      </p>
                    )}
                  </Link>
                );
              }

              return (
                <div key={req.id} className={`rounded-lg border px-5 py-4 ${req.isRead ? "border-[var(--color-border)] bg-[var(--color-paper)]" : "border-[var(--color-foreground)]/25 bg-[var(--color-foreground)]/[0.03]"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[11px] font-medium text-[var(--color-foreground)]">{req.name}</p>
                        {!req.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-clay)]" />}
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)]">{req.email}</p>
                    </div>
                    <p className="shrink-0 font-mono text-[10px] text-[var(--color-muted-foreground)]/60">{timeAgo(req.createdAt)}</p>
                  </div>
                  <p className="mt-3 border-t border-[var(--color-border)] pt-3 text-[13px] leading-relaxed text-[var(--color-foreground)]/80">
                    {req.message}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
