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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 font-serif text-2xl italic text-[var(--color-foreground)]">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)]">
          {sub}
        </p>
      )}
    </div>
  );
}

function AdminDashboard() {
  const data = Route.useLoaderData();

  function fmt(n: number) {
    return `€${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Dashboard
      </h1>

      {/* Stats grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <StatCard
            label="Total Revenue"
            value={fmt(data.totalRevenue)}
            sub={`${data.totalOrders} orders all time`}
          />
        </div>
        <div className="xl:col-span-2">
          <StatCard
            label="Today's Revenue"
            value={fmt(data.todayRevenue)}
            sub={`${data.todayOrders} orders today`}
          />
        </div>
        <StatCard
          label="Pending Orders"
          value={String(data.pendingOrders)}
        />
        <StatCard
          label="Customers"
          value={String(data.totalCustomers)}
        />
      </div>

      {/* Chart */}
      <div className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
          Revenue — Last 30 Days
        </p>
        {data.chartData.length === 0 ? (
          <p className="py-8 text-center font-mono text-xs text-[var(--color-muted-foreground)]">
            No data yet
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.chartData}>
              <XAxis
                dataKey="date"
                tick={{
                  fontSize: 10,
                  fontFamily: "JetBrains Mono",
                  fill: "var(--color-muted-foreground)",
                }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{
                  fontSize: 10,
                  fontFamily: "JetBrains Mono",
                  fill: "var(--color-muted-foreground)",
                }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `€${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-paper)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "JetBrains Mono",
                }}
                formatter={(v: number) => [`€${v.toFixed(2)}`, "Revenue"]}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-clay)"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent orders */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Recent Orders
          </p>
          {data.recentOrders.length === 0 ? (
            <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
              No orders yet
            </p>
          ) : (
            <table className="w-full">
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="group">
                    <td className="py-2.5 pr-3">
                      <a
                        href={`/admin/orders/${o.id}`}
                        className="font-mono text-xs text-[var(--color-clay)] hover:underline"
                      >
                        #{o.id.slice(0, 8)}
                      </a>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {o.email}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      <span className="font-mono text-xs text-[var(--color-foreground)]">
                        {fmt(o.total)}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${STATUS_COLORS[o.status] ?? ""}`}
                      >
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
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Top Products by Revenue
          </p>
          {data.topProducts.length === 0 ? (
            <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
              No sales yet
            </p>
          ) : (
            <ul className="space-y-3">
              {data.topProducts.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-xs text-[var(--color-foreground)]">
                      {p.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[var(--color-clay)]">
                    {fmt(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
