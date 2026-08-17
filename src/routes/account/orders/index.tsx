import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { orders, cancellationRequest } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { Price, useRate } from "@/components/Price";
import { useCurrency } from "@/store/currencyStore";
import { formatMoney } from "@/lib/currency";

const getMyOrders = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAuth();
  const rows = await db()
    .select({
      id: orders.id,
      status: orders.status,
      subtotal: orders.subtotal,
      shippingFee: orders.shippingFee,
      total: orders.total,
      shippingAddress: orders.shippingAddress,
      trackingNumber: orders.trackingNumber,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.createdAt));

  const discountMap = new Map<string, { code: string | null; amount: number }>();
  try {
    const dr = await db()
      .select({ id: orders.id, discountCode: orders.discountCode, discountAmount: orders.discountAmount })
      .from(orders)
      .where(eq(orders.userId, session.user.id));
    for (const r of dr) discountMap.set(r.id, { code: r.discountCode ?? null, amount: Number(r.discountAmount ?? 0) });
  } catch { /* column not yet migrated */ }

  // Fetch existing cancellation requests for this user's orders
  const orderIds = rows.map((r) => r.id);
  const cancelledSet = new Set<string>();
  if (orderIds.length > 0) {
    try {
      const reqs = await db()
        .select({ orderId: cancellationRequest.orderId })
        .from(cancellationRequest)
        .where(eq(cancellationRequest.userId, session.user.id));
      for (const r of reqs) cancelledSet.add(r.orderId);
    } catch { /* table not yet migrated */ }
  }

  return rows.map((r) => ({
    ...r,
    discountCode: discountMap.get(r.id)?.code ?? null,
    discountAmount: discountMap.get(r.id)?.amount ?? 0,
    cancellationRequested: cancelledSet.has(r.id),
  }));
});

const requestCancellation = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.string(), message: z.string().max(1000).optional() }))
  .handler(async ({ data }) => {
    const session = await requireAuth();

    // Ownership check (IDOR fix): the order must belong to this user. Without
    // this, anyone could file cancellation requests against arbitrary order IDs.
    const [order] = await db()
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, data.orderId), eq(orders.userId, session.user.id)))
      .limit(1);
    if (!order) throw new Error("Order not found.");

    // Rate limit so the admin cancellation queue can't be spammed.
    const { rateLimit } = await import("@/lib/rateLimit");
    if (!rateLimit(`cancel:user:${session.user.id}`, 5, 60_000)) {
      throw new Error("Too many cancellation requests. Please wait a moment and try again.");
    }

    const userName = session.user.name ?? session.user.email;
    await db().insert(cancellationRequest).values({
      id: nanoid(),
      orderId: data.orderId,
      userId: session.user.id,
      userName,
      userEmail: session.user.email,
      message: data.message || null,
    });
    const { notifyAdmins } = await import("@/lib/admin/sse");
    await notifyAdmins("new_cancellation", { name: userName, orderRef: data.orderId.slice(0, 8).toUpperCase() });
    return { ok: true };
  });

export const Route = createFileRoute("/account/orders/")({
  component: OrdersPage,
  loader: () => getMyOrders(),
});

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-muted-foreground",
  CONFIRMED: "text-ink",
  SHIPPED: "text-ink",
  DELIVERED: "text-ink",
  CANCELLED: "text-clay",
  REFUNDED: "text-clay",
};

const CANCELLABLE = new Set(["PENDING", "CONFIRMED"]);

