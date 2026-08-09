import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BackButton } from "@/components/admin/BackButton";
import { createServerFn } from "@tanstack/react-start";
import { eq, desc, count, and, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderItem, user, cancellationRequest } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { useState } from "react";

type OrderStatus =
  | "ALL"
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

interface OrderRow {
  id: string;
  email: string;
  itemCount: number;
  total: number;
  status: string;
  createdAt: string;
  hasUnreadCancellation: boolean;
}

interface OrdersData {
  rows: OrderRow[];
  total: number;
  page: number;
  status: OrderStatus;
  search: string;
}

const PAGE_SIZE = 30;

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  CONFIRMED: "bg-blue-500/20 text-blue-400",
  SHIPPED: "bg-purple-500/20 text-purple-400",
  DELIVERED: "bg-green-500/20 text-green-400",
  CANCELLED: "bg-red-500/20 text-red-400",
  REFUNDED: "bg-orange-500/20 text-orange-400",
};

const STATUS_TABS: OrderStatus[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const getOrders = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const d = input as { page?: number; status?: string; search?: string };
    return {
      page: Number(d?.page ?? 1),
      status: (d?.status ?? "ALL") as OrderStatus,
      search: (d?.search ?? "").trim(),
    };
  })
  .handler(async ({ data }): Promise<OrdersData> => {
    await requireAdmin();
    const database = db();
    const offset = (data.page - 1) * PAGE_SIZE;

    const statusFilter =
      data.status !== "ALL"
        ? eq(orders.status, data.status as "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED")
        : undefined;

    const searchFilter = data.search
      ? ilike(orders.id, `${data.search}%`)
      : undefined;

    const whereClause =
      statusFilter && searchFilter ? and(statusFilter, searchFilter)
      : statusFilter ?? searchFilter;

    const [rows, totalResult] = await Promise.all([
      database
        .select({
          id: orders.id,
          email: user.email,
          total: orders.total,
          status: orders.status,
          createdAt: orders.createdAt,
          itemCount: count(orderItem.id),
        })
        .from(orders)
        .innerJoin(user, eq(orders.userId, user.id))
        .leftJoin(orderItem, eq(orderItem.orderId, orders.id))
        .where(whereClause)
        .groupBy(orders.id, user.email)
        .orderBy(desc(orders.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      database
        .select({ count: count() })
        .from(orders)
        .where(whereClause),
    ]);

    const orderIds = rows.map((r) => r.id);
    const unreadCancellations = orderIds.length > 0
      ? await database
          .select({ orderId: cancellationRequest.orderId })
          .from(cancellationRequest)
          .where(and(
            inArray(cancellationRequest.orderId, orderIds),
            eq(cancellationRequest.isRead, false),
          ))
      : [];
    const unreadSet = new Set(unreadCancellations.map((c) => c.orderId));

    return {
      rows: rows.map((r) => ({
        id: r.id,
        email: r.email,
        itemCount: Number(r.itemCount),
        total: Number(r.total),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        hasUnreadCancellation: unreadSet.has(r.id),
      })),
      total: Number(totalResult[0]?.count ?? 0),
      page: data.page,
      status: data.status,
      search: data.search,
    };
  });

export const Route = createFileRoute("/admin/orders/")({
  loaderDeps: ({ search }) => {
    const s = search as Record<string, string>;
    return {
      page: Number(s.page ?? 1),
      status: (s.status ?? "ALL") as OrderStatus,
      search: s.search ?? "",
    };
  },
  loader: ({ deps }) => getOrders({ data: deps }),
  component: OrderList,
});

function OrderList() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(data.search);

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  function setStatus(status: OrderStatus) {
    navigate({ to: "/admin/orders", search: { status, page: "1", search: data.search } });
  }

  function submitSearch(value: string) {
    navigate({ to: "/admin/orders", search: { status: data.status, page: "1", search: value.trim() } });
  }

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
      <h1 className="mb-6 font-serif text-2xl italic text-[var(--color-foreground)]">
        Orders
        <span className="ml-3 font-mono text-sm not-italic text-[var(--color-muted-foreground)]">
          ({data.total})
        </span>
      </h1>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`whitespace-nowrap rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${data.status === s ? "bg-[var(--color-clay)] text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Search by order ID */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitSearch(searchInput); }}
          placeholder="Search by order ID…"
          className="w-64 border border-[var(--color-border)] bg-[var(--color-paper)] px-3 py-2 font-mono text-xs text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]/40 focus:border-[var(--color-clay)]"
        />
        <button
          onClick={() => submitSearch(searchInput)}
          className="border border-[var(--color-border)] px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
        >
          Search
        </button>
        {data.search && (
          <button
            onClick={() => { setSearchInput(""); submitSearch(""); }}
            className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-clay)] transition-colors hover:opacity-70"
          >
            Clear
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Order", "Customer", "Items", "Total", "Status", "Date"].map(
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
            {data.rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]"
                >
                  No orders
                </td>
              </tr>
            )}
            {data.rows.map((o) => (
              <tr
                key={o.id}
                className="cursor-pointer hover:bg-[var(--color-muted)]/30"
                onClick={() =>
                  navigate({ to: "/admin/orders/$id", params: { id: o.id } })
                }
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/admin/orders/$id"
                      params={{ id: o.id }}
                      className="font-mono text-xs text-[var(--color-clay)] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{o.id.slice(0, 8)}
                    </Link>
                    {o.hasUnreadCancellation && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-clay)]" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">
                  {o.email}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {o.itemCount}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                  {fmt(o.total)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${STATUS_COLORS[o.status] ?? ""}`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {fmtDate(o.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
            <Link
              key={pg}
              to="/admin/orders"
              search={{ page: String(pg), status: data.status, search: data.search }}
              className={`flex h-8 w-8 items-center justify-center rounded font-mono text-xs transition-colors ${data.page === pg ? "bg-[var(--color-clay)] text-white" : "bg-[var(--color-paper)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
            >
              {pg}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
