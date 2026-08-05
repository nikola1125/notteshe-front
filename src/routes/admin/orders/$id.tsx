import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq, desc, sql, and } from "drizzle-orm";
import { toast } from "sonner";
import { useState } from "react";
import { db } from "@/db";
import { orders, orderItem, productSize, user, auditLog, adminUser } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  CONFIRMED: "bg-blue-500/20 text-blue-400",
  SHIPPED: "bg-purple-500/20 text-purple-400",
  DELIVERED: "bg-green-500/20 text-green-400",
  CANCELLED: "bg-red-500/20 text-red-400",
  REFUNDED: "bg-orange-500/20 text-orange-400",
};

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

interface ProductSnapshot {
  name?: string;
  price?: number;
  imageUrl?: string;
}

interface OrderDetailData {
  order: {
    id: string;
    status: OrderStatus;
    subtotal: number;
    shippingFee: number;
    paymentFee: number;
    discountCode: string | null;
    discountAmount: number;
    total: number;
    shippingAddress: ShippingAddress;
    adminNote: string | null;
    trackingNumber: string | null;
    createdAt: string;
  };
  customer: { name: string; email: string };
  items: Array<{
    id: string;
    snapshot: ProductSnapshot;
    size: string;
    colour: string;
    quantity: number;
    unitPrice: number;
  }>;
  history: Array<{
    id: string;
    action: string;
    adminName: string | null;
    createdAt: string;
  }>;
}

