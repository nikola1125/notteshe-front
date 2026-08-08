import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq, desc, count, sum } from "drizzle-orm";
import { db } from "@/db";
import { user, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { useState } from "react";

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

export const Route = createFileRoute("/admin/customers/")({
  loader: () => getCustomers(),
  staleTime: 30_000,
  component: Customers,
});

function Customers() {
  const customers = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = search.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  function fmt(n: number) {
    return `${n.toFixed(2)} L`;
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
      <BackButton />
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">
          Customers
          <span className="ml-3 font-mono text-sm not-italic text-[var(--color-muted-foreground)]">
            ({customers.length})
          </span>
        </h1>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-1.5 font-mono text-xs text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)] placeholder:text-[var(--color-muted-foreground)]"
        />
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 lg:hidden">
        {filtered.length === 0 && (
          <p className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]">No customers found</p>
        )}
        {filtered.map((c) => (
          <Link
            key={c.id}
            to="/admin/customers/$id"
            params={{ id: c.id }}
            className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-3 transition-colors hover:bg-[var(--color-muted)]/20 active:opacity-60"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{c.name}</p>
              <p className="truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">{c.email}</p>
            </div>
            <div className="ml-4 shrink-0 text-right">
              <p className="font-mono text-xs text-[var(--color-clay)]">{fmt(c.totalSpent)}</p>
              <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{c.totalOrders} orders</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-[var(--color-border)] lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Name", "Email", "Orders", "Total Spent", "Joined"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-paper)]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]">
                  No customers found
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr
                key={c.id}
                onClick={() => void navigate({ to: "/admin/customers/$id", params: { id: c.id } })}
                className="cursor-pointer hover:bg-[var(--color-muted)]/30 active:opacity-60"
              >
                <td className="px-4 py-3 text-sm text-[var(--color-foreground)]">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">{c.email}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">{c.totalOrders}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-clay)]">{fmt(c.totalSpent)}</td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">{fmtDate(c.joinedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
