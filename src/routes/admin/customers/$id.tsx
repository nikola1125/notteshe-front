import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { db } from "@/db";
import {
  user,
  orders,
  orderItem,
  address,
  wishlistItem,
  giftCard,
  giftCardTransaction,
  newsletterSubscriber,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import { ChevronDown, Download } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItemRow {
  id: string;
  productSnapshot: { name?: string; image?: string } | null;
  size: string;
  colour: string;
  quantity: number;
  unitPrice: number;
}

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
}

interface OrderRow {
  id: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  paymentFee: number;
  discountCode: string | null;
  discountAmount: number;
  total: number;
  pokOrderId: string | null;
  shippingAddress: ShippingAddress;
  createdAt: string;
  items: OrderItemRow[];
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  blocked: boolean;
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
      blocked: u.blocked,
      createdAt: u.createdAt.toISOString(),
      orders: orderRows.map((o, i) => ({
        id: o.id,
        status: o.status,
        subtotal: Number(o.subtotal),
        shippingFee: Number(o.shippingFee),
        paymentFee: Number(o.paymentFee ?? 0),
        discountCode: o.discountCode ?? null,
        discountAmount: Number(o.discountAmount ?? 0),
        total: Number(o.total),
        pokOrderId: o.pokOrderId ?? null,
        shippingAddress: (o.shippingAddress ?? {}) as ShippingAddress,
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

const setBlockedCustomer = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string(), blocked: z.boolean() }).parse(input)
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(user)
      .set({ blocked: data.blocked, updatedAt: new Date() })
      .where(eq(user.id, data.id));
    await logAudit(
      admin.id,
      data.blocked ? "customer.block" : "customer.unblock",
      "user",
      data.id,
      { after: { blocked: data.blocked } }
    );
    return { success: true };
  });

const deleteCustomer = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string() }).parse(input)
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();

    // Delete orders manually first — orders.userId has onDelete: "restrict"
    // so we must remove the orders before removing the user.
    // orderItem rows cascade from orders automatically.
    const userOrders = await database
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.userId, data.id));

    for (const o of userOrders) {
      await database.delete(orderItem).where(eq(orderItem.orderId, o.id));
    }
    if (userOrders.length > 0) {
      await database.delete(orders).where(eq(orders.userId, data.id));
    }

    // All other FK refs to user.id use onDelete: "cascade" — they'll be
    // handled automatically by Postgres when the user row is deleted.
    await database.delete(user).where(eq(user.id, data.id));

    await logAudit(admin.id, "customer.delete", "user", data.id);
    return { success: true };
  });

