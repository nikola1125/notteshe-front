import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { db } from "@/db";
import { orders, user, newsletterSubscriber } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { desc } from "drizzle-orm";

interface NotificationItem {
  id: string;
  type: "order" | "customer" | "newsletter";
  title: string;
  detail: string;
  href: string;
  createdAt: string;
}

const getGeneral = createServerFn({ method: "GET" }).handler(async (): Promise<NotificationItem[]> => {
  await requireAdmin();
  const database = db();

  const [recentOrders, recentCustomers, recentSubscribers] = await Promise.all([
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
  ]);

  const items: NotificationItem[] = [
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

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, 50);
});

export const Route = createFileRoute("/admin/notifications/general")({
  loader: () => getGeneral(),
  component: GeneralPage,
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
  return `${Math.floor(hrs / 24)}d ago`;
}

function GeneralPage() {
  const items = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="p-6 lg:p-8">
        <BackButton />
        <div className="mt-6 mb-8 flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Notifications</p>
            <h1 className="mt-1 font-serif text-3xl italic text-[var(--color-foreground)]">General</h1>
          </div>
          <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{items.length} recent</p>
        </div>

        {items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]/50">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item: NotificationItem) => {
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
        )}
      </div>
    </div>
  );
}
