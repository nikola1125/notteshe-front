import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/db";
import { user, orders, orderItem } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItemRow {
  id: string;
  productSnapshot: { name?: string; image?: string } | null;
  size: string;
  colour: string;
  quantity: number;
  unitPrice: number;
}

interface OrderRow {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItemRow[];
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  orders: OrderRow[];
}

// ─── Server functions ─────────────────────────────────────────────────────────

const getCustomerDetail = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ id: (input as { id: string }).id }))
  .handler(async ({ data }): Promise<CustomerDetail> => {
    await requireAdmin();
    const database = db();

    const [userRows, orderRows] = await Promise.all([
      database.select().from(user).where(eq(user.id, data.id)).limit(1),
      database
        .select()
        .from(orders)
        .where(eq(orders.userId, data.id))
        .orderBy(desc(orders.createdAt)),
    ]);

    if (!userRows[0]) throw new Error("Customer not found");
    const u = userRows[0];

    const allItems =
      orderRows.length > 0
        ? await Promise.all(
            orderRows.map((o) =>
              database
                .select()
                .from(orderItem)
                .where(eq(orderItem.orderId, o.id))
            )
          )
        : [];

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      createdAt: u.createdAt.toISOString(),
      orders: orderRows.map((o, i) => ({
        id: o.id,
        status: o.status,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
        items: (allItems[i] ?? []).map((it) => ({
          id: it.id,
          productSnapshot: it.productSnapshot as { name?: string; image?: string } | null,
          size: it.size,
          colour: it.colour,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
        })),
      })),
    };
  });

const updateCustomer = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string(), name: z.string().min(1), phone: z.string().nullable() }).parse(input)
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(user)
      .set({ name: data.name, phone: data.phone, updatedAt: new Date() })
      .where(eq(user.id, data.id));
    await logAudit(admin.id, "customer.update", "user", data.id, { after: { name: data.name, phone: data.phone } });
    return { success: true };
  });

// ─── Route ────────────────────────────────────────────────────────────────────

function CustomerDetailError({ error }: { error: Error }) {
  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <p className="font-mono text-sm text-red-500">Failed to load customer: {error.message}</p>
    </div>
  );
}

export const Route = createFileRoute("/admin/customers/$id")({
  loader: ({ params }) => getCustomerDetail({ data: { id: params.id } }),
  errorComponent: CustomerDetailError,
  component: CustomerDetail,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-amber-500/20 text-amber-400",
  CONFIRMED: "bg-blue-500/20 text-blue-400",
  SHIPPED:   "bg-purple-500/20 text-purple-400",
  DELIVERED: "bg-green-500/20 text-green-400",
  CANCELLED: "bg-red-500/20 text-red-400",
  REFUNDED:  "bg-[var(--color-muted)]/40 text-[var(--color-muted-foreground)]",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

function CustomerDetail() {
  const initial = Route.useLoaderData() as CustomerDetail;
  const [customer, setCustomer] = useState<CustomerDetail>(initial);
  const [tab, setTab] = useState<"profile" | "orders">("profile");
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  function toggleOrder(id: string) {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await updateCustomer({ data: { id: customer.id, name, phone: phone.trim() || null } });
      setCustomer((prev) => ({ ...prev, name, phone: phone.trim() || null }));
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const shortId = customer.id.slice(0, 8).toUpperCase();

  return (
    <div className="p-6 lg:p-8">
      <BackButton />

      {/* ── Header ── */}
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-widest text-[var(--color-muted-foreground)]">
          {customer.id}
        </p>
        <h1 className="mt-1 font-serif text-3xl italic text-[var(--color-foreground)]">{customer.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{customer.email}</span>
          <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
            Joined {fmtDate(customer.createdAt)}
          </span>
          <span className="rounded bg-[var(--color-muted)]/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            {customer.orders.length} order{customer.orders.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="mb-6 flex gap-0 border-b border-[var(--color-border)]">
        {(["profile", "orders"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition-colors ${
              tab === t
                ? "border-b-2 border-[var(--color-clay)] text-[var(--color-foreground)]"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Profile tab ── */}
      {tab === "profile" && (
        <div className="max-w-xl rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-6">
          <p className="mb-5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Profile Information
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                Email
              </label>
              <input
                type="email"
                value={customer.email}
                disabled
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-muted)]/10 px-3 py-2 text-sm text-[var(--color-muted-foreground)] outline-none cursor-not-allowed"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="—"
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)] placeholder:text-[var(--color-muted-foreground)]"
              />
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={() => void handleSaveProfile()}
              disabled={saving}
              className="rounded bg-[var(--color-clay)] px-5 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* ── Orders tab ── */}
      {tab === "orders" && (
        <div className="space-y-3">
          {customer.orders.length === 0 && (
            <p className="py-12 text-center font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              No orders yet
            </p>
          )}
          {customer.orders.map((o) => {
            const isOpen = expandedOrders.has(o.id);
            return (
              <div key={o.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)]">
                {/* Order summary row — click to expand */}
                <button
                  onClick={() => toggleOrder(o.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className={`inline-flex w-fit rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${STATUS_COLORS[o.status] ?? ""}`}>
                      {o.status}
                    </span>
                    <span className="font-mono text-xs text-[var(--color-clay)]">{o.total.toFixed(2)} L</span>
                    <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{fmtDate(o.createdAt)}</span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 text-[var(--color-muted-foreground)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Expanded order items */}
                {isOpen && (
                  <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                    {o.items.length === 0 && (
                      <p className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted-foreground)]">No items</p>
                    )}
                    {o.items.map((it) => (
                      <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                        {it.productSnapshot?.image && (
                          <img
                            src={it.productSnapshot.image}
                            alt={it.productSnapshot.name ?? ""}
                            className="h-12 w-9 shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[var(--color-foreground)]">
                            {it.productSnapshot?.name ?? "—"}
                          </p>
                          <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                            {it.size} · {it.colour} · ×{it.quantity}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-[var(--color-clay)]">
                          {(it.unitPrice * it.quantity).toFixed(2)} L
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