const getOrderDetail = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ id: (input as { id: string }).id }))
  .handler(async ({ data }): Promise<OrderDetailData> => {
    await requireAdmin();
    const database = db();

    const [orderRows, itemRows, historyRows] = await Promise.all([
      database
        .select({
          order: {
            id: orders.id,
            status: orders.status,
            subtotal: orders.subtotal,
            shippingFee: orders.shippingFee,
            total: orders.total,
            shippingAddress: orders.shippingAddress,
            adminNote: orders.adminNote,
            trackingNumber: orders.trackingNumber,
            createdAt: orders.createdAt,
          },
          customer: { name: user.name, email: user.email },
        })
        .from(orders)
        .innerJoin(user, eq(orders.userId, user.id))
        .where(eq(orders.id, data.id))
        .limit(1),
      database
        .select()
        .from(orderItem)
        .where(eq(orderItem.orderId, data.id)),
      database
        .select({
          id: auditLog.id,
          action: auditLog.action,
          adminName: adminUser.name,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(adminUser, eq(auditLog.adminId, adminUser.id))
        .where(eq(auditLog.entityId, data.id))
        .orderBy(desc(auditLog.createdAt)),
    ]);

    if (!orderRows[0]) throw new Error("Order not found");
    const { order: o, customer } = orderRows[0];

    // Extra columns added later — query separately so page works before migration
    let discountCode: string | null = null;
    let discountAmount = 0;
    let paymentFee = 0;
    try {
      const dr = await database
        .select({ discountCode: orders.discountCode, discountAmount: orders.discountAmount, paymentFee: orders.paymentFee })
        .from(orders)
        .where(eq(orders.id, data.id))
        .limit(1);
      discountCode = dr[0]?.discountCode ?? null;
      discountAmount = Number(dr[0]?.discountAmount ?? 0);
      paymentFee = Number(dr[0]?.paymentFee ?? 0);
    } catch { /* column not yet migrated */ }

    return {
      order: {
        id: o.id,
        status: o.status as OrderStatus,
        subtotal: Number(o.subtotal),
        shippingFee: Number(o.shippingFee),
        paymentFee,
        discountCode,
        discountAmount,
        total: Number(o.total),
        shippingAddress: o.shippingAddress as ShippingAddress,
        adminNote: o.adminNote,
        trackingNumber: o.trackingNumber,
        createdAt: o.createdAt.toISOString(),
      },
      customer: { name: customer.name, email: customer.email },
      items: itemRows.map((item) => ({
        id: item.id,
        snapshot: item.productSnapshot as ProductSnapshot,
        size: item.size,
        colour: item.colour,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
      history: historyRows.map((h) => ({
        id: h.id,
        action: h.action,
        adminName: h.adminName,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  });

const updateOrderStatus = createServerFn({ method: "POST" })
  .validator(
    (input: unknown) =>
      input as { id: string; status: OrderStatus; trackingNumber?: string }
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    const database = db();

    const [current] = await database
      .select({ status: orders.status, pokOrderId: orders.pokOrderId, total: orders.total })
      .from(orders)
      .where(eq(orders.id, data.id))
      .limit(1);

    const prevStatus = current?.status as OrderStatus | undefined;
    const pokOrderId = current?.pokOrderId ?? null;
    const total = Number(current?.total ?? 0);

    // POK uses autoCapture: true — money is taken at checkout, no capture step needed.
    // Admin confirm is a pure status update. Cancellations/refunds call pokRefund (blocking).
    if (pokOrderId) {
      const { pokRefund } = await import("@/lib/pok");

      const needsRefund =
        data.status === "CANCELLED" ||
        data.status === "REFUNDED";

      const wasCharged =
        prevStatus !== "CANCELLED" && prevStatus !== "REFUNDED";

      if (needsRefund && wasCharged) {
        // Blocking: if POK refund fails, throw so the DB is NOT updated and admin sees the error.
        // Customer should not be left without money back on a silent failure.
        await pokRefund(
          pokOrderId,
          total,
          data.status === "REFUNDED" ? "Customer refund request" : "Order cancelled by merchant"
        );
      }
    }

    const updateData: Record<string, unknown> = {
      status: data.status,
      updatedAt: new Date(),
    };
    if (data.trackingNumber !== undefined) {
      updateData.trackingNumber = data.trackingNumber;
    }

    await database
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, data.id));

    // Restore stock when an order is cancelled or refunded
    if (data.status === "CANCELLED" || data.status === "REFUNDED") {
      if (prevStatus !== "CANCELLED" && prevStatus !== "REFUNDED") {
        const items = await database
          .select({ productId: orderItem.productId, size: orderItem.size, quantity: orderItem.quantity })
          .from(orderItem)
          .where(eq(orderItem.orderId, data.id));
        for (const item of items) {
          if (!item.productId) continue;
          await database
            .update(productSize)
            .set({ stock: sql`stock + ${item.quantity}` })
            .where(and(eq(productSize.productId, item.productId), eq(productSize.label, item.size)));
        }
      }
    }

    await logAudit(admin.id, "order.status_change", "order", data.id, {
      before: { status: prevStatus },
      after: { status: data.status, pokOrderId: pokOrderId ?? undefined },
    });

    return { success: true };
  });

const saveAdminNote = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { id: string; note: string })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(orders)
      .set({ adminNote: data.note, updatedAt: new Date() })
      .where(eq(orders.id, data.id));
    await logAudit(admin.id, "order.note_update", "order", data.id);
    return { success: true };
  });

export const Route = createFileRoute("/admin/orders/$id")({
  loader: ({ params }) => getOrderDetail({ data: { id: params.id } }),
  component: OrderDetail,
});

function OrderDetail() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();
  const [data, setData] = useState(loaderData);
  const [trackingInput, setTrackingInput] = useState(
    data.order.trackingNumber ?? ""
  );
  const [note, setNote] = useState(data.order.adminNote ?? "");
  const [savingStatus, setSavingStatus] = useState<OrderStatus | null>(null);
  const [statusFlash, setStatusFlash] = useState(false);

  const transitions =
    STATUS_TRANSITIONS[data.order.status] ?? [];

  async function handleStatusChange(newStatus: OrderStatus) {
    setSavingStatus(newStatus);
    try {
      await updateOrderStatus({
        data: {
          id: data.order.id,
          status: newStatus,
          trackingNumber:
            newStatus === "SHIPPED" ? trackingInput : undefined,
        },
      });
      setData((prev) => ({
        ...prev,
        order: { ...prev.order, status: newStatus },
      }));
      setStatusFlash(true);
      setTimeout(() => setStatusFlash(false), 1800);
      toast.success(`Order marked as ${newStatus.toLowerCase()}`);
      await router.invalidate();
    } catch (err) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        (err instanceof Error ? err.message : null) ??
        "Failed to update status";
      toast.error(msg, { duration: 8000 });
    } finally {
      setSavingStatus(null);
    }
  }

  async function handleNoteSave() {
    try {
      await saveAdminNote({ data: { id: data.order.id, note } });
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    }
  }

  function fmt(n: number) {
    return `${n.toFixed(2)} L`;
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("en-GB");
  }

  const addr = data.order.shippingAddress;

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">
          Order #{data.order.id.slice(0, 8)}
        </h1>
        <span
          key={data.order.status}
          className={`rounded px-2 py-1 font-mono text-xs uppercase tracking-widest transition-all duration-300 ${STATUS_COLORS[data.order.status] ?? ""} ${statusFlash ? "scale-110 ring-2 ring-white/30" : "scale-100"}`}
          style={statusFlash ? { animation: "status-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both" } : undefined}
        >
          {data.order.status}
        </span>
        <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
          {fmtDate(data.order.createdAt)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Items
            </p>
            <div className="space-y-3">
              {data.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0"
                >
                  {item.snapshot.imageUrl && (
                    <img
                      src={item.snapshot.imageUrl}
                      alt={item.snapshot.name}
                      className="h-14 w-10 rounded object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-[var(--color-foreground)]">
                      {item.snapshot.name ?? "Unknown product"}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">
                      {item.size} · {item.colour} · qty {item.quantity}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-[var(--color-foreground)]">
                    {fmt(item.unitPrice * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 border-t border-[var(--color-border)] pt-4">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[var(--color-muted-foreground)]">Subtotal</span>
                <span>{fmt(data.order.subtotal)}</span>
              </div>
              <div className="flex justify-between font-mono text-xs">
                <span className="text-[var(--color-muted-foreground)]">Shipping</span>
                <span>{data.order.shippingFee === 0 ? "Free" : fmt(data.order.shippingFee)}</span>
              </div>
              {data.order.paymentFee > 0 && (
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[var(--color-muted-foreground)]">Payment fee</span>
                  <span>{fmt(data.order.paymentFee)}</span>
                </div>
              )}
              {data.order.discountCode && (
                <div className="flex justify-between font-mono text-xs text-green-400">
                  <span>Discount <span className="ml-1 rounded bg-green-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">{data.order.discountCode}</span></span>
                  <span>−{fmt(data.order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-mono text-sm font-medium">
                <span>Total</span>
                <span className="text-[var(--color-clay)]">{fmt(data.order.total)}</span>
              </div>
            </div>
          </div>

          {/* Status actions */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Update Status
            </p>
            {transitions.length === 0 ? (
              <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
                No further transitions available
              </p>
            ) : (
              <div className="space-y-3">
                {data.order.status === "CONFIRMED" && (
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                      Tracking Number
                    </label>
                    <input
                      type="text"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]"
                      placeholder="e.g. 1Z999AA10123456784"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {transitions.map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      disabled={savingStatus !== null}
                      className="rounded border border-[var(--color-border)] px-4 py-2 font-mono text-xs uppercase tracking-widest text-[var(--color-foreground)] transition-colors hover:border-[var(--color-clay)] hover:text-[var(--color-clay)] disabled:opacity-50"
                    >
                      {savingStatus === status ? "…" : status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Admin note */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Admin Note
            </p>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={handleNoteSave}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-clay)]"
              placeholder="Internal note (auto-saves on blur)"
            />
          </div>

          {/* Audit history */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              History
            </p>
            {data.history.length === 0 ? (
              <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
                No history
              </p>
            ) : (
              <ul className="space-y-2">
                {data.history.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <div>
                      <span className="font-mono text-xs text-[var(--color-foreground)]">
                        {h.action}
                      </span>
                      {h.adminName && (
                        <span className="ml-2 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                          by {h.adminName}
                        </span>
                      )}
                    </div>
                    <span className="whitespace-nowrap font-mono text-[10px] text-[var(--color-muted-foreground)]">
                      {fmtDate(h.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Customer
            </p>
            <p className="text-sm text-[var(--color-foreground)]">
              {data.customer.name}
            </p>
            <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
              {data.customer.email}
            </p>
          </div>

          {/* Shipping address */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Shipping Address
            </p>
            <address className="not-italic">
              <p className="text-sm text-[var(--color-foreground)]">
                {addr.firstName} {addr.lastName}
              </p>
              <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
                {addr.line1}
                {addr.line2 && `, ${addr.line2}`}
              </p>
              <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
                {addr.postalCode} {addr.city}
              </p>
              <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
                {addr.country}
              </p>
            </address>
          </div>

          {/* Tracking */}
          {data.order.trackingNumber && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-5">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
                Tracking
              </p>
              <p className="font-mono text-xs text-[var(--color-clay)]">
                {data.order.trackingNumber}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