const getUserDataExport = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ id: (input as { id: string }).id }))
  .handler(async ({ data }) => {
    await requireAdmin();
    const database = db();

    const [userRows, addressRows, orderRows, wishlistRows, giftCardRows] =
      await Promise.all([
        database.select().from(user).where(eq(user.id, data.id)).limit(1),
        database.select().from(address).where(eq(address.userId, data.id)),
        database
          .select()
          .from(orders)
          .where(eq(orders.userId, data.id))
          .orderBy(desc(orders.createdAt)),
        database.select().from(wishlistItem).where(eq(wishlistItem.userId, data.id)),
        database.select().from(giftCard).where(eq(giftCard.purchaserUserId, data.id)),
      ]);

    if (!userRows[0]) throw new Error("Customer not found");
    const u = userRows[0];

    // Newsletter table has no userId FK — look up by email
    const newsletterRowsReal = await database
      .select()
      .from(newsletterSubscriber)
      .where(eq(newsletterSubscriber.email, u.email))
      .limit(1);

    // Fetch order items for all orders
    const orderItemRows =
      orderRows.length > 0
        ? await Promise.all(
            orderRows.map((o) =>
              database.select().from(orderItem).where(eq(orderItem.orderId, o.id))
            )
          )
        : [];

    // Fetch gift card transactions for all purchased gift cards
    const giftCardTransactionRows =
      giftCardRows.length > 0
        ? await Promise.all(
            giftCardRows.map((gc) =>
              database
                .select()
                .from(giftCardTransaction)
                .where(eq(giftCardTransaction.giftCardId, gc.id))
                .orderBy(desc(giftCardTransaction.createdAt))
            )
          )
        : [];

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        phone: u.phone ?? null,
        blocked: u.blocked,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      },
      addresses: addressRows.map((a) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        line1: a.line1,
        line2: a.line2 ?? null,
        city: a.city,
        postalCode: a.postalCode,
        country: a.country,
        isDefault: a.isDefault,
        createdAt: a.createdAt.toISOString(),
      })),
      orders: orderRows.map((o, i) => ({
        id: o.id,
        status: o.status,
        subtotal: Number(o.subtotal),
        shippingFee: Number(o.shippingFee),
        paymentFee: Number(o.paymentFee ?? 0),
        discountCode: o.discountCode ?? null,
        discountAmount: Number(o.discountAmount ?? 0),
        giftCardCode: o.giftCardCode ?? null,
        giftCardAmountLek: Number(o.giftCardAmountLek ?? 0),
        total: Number(o.total),
        currency: o.currency,
        pokAmount: o.pokAmount != null ? Number(o.pokAmount) : null,
        shippingAddress: o.shippingAddress as Record<string, string | null | undefined>,
        pokOrderId: o.pokOrderId ?? null,
        trackingNumber: o.trackingNumber ?? null,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        items: (orderItemRows[i] ?? []).map((it) => ({
          id: it.id,
          productSnapshot: it.productSnapshot,
          size: it.size,
          colour: it.colour,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
        })),
      })),
      wishlistItems: wishlistRows.map((w) => ({
        id: w.id,
        productId: w.productId,
        addedAt: w.createdAt.toISOString(),
      })),
      giftCardsPurchased: giftCardRows.map((gc, i) => ({
        id: gc.id,
        code: gc.code,
        initialAmount: Number(gc.initialAmount),
        balance: Number(gc.balance),
        status: gc.status,
        recipientEmail: gc.recipientEmail,
        recipientName: gc.recipientName,
        message: gc.message ?? null,
        sourceOrderId: gc.sourceOrderId ?? null,
        expiresAt: gc.expiresAt?.toISOString() ?? null,
        createdAt: gc.createdAt.toISOString(),
        lastUsedAt: gc.lastUsedAt?.toISOString() ?? null,
        transactions: (giftCardTransactionRows[i] ?? []).map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: Number(tx.amount),
          balanceAfter: Number(tx.balanceAfter),
          orderId: tx.orderId ?? null,
          note: tx.note ?? null,
          createdAt: tx.createdAt.toISOString(),
        })),
      })),
      newsletterSubscription: newsletterRowsReal[0]
        ? {
            email: newsletterRowsReal[0].email,
            isActive: newsletterRowsReal[0].isActive,
            source: newsletterRowsReal[0].source ?? null,
            subscribedAt: newsletterRowsReal[0].createdAt.toISOString(),
          }
        : null,
    };
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
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail>(initial);
  const [tab, setTab] = useState<"profile" | "orders">("profile");
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

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

  async function handleToggleBlock() {
    setBlocking(true);
    const nextBlocked = !customer.blocked;
    try {
      await setBlockedCustomer({ data: { id: customer.id, blocked: nextBlocked } });
      setCustomer((prev) => ({ ...prev, blocked: nextBlocked }));
      toast.success(nextBlocked ? "Customer blocked" : "Customer unblocked");
    } catch {
      toast.error("Failed to update block status");
    } finally {
      setBlocking(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteCustomer({ data: { id: customer.id } });
      toast.success("Customer deleted");
      await router.navigate({ to: "/admin/customers" });
    } catch {
      toast.error("Failed to delete customer");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleExport() {
    setDownloading(true);
    try {
      const data = await getUserDataExport({ data: { id: customer.id } });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `notteshe-user-data-${customer.id}-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />

      {/* ── Header ── */}
      <div className="mb-6">
        <p className="font-mono text-[10px] tracking-widest text-[var(--color-muted-foreground)]">
          {customer.id}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl italic text-[var(--color-foreground)]">{customer.name}</h1>
          {customer.blocked && (
            <span className="rounded bg-red-500/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-red-400">
              Blocked
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{customer.email}</span>
          <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
            Joined {fmtDate(customer.createdAt)}
          </span>
          <span className="rounded bg-[var(--color-muted)]/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            {customer.orders.length} order{customer.orders.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => void handleExport()}
            disabled={downloading}
            className="ml-auto flex items-center gap-1.5 rounded border border-[var(--color-border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            <Download size={11} />
            {downloading ? "Exporting…" : "Export data (GDPR)"}
          </button>
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
        <div className="max-w-xl space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-6">
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

          {/* ── Danger zone ── */}
          <div className="rounded-lg border border-red-500/30 bg-[var(--color-paper)] p-6">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Account Actions
            </p>
            <div className="space-y-4">

              {/* Block / Unblock */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-foreground)]">
                    {customer.blocked ? "Unblock customer" : "Block customer"}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                    {customer.blocked
                      ? "Allow this customer to sign in again."
                      : "Prevent this customer from signing in."}
                  </p>
                </div>
                <button
                  onClick={() => void handleToggleBlock()}
                  disabled={blocking}
                  className={`shrink-0 rounded border px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40 ${
                    customer.blocked
                      ? "border-[var(--color-border)] text-[var(--color-foreground)]"
                      : "border-red-500/50 text-red-400"
                  }`}
                >
                  {blocking ? "…" : customer.blocked ? "Unblock" : "Block"}
                </button>
              </div>

              <div className="border-t border-[var(--color-border)]" />

              {/* Delete */}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--color-foreground)]">Delete customer</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                    Permanently remove this account and all its data. Cannot be undone.
                  </p>
                </div>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="shrink-0 rounded border border-red-500/50 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-red-400 transition-opacity hover:opacity-80"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">Sure?</span>
                    <button
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      className="font-mono text-[10px] uppercase tracking-widest text-red-400 transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

            </div>
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
                    <span className="font-mono text-xs text-[var(--color-clay)]">{o.total.toFixed(2)} €</span>
                    <span className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{fmtDate(o.createdAt)}</span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 text-[var(--color-muted-foreground)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Expanded order detail */}
                {isOpen && (
                  <div className="border-t border-[var(--color-border)] px-4 py-4 space-y-5">

                    {/* Items */}
                    <div>
                      <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Items</p>
                      <div className="divide-y divide-[var(--color-border)] rounded border border-[var(--color-border)]">
                        {o.items.length === 0 && (
                          <p className="px-3 py-2 font-mono text-[10px] text-[var(--color-muted-foreground)]">No items</p>
                        )}
                        {o.items.map((it) => (
                          <div key={it.id} className="flex items-center gap-3 px-3 py-2.5">
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
                              {(it.unitPrice * it.quantity).toFixed(2)} €
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom row: totals + shipping + payment */}
                    <div className="grid gap-4 sm:grid-cols-3">

                      {/* Totals */}
                      <div>
                        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Summary</p>
                        <div className="space-y-1">
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-[var(--color-muted-foreground)]">Subtotal</span>
                            <span>{o.subtotal.toFixed(2)} €</span>
                          </div>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-[var(--color-muted-foreground)]">Shipping</span>
                            <span>{o.shippingFee.toFixed(2)} €</span>
                          </div>
                          {o.paymentFee > 0 && (
                            <div className="flex justify-between font-mono text-[10px]">
                              <span className="text-[var(--color-muted-foreground)]">Payment fee</span>
                              <span>{o.paymentFee.toFixed(2)} €</span>
                            </div>
                          )}
                          {o.discountCode && (
                            <div className="flex justify-between font-mono text-[10px] text-green-400">
                              <span>Discount ({o.discountCode})</span>
                              <span>−{o.discountAmount.toFixed(2)} €</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-[var(--color-border)] pt-1 font-mono text-xs font-medium">
                            <span>Total</span>
                            <span className="text-[var(--color-clay)]">{o.total.toFixed(2)} €</span>
                          </div>
                        </div>
                      </div>

                      {/* Shipping address */}
                      <div>
                        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Ship to</p>
                        <div className="space-y-0.5 font-mono text-[10px] text-[var(--color-foreground)]">
                          <p>{o.shippingAddress.firstName} {o.shippingAddress.lastName}</p>
                          <p className="text-[var(--color-muted-foreground)]">{o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""}</p>
                          <p className="text-[var(--color-muted-foreground)]">{o.shippingAddress.postalCode} {o.shippingAddress.city}</p>
                          <p className="text-[var(--color-muted-foreground)]">{o.shippingAddress.country}</p>
                          {o.shippingAddress.phone && <p className="text-[var(--color-muted-foreground)]">{o.shippingAddress.phone}</p>}
                        </div>
                      </div>

                      {/* Payment */}
                      <div>
                        <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-[var(--color-muted-foreground)]">Payment</p>
                        <p className="font-mono text-[10px] text-[var(--color-foreground)]">
                          {o.pokOrderId ? "Card (POK Pay)" : "Cash on Delivery"}
                        </p>
                      </div>
                    </div>

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
