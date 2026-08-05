import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { orders, orderItem } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

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

  // Fetch discount fields separately — survives before migration
  const discountMap = new Map<string, { code: string | null; amount: number }>();
  try {
    const dr = await db()
      .select({ id: orders.id, discountCode: orders.discountCode, discountAmount: orders.discountAmount })
      .from(orders)
      .where(eq(orders.userId, session.user.id));
    for (const r of dr) discountMap.set(r.id, { code: r.discountCode ?? null, amount: Number(r.discountAmount ?? 0) });
  } catch { /* column not yet migrated */ }

  return rows.map((r) => ({
    ...r,
    discountCode: discountMap.get(r.id)?.code ?? null,
    discountAmount: discountMap.get(r.id)?.amount ?? 0,
  }));
});

export const Route = createFileRoute("/account/orders")({
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

function OrdersPage() {
  const rows = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border pt-24 pb-10 md:pt-32 md:pb-14">
        <div className="mx-auto max-w-[1600px] px-5 md:px-12">
          <button
            onClick={() => window.history.back()}
            className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-ink"
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
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              No orders yet
            </p>
            <Link
              to="/shop/"
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground underline underline-offset-4 transition hover:text-ink"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((order) => {
              const addr = order.shippingAddress as Record<string, string>;
              return (
                <div key={order.id} className="border border-border p-5 md:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Order ref
                      </p>
                      <p className="serif mt-1 text-xl text-ink">{order.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-[10px] uppercase tracking-widest ${STATUS_COLOR[order.status] ?? "text-ink"}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </p>
                      <p className="serif mt-1 text-xl text-ink">€{order.total.toFixed(0)}</p>
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
                          {order.discountCode} — −€{Number(order.discountAmount ?? 0).toFixed(0)}
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
