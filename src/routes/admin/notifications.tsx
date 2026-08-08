import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { db } from "@/db";
import { orders, user, newsletterSubscriber, contactMessage } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { desc } from "drizzle-orm";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

interface NotificationItem {
  id: string;
  type: "order" | "customer" | "newsletter";
  title: string;
  detail: string;
  href: string;
  createdAt: string;
}

interface RequestItem {
  id: string;
  name: string;
  email: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsData {
  general: NotificationItem[];
  requests: RequestItem[];
}

const getNotifications = createServerFn({ method: "GET" }).handler(async (): Promise<NotificationsData> => {
  await requireAdmin();
  const database = db();

  const [recentOrders, recentCustomers, recentSubscribers, contactMessages] = await Promise.all([
    database
      .select({ id: orders.id, status: orders.status, total: orders.total, createdAt: orders.createdAt })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(20),

    database
      .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(20),

    database
      .select({ id: newsletterSubscriber.id, email: newsletterSubscriber.email, createdAt: newsletterSubscriber.createdAt })
      .from(newsletterSubscriber)
      .orderBy(desc(newsletterSubscriber.createdAt))
      .limit(20),

    database
      .select()
      .from(contactMessage)
      .orderBy(desc(contactMessage.createdAt))
      .limit(50),
  ]);

  const general: NotificationItem[] = [
    ...recentOrders.map((o) => ({
      id: `order-${o.id}`,
      type: "order" as const,
      title: "New order placed",
      detail: `#${o.id.slice(0, 8).toUpperCase()} · ${Number(o.total).toFixed(0)} L · ${o.status}`,
      href: `/admin/orders/${o.id}`,
      createdAt: String(o.createdAt),
    })),
    ...recentCustomers.map((c) => ({
      id: `customer-${c.id}`,
      type: "customer" as const,
      title: "New customer registered",
      detail: `${c.name ?? "Unknown"} · ${c.email}`,
      href: `/admin/customers/${c.id}`,
      createdAt: String(c.createdAt),
    })),
    ...recentSubscribers.map((s) => ({
      id: `newsletter-${s.id}`,
      type: "newsletter" as const,
      title: "Newsletter signup",
      detail: s.email,
      href: "/admin/newsletter",
      createdAt: String(s.createdAt),
    })),
  ];

  general.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const requests: RequestItem[] = contactMessages.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    message: m.message,
    isRead: m.isRead,
    createdAt: String(m.createdAt),
  }));

  return { general: general.slice(0, 50), requests };
});

export const Route = createFileRoute("/admin/notifications")({
  loader: () => getNotifications(),
  component: NotificationsPage,
});

const TYPE_CONFIG = {
  order: {
    label: "Order",
    color: "text-[var(--color-clay)]",
    bg: "bg-[var(--color-clay)]/10",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  customer: {
    label: "Customer",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  newsletter: {
    label: "Newsletter",
    color: "text-green-400",
    bg: "bg-green-400/10",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type Tab = "general" | "requests";

function NotificationsPage() {
  const { general, requests } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("general");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const tabLabel = tab === "general" ? "General" : "Requests";

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="p-6 lg:p-8">
        <BackButton />

        <div className="mt-6 mb-8 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Admin</p>
            <h1 className="mt-1 font-serif text-3xl italic text-[var(--color-foreground)]">Notifications</h1>
          </div>

          {/* Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-foreground)] transition-colors hover:border-[var(--color-clay)]/50"
            >
              {tabLabel}
              {tab === "requests" && requests.length > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-clay)] font-mono text-[9px] text-white">
                  {requests.length}
                </span>
              )}
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              >
                <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[130px] border border-[var(--color-border)] bg-[var(--color-paper)] shadow-sm">
                  {(["general", "requests"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTab(t); setDropdownOpen(false); }}
                      className={`flex w-full items-center justify-between px-4 py-3 font-mono text-[10px] uppercase tracking-widest transition-colors hover:bg-[var(--color-muted)] ${tab === t ? "text-[var(--color-clay)]" : "text-[var(--color-muted-foreground)]"}`}
                    >
                      {t === "general" ? "General" : "Requests"}
                      {t === "requests" && requests.length > 0 && (
                        <span className="ml-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-clay)] font-mono text-[9px] text-white">
                          {requests.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ─── General tab ─── */}
        {tab === "general" && (
          general.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]/50">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {general.map((item: NotificationItem) => {
                const cfg = TYPE_CONFIG[item.type];
                return (
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  <Link key={item.id} to={item.href as any} className="flex items-start gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-3.5 transition-colors hover:border-[var(--color-clay)]/30">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[11px] text-[var(--color-foreground)]">{item.title}</p>
                        <p className="shrink-0 font-mono text-[10px] text-[var(--color-muted-foreground)]/60">{timeAgo(item.createdAt)}</p>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">{item.detail}</p>
                    </div>
                    <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* ─── Requests tab ─── */}
        {tab === "requests" && (
          requests.length === 0 ? (
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
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-[11px] font-medium text-[var(--color-foreground)]">{req.name}</p>
                        {!req.isRead && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-clay)]" />
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
          )
        )}
      </div>
    </div>
  );
}
