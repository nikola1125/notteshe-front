import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  const customers = Route.useLoaderData() as CustomerRow[];
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      )
    : customers;

  function fmt(n: number) {
    return `${n.toFixed(2)} €`;
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

      {/* Customer list — cards for all screen sizes, always clickable */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]">No customers found</p>
        )}
        {(filtered as CustomerRow[]).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => navigate({ to: "/admin/customers/$id", params: { id: c.id } })}
            className="flex w-full items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-muted)]/20 active:opacity-60"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{c.name}</p>
              <p className="truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">{c.email}</p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{fmtDate(c.joinedAt)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xs text-[var(--color-clay)]">{fmt(c.totalSpent)}</p>
              <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{c.totalOrders} order{c.totalOrders !== 1 ? "s" : ""}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
