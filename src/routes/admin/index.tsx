import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Package, ShoppingBag, Mail, Tag } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { eq, desc, count, sum, sql, and, gte } from "drizzle-orm";
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
  thisWeekRevenue: number;
  avgOrderValue: number;
  cancelledOrders: number;
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

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalOrdersResult,
      todayOrdersResult,
      pendingResult,
      customerCountResult,
      recentOrdersResult,
      topProductsResult,
      chartResult,
      thisWeekResult,
      cancelledResult,
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

      // Recent 8 orders with customer email
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
        .limit(8),

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

      // Chart: orders + revenue per day last 90 days
      database
        .select({
          date: sql<string>`DATE(${orders.createdAt})::text`,
          orders: count(),
          revenue: sum(orders.total),
        })
        .from(orders)
        .where(gte(orders.createdAt, ninetyDaysAgo))
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`),

      // This week revenue
      database
        .select({ revenue: sum(orders.total) })
        .from(orders)
        .where(gte(orders.createdAt, sevenDaysAgo)),

      // Cancelled orders
      database
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "CANCELLED")),
    ]);

    const totalOrders = Number(totalOrdersResult[0]?.count ?? 0);
    const totalRevenue = Number(totalOrdersResult[0]?.revenue ?? 0);

    return {
      totalOrders,
      totalRevenue,
      todayOrders: Number(todayOrdersResult[0]?.count ?? 0),
      todayRevenue: Number(todayOrdersResult[0]?.revenue ?? 0),
      pendingOrders: Number(pendingResult[0]?.count ?? 0),
      totalCustomers: Number(customerCountResult[0]?.count ?? 0),
      thisWeekRevenue: Number(thisWeekResult[0]?.revenue ?? 0),
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      cancelledOrders: Number(cancelledResult[0]?.count ?? 0),
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

type Period = "7d" | "30d" | "90d";
type ChartMode = "revenue" | "orders";

function fmt(n: number) {
  return `${n.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} L`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function AdminDashboard() {
  const data = Route.useLoaderData();

  const [period, setPeriod] = useState<Period>("30d");
  const [mode, setMode] = useState<ChartMode>("revenue");
  // Filter chart data client-side based on selected period
  const periodDays: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - periodDays[period]);
  const filteredChart = data.chartData.filter((d: { date: string; orders: number; revenue: number }) => new Date(d.date) >= cutoff);

  const periodTotal =
    mode === "revenue"
      ? filteredChart.reduce((s: number, d: { date: string; orders: number; revenue: number }) => s + d.revenue, 0)
      : filteredChart.reduce((s: number, d: { date: string; orders: number; revenue: number }) => s + d.orders, 0);

  const statCards = [
    {
      label: "Total Revenue",
      value: fmt(data.totalRevenue),
      sub: `${data.totalOrders} orders`,
      href: "/admin/orders",
    },
    {
      label: "Pending Orders",
      value: String(data.pendingOrders),
      sub: "awaiting action",
      href: "/admin/orders?status=PENDING",
    },
    {
      label: "Today's Revenue",
      value: fmt(data.todayRevenue),
      sub: `${data.todayOrders} orders today`,
      href: "/admin/orders?status=PENDING",
    },
    {
      label: "Customers",
      value: String(data.totalCustomers),
      sub: "registered accounts",
      href: "/admin/customers",
    },
  ];

  const quickActions = [
    { label: "New Product", href: "/admin/products/new", Icon: Package },
    { label: "View Orders", href: "/admin/orders", Icon: ShoppingBag },
    { label: "Newsletter", href: "/admin/newsletter", Icon: Mail },
    { label: "Discounts", href: "/admin/discounts", Icon: Tag },
  ];

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
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <Link
            key={s.label}
            to={s.href}
            className="group relative border border-[var(--color-border)] bg-[var(--color-paper)] p-5 transition-colors hover:border-[var(--color-clay)]/50"
          >
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              {s.label}
            </p>
            <p className="mt-3 font-serif text-3xl italic text-[var(--color-foreground)]">
              {s.value}
            </p>
            <p className="mt-1 font-mono text-[9px] text-[var(--color-muted-foreground)]/60">
              {s.sub}
            </p>
            <span
              aria-hidden="true"
              className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[var(--color-clay)] opacity-0 transition-opacity group-hover:opacity-100"
            >
              →
            </span>
          </Link>
        ))}
      </div>

      {/* Secondary stats strip */}
      <div className="mb-8 flex flex-wrap gap-6 border border-[var(--color-border)] bg-[var(--color-muted)]/20 px-5 py-3">
        <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
          <span className="mr-1 opacity-50">Avg order</span>
          {fmt(data.avgOrderValue)}
        </p>
        <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
          <span className="mr-1 opacity-50">This week</span>
          {fmt(data.thisWeekRevenue)}
        </p>
        <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
          <span className="mr-1 opacity-50">Cancelled</span>
          {data.cancelledOrders}
        </p>
      </div>

      {/* Revenue / Orders chart */}
      <div className="mb-8 border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
        {/* Chart header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          {/* Period toggle */}
          <div className="flex gap-px overflow-hidden border border-[var(--color-border)]">
            {(["7d", "30d", "90d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                  period === p
                    ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                    : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {/* Mode toggle */}
            <div className="flex gap-px overflow-hidden border border-[var(--color-border)]">
              {(["revenue", "orders"] as ChartMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                    mode === m
                      ? "bg-[var(--color-foreground)] text-[var(--color-background)]"
                      : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Period total */}
            {filteredChart.length > 0 && (
              <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                {mode === "revenue" ? fmt(periodTotal) : `${periodTotal} orders`}
              </p>
            )}
          </div>
        </div>

        {filteredChart.length === 0 ? (
          <p className="py-10 text-center font-mono text-[10px] text-[var(--color-muted-foreground)]/50">
            No data for this period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={filteredChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#b56e72" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#b56e72" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => fmtDate(v)}
                tick={{ fontFamily: "monospace", fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => mode === "revenue" ? `${(v / 1000).toFixed(0)}k` : String(v)}
                tick={{ fontFamily: "monospace", fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-paper)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 0,
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "var(--color-foreground)",
                }}
                labelFormatter={(v: string) => fmtDate(v)}
                formatter={(v: number) => [
                  mode === "revenue" ? fmt(v) : `${v} orders`,
                  mode === "revenue" ? "Revenue" : "Orders",
                ]}
                cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey={mode === "revenue" ? "revenue" : "orders"}
                stroke="#b56e72"
                strokeWidth={2}
                fill="url(#chartGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#b56e72", stroke: "var(--color-paper)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row: recent orders (2/3) + right column (1/3) */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Recent orders — 2 cols */}
        <div className="border border-[var(--color-border)] bg-[var(--color-paper)] lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Recent Orders
            </p>
            <Link
              to="/admin/orders"
              className="font-mono text-[9px] text-[var(--color-clay)] hover:underline"
            >
              View all →
            </Link>
          </div>

          {data.recentOrders.length === 0 ? (
            <p className="px-5 py-8 font-mono text-[10px] text-[var(--color-muted-foreground)]/50">
              No orders yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-5 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/60">
                      Order
                    </th>
                    <th className="px-5 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/60">
                      Customer
                    </th>
                    <th className="px-5 py-2 text-right font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/60">
                      Total
                    </th>
                    <th className="px-5 py-2 text-right font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/60">
                      Status
                    </th>
                    <th className="hidden px-5 py-2 text-right font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]/60 sm:table-cell">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {data.recentOrders.map((o: { id: string; email: string; total: number; status: string; createdAt: string }) => (
                    <tr
                      key={o.id}
                      className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]/20"
                      onClick={() => {
                        window.location.href = `/admin/orders/${o.id}`;
                      }}
                    >
                      <td className="px-5 py-3">
                        <Link
                          to={`/admin/orders/${o.id}`}
                          className="font-mono text-[11px] text-[var(--color-clay)] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          #{o.id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <span className="block max-w-[140px] truncate font-mono text-[11px] text-[var(--color-muted-foreground)]">
                          {o.email}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="font-mono text-[11px] text-[var(--color-foreground)]">
                          {fmt(o.total)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${STATUS_COLORS[o.status] ?? ""}`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="hidden px-5 py-3 text-right sm:table-cell">
                        <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]/60">
                          {fmtDate(o.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: top products + quick actions */}
        <div className="flex flex-col gap-6">

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
                {data.topProducts.map((p: { name: string; revenue: number }, i: number) => {
                  const maxRev = data.topProducts[0]?.revenue ?? 1;
                  return (
                    <li key={i} className="px-5 py-3">
                      <div className="mb-1.5 flex items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="shrink-0 font-mono text-[9px] text-[var(--color-muted-foreground)]">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate font-mono text-[11px] text-[var(--color-foreground)]">
                            {p.name}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-[var(--color-clay)]">
                          {fmt(p.revenue)}
                        </span>
                      </div>
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

          {/* Quick actions */}
          <div className="border border-[var(--color-border)] bg-[var(--color-paper)]">
            <div className="border-b border-[var(--color-border)] px-5 py-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                Quick Actions
              </p>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {quickActions.map(({ label, href, Icon }) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--color-muted)]/20"
                  >
                    <Icon
                      size={14}
                      className="shrink-0 text-[var(--color-muted-foreground)] transition-colors group-hover:text-[var(--color-clay)]"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-[11px] text-[var(--color-foreground)]">
                      {label}
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-auto font-mono text-[var(--color-clay)] opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
}
