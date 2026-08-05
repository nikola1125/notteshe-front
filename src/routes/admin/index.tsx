import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  eq,
  desc,
  count,
  sum,
  sql,
  and,
  gte,
} from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItem, user } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";

interface DashboardData {
  totalOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalCustomers: number;
  recentOrders: Array<{
    id: string;
    email: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
  topProducts: Array<{ name: string; revenue: number }>;
  chartData: Array<{ date: string; orders: number; revenue: number }>;
}

const getDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    await requireAdmin();

    const database = db();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalOrdersResult,
      todayOrdersResult,
      pendingResult,
      customerCountResult,
      recentOrdersResult,
      topProductsResult,
      chartResult,
    ] = await Promise.all([
      // Total orders + revenue
      database
        .select({
          count: count(),
          revenue: sum(orders.total),
        })
        .from(orders),

      // Today
      database
        .select({
          count: count(),
          revenue: sum(orders.total),
        })
        .from(orders)
        .where(gte(orders.createdAt, todayStart)),

      // Pending
      database
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "PENDING")),

      // Customer count
      database.select({ count: count() }).from(user),

      // Recent 5 orders with customer email
      database
        .select({
          id: orders.id,
          email: user.email,
          total: orders.total,
          status: orders.status,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .innerJoin(user, eq(orders.userId, user.id))
        .orderBy(desc(orders.createdAt))
        .limit(5),

      // Top 5 products by revenue
      database
        .select({
          name: sql<string>`(${orderItem.productSnapshot}->>'name')`,
          revenue: sum(
            sql<number>`${orderItem.unitPrice} * ${orderItem.quantity}`
          ),
        })
        .from(orderItem)
        .groupBy(sql`${orderItem.productSnapshot}->>'name'`)
        .orderBy(
          desc(sum(sql<number>`${orderItem.unitPrice} * ${orderItem.quantity}`))
        )
        .limit(5),

      // Chart: orders + revenue per day last 30 days
      database
        .select({
          date: sql<string>`DATE(${orders.createdAt})::text`,
          orders: count(),
          revenue: sum(orders.total),
        })
        .from(orders)
        .where(gte(orders.createdAt, thirtyDaysAgo))
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`),
    ]);

    return {
      totalOrders: Number(totalOrdersResult[0]?.count ?? 0),
      totalRevenue: Number(totalOrdersResult[0]?.revenue ?? 0),
      todayOrders: Number(todayOrdersResult[0]?.count ?? 0),
      todayRevenue: Number(todayOrdersResult[0]?.revenue ?? 0),
      pendingOrders: Number(pendingResult[0]?.count ?? 0),
      totalCustomers: Number(customerCountResult[0]?.count ?? 0),
      recentOrders: recentOrdersResult.map((r) => ({
        id: r.id,
        email: r.email,
        total: Number(r.total),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      topProducts: topProductsResult.map((p) => ({
        name: p.name ?? "Unknown",
        revenue: Number(p.revenue ?? 0),
      })),
      chartData: chartResult.map((c) => ({
        date: c.date,
        orders: Number(c.orders),
        revenue: Number(c.revenue ?? 0),
      })),
    };
  }
);

export const Route = createFileRoute("/admin/")({
  loader: () => getDashboardData(),
  component: AdminDashboard,
});

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  CONFIRMED: "bg-blue-500/20 text-blue-400",
  SHIPPED: "bg-purple-500/20 text-purple-400",
  DELIVERED: "bg-green-500/20 text-green-400",
  CANCELLED: "bg-red-500/20 text-red-400",
  REFUNDED: "bg-orange-500/20 text-orange-400",
};

function AdminDashboard() {
  const data = Route.useLoaderData();

  function fmt(n: number) {
    return `${n.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} L`;
  }

  const maxRevenue = Math.max(...data.chartData.map((d) => d.revenue), 1);

  return (
    <div className="min-h-full p-6 lg:p-10">

      {/* Page header */}
      <div className="mb-8 border-b border-[var(--color-border)] pb-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Overview
        </p>
        <h1 className="mt-1 font-serif text-3xl italic text-[var(--color-foreground)]">
          Dashboard
        </h1>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Revenue", value: fmt(data.totalRevenue), sub: `${data.totalOrders} orders` },
          { label: "Today", value: fmt(data.todayRevenue), sub: `${data.todayOrders} orders today` },
          { label: "Pending", value: String(data.pendingOrders), sub: "awaiting action" },
          { label: "Customers", value: String(data.totalCustomers), sub: "registered" },
        ].map((s) => (
          <div key={s.label} className="border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              {s.label}
            </p>
            <p className="mt-3 font-serif text-3xl italic text-[var(--color-foreground)]">
              {s.value}
            </p>
            <p className="mt-1 font-mono text-[9px] text-[var(--color-muted-foreground)]/60">
              {s.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Revenue chart — bar style, static height */}
      <div className="mb-8 border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
        <div className="mb-5 flex items-baseline justify-between">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Revenue — Last 30 Days
          </p>
          {data.chartData.length > 0 && (
            <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
              {fmt(data.chartData.reduce((s, d) => s + d.revenue, 0))} total
            </p>
          )}
        </div>
        {data.chartData.length === 0 ? (
          <p className="py-10 text-center font-mono text-[10px] text-[var(--color-muted-foreground)]/50">
            No data yet
          </p>
        ) : (
          <div className="flex h-28 items-end gap-[3px]">
            {data.chartData.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${fmt(d.revenue)}`}
                className="flex-1 min-w-0 bg-[var(--color-clay)]/60 hover:bg-[var(--color-clay)] transition-colors"
                style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom two panels */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recent orders */}
        <div className="border border-[var(--color-border)] bg-[var(--color-paper)]">
          <div className="border-b border-[var(--color-border)] px-5 py-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Recent Orders
            </p>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="px-5 py-8 font-mono text-[10px] text-[var(--color-muted-foreground)]/50">
              No orders yet
            </p>
          ) : (
            <table className="w-full">
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="group transition-colors hover:bg-[var(--color-muted)]/20">
                    <td className="px-5 py-3">
                      <a
                        href={`/admin/orders/${o.id}`}
                        className="font-mono text-[11px] text-[var(--color-clay)] hover:underline"
                      >
                        #{o.id.slice(0, 8).toUpperCase()}
                      </a>
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-mono text-[11px] text-[var(--color-muted-foreground)] truncate block max-w-[120px]">
                        {o.email}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-mono text-[11px] text-[var(--color-foreground)]">
                        {fmt(o.total)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${STATUS_COLORS[o.status] ?? ""}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top products */}
        <div className="border border-[var(--color-border)] bg-[var(--color-paper)]">
          <div className="border-b border-[var(--color-border)] px-5 py-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Top Products
            </p>
          </div>
          {data.topProducts.length === 0 ? (
            <p className="px-5 py-8 font-mono text-[10px] text-[var(--color-muted-foreground)]/50">
              No sales yet
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {data.topProducts.map((p, i) => {
                const maxRev = data.topProducts[0]?.revenue ?? 1;
                return (
                  <li key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[9px] text-[var(--color-muted-foreground)] shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--color-foreground)] truncate">
                          {p.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--color-clay)] shrink-0">
                        {fmt(p.revenue)}
                      </span>
                    </div>
                    {/* Revenue bar */}
                    <div className="h-px w-full bg-[var(--color-border)]">
                      <div
                        className="h-px bg-[var(--color-clay)]/50"
                        style={{ width: `${(p.revenue / maxRev) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