function CancellationModal({
  orderId,
  onClose,
  onSuccess,
}: {
  orderId: string;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestCancellation({ data: { orderId, message: message.trim() || undefined } });
      onSuccess(orderId);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md border border-border bg-background p-7">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Request cancellation
        </p>
        <p className="serif mt-2 text-xl text-ink">
          Order #{orderId.slice(0, 8).toUpperCase()}
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="cancel-message"
              className="mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              Reason <span className="text-muted-foreground/40">(optional)</span>
            </label>
            <textarea
              id="cancel-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Let us know why you'd like to cancel this order…"
              rows={4}
              className="w-full resize-none border border-border bg-transparent px-4 py-3 font-mono text-[12px] text-ink placeholder:text-muted-foreground/40 focus:border-ink/50 focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 border border-clay bg-clay/10 py-2.5 font-mono text-[10px] uppercase tracking-widest text-clay transition-colors hover:bg-clay/20 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send request"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-border py-2.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrdersPage() {
  const rows = Route.useLoaderData();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => new Set((rows as any[]).filter((r) => r.cancellationRequested).map((r) => r.id))
  );
  const [modalOrderId, setModalOrderId] = useState<string | null>(null);
  const currency = useCurrency();
  const rate = useRate();

  function copyRef(e: React.MouseEvent, orderId: string) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(orderId.slice(0, 8).toUpperCase());
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function openCancelModal(e: React.MouseEvent, orderId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (requestedIds.has(orderId)) return;
    setModalOrderId(orderId);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {modalOrderId && (
        <CancellationModal
          orderId={modalOrderId}
          onClose={() => setModalOrderId(null)}
          onSuccess={(id) => setRequestedIds((prev) => new Set([...prev, id]))}
        />
      )}
      <div className="border-b border-border pt-20 pb-10 md:pt-28 md:pb-14">
        <div className="mx-auto max-w-[1600px] px-5 md:px-12">
          <button
            onClick={() => window.history.back()}
            className="mb-5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-clay"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M9 2 4 7l5 5" />
            </svg>
            Back
          </button>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your account</p>
          <h1 className="serif mt-3 text-5xl leading-tight text-ink md:text-7xl">Orders.</h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-12 md:px-12 md:py-16">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-24 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">No orders yet</p>
            <Link to="/shop" search={{ sale: undefined }} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground underline underline-offset-4 transition hover:text-ink">
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(rows as any[]).map((order) => {
              const addr = order.shippingAddress as Record<string, string>;
              const canCancel = CANCELLABLE.has(order.status);
              const alreadyRequested = requestedIds.has(order.id);
              return (
                <Link key={order.id} to="/account/orders/$id" params={{ id: order.id }} className="group block border border-border p-5 md:p-7 transition-colors hover:border-ink/30">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Order ref</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="serif text-xl text-ink">{order.id.slice(0, 8).toUpperCase()}</p>
                        <button
                          onClick={(e) => copyRef(e, order.id)}
                          className="flex items-center justify-center text-muted-foreground/50 transition-colors hover:text-ink active:scale-90"
                          aria-label="Copy order reference"
                        >
                          {copiedId === order.id ? (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 7l3 3 6-6" />
                            </svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-[10px] uppercase tracking-widest ${STATUS_COLOR[order.status] ?? "text-ink"}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </p>
                      <Price value={order.total} className="serif mt-1 text-xl text-ink" />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">Date</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink/70">
                        {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">Ship to</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink/70">
                        {addr.firstName} {addr.lastName}, {addr.city}
                      </p>
                    </div>
                    {order.discountCode && (
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">Discount</p>
                        <p className="mt-0.5 font-mono text-[11px] text-green-400">
                          {order.discountCode} — −{formatMoney(Number(order.discountAmount ?? 0), currency, rate)}
                        </p>
                      </div>
                    )}
                    {order.trackingNumber && (
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">Tracking</p>
                        <p className="mt-0.5 font-mono text-[11px] text-ink/70">{order.trackingNumber}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    {canCancel ? (
                      <button
                        onClick={(e) => openCancelModal(e, order.id)}
                        disabled={alreadyRequested}
                        className={`font-mono text-[10px] uppercase tracking-widest transition-colors ${
                          alreadyRequested
                            ? "cursor-default text-muted-foreground/40"
                            : "text-clay/70 hover:text-clay"
                        }`}
                      >
                        {alreadyRequested ? "Cancellation requested" : "Request cancellation"}
                      </button>
                    ) : (
                      <span />
                    )}
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-ink">
                      View order →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
