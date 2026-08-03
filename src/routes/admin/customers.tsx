import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq, desc, count, sum, sql } from "drizzle-orm";
import { db } from "@/db";
import { user, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  joinedAt: string;
}

const getCustomers = createServerFn({ method: "GET" }).handler(
  async (): Promise<CustomerRow[]> => {
    await requireAdmin();

    const rows = await db()
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        totalOrders: count(orders.id),
        totalSpent: sum(orders.total),
      })
      .from(user)
      .leftJoin(orders, eq(orders.userId, user.id))
      .groupBy(user.id)
      .orderBy(desc(user.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      totalOrders: Number(r.totalOrders),
      totalSpent: Number(r.totalSpent ?? 0),
      joinedAt: r.createdAt.toISOString(),
    }));
  }
);

export const Route = createFileRoute("/admin/customers")({
  loader: () => getCustomers(),
  component: Customers,
});

function Customers() {
  const customers = Route.useLoaderData();

  function fmt(n: number) {
    return `€${n.toFixed(2)}`;
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Customers
        <span className="ml-3 font-mono text-sm not-italic text-[var(--color-muted-foreground)]">
          ({customers.length})
        </span>
      </h1>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Name", "Email", "Orders", "Total Spent", "Joined"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-paper)]">
            {customers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]"
                >
                  No customers yet
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--color-muted)]/30">
                <td className="px-4 py-3 text-sm text-[var(--color-foreground)]">
                  {c.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {c.email}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                  {c.totalOrders}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-clay)]">
                  {fmt(c.totalSpent)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {fmtDate(c.joinedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
