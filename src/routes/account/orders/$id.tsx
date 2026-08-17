import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/db";
import { orders, orderItem } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Price, useRate } from "@/components/Price";
import { useCurrency } from "@/store/currencyStore";
import { formatMoney } from "@/lib/currency";

interface ProductSnapshot {
  name?: string;
  image?: string;
  price?: number;
  originalPrice?: number | null;
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

const getOrderDetail = createServerFn({ method: "GET" })
  .validator((d: unknown) => ({ id: (d as { id: string }).id }))
  .handler(async ({ data }) => {
    const session = await requireAuth();

    const orderRows = await db()
      .select()
      .from(orders)
      .where(eq(orders.id, data.id))
      .limit(1);

    const order = orderRows[0];
    if (!order || order.userId !== session.user.id) throw new Error("Order not found");

    const items = await db()
      .select()
      .from(orderItem)
      .where(eq(orderItem.orderId, data.id));

    let discountCode: string | null = null;
    let discountAmount = 0;
    let paymentFee = 0;
    let giftCardCode: string | null = null;
    let giftCardAmountLek = 0;
    try {
      const dr = await db()
        .select({
          discountCode: orders.discountCode,
          discountAmount: orders.discountAmount,
          paymentFee: orders.paymentFee,
          giftCardCode: orders.giftCardCode,
          giftCardAmountLek: orders.giftCardAmountLek,
        })
        .from(orders)
        .where(eq(orders.id, data.id))
        .limit(1);
      discountCode = dr[0]?.discountCode ?? null;
      discountAmount = Number(dr[0]?.discountAmount ?? 0);
      paymentFee = Number(dr[0]?.paymentFee ?? 0);
      giftCardCode = dr[0]?.giftCardCode ?? null;
      giftCardAmountLek = Number(dr[0]?.giftCardAmountLek ?? 0);
    } catch { /* column not yet migrated */ }

    return {
      id: order.id,
      status: order.status,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      paymentFee,
      total: Number(order.total),
      discountCode,
      discountAmount,
      giftCardCode,
      giftCardAmountLek,
      shippingAddress: order.shippingAddress as ShippingAddress,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt.toISOString(),
      items: items.map((i) => ({
        id: i.id,
        snapshot: i.productSnapshot as ProductSnapshot,
        size: i.size,
        colour: i.colour,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
    };
  });

export const Route = createFileRoute("/account/orders/$id")({
  loader: ({ params }) => getOrderDetail({ data: { id: params.id } }),
  component: OrderDetailPage,
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

function OrderDetailPage() {
  const order = Route.useLoaderData();
  const addr = order.shippingAddress;
  const currency = useCurrency();
  const rate = useRate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border pt-20 pb-10 md:pt-28 md:pb-14">
        <div className="mx-auto max-w-[1600px] px-5 md:px-12">
          <Link
            to="/account/orders"
            className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M9 2 4 7l5 5" />
            </svg>
            Orders
          </Link>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Order</p>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <h1 className="serif text-5xl leading-tight text-ink md:text-7xl">
              {order.id.slice(0, 8).toUpperCase()}
            </h1>
            <span className={`mb-1 font-mono text-[11px] uppercase tracking-widest ${STATUS_COLOR[order.status] ?? "text-ink"}`}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground/60">
            Placed on {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-12 md:px-12 md:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">

          {/* Items */}
          <div>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Items</p>
            <ul className="divide-y divide-border border-y border-border">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-5 py-6">
                  <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden bg-muted">
                    {item.snapshot.image && (
                      <img src={item.snapshot.image} alt={item.snapshot.name ?? ""} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="serif text-[16px] text-ink">{item.snapshot.name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                        {item.size} · {item.colour}
                      </p>
                    </div>
                    <div className="flex items-end justify-between">
                      <p className="font-mono text-[10px] text-muted-foreground/60">Qty {item.quantity}</p>
                      <div className="text-right">
                        {item.snapshot.originalPrice && (
                          <p className="font-mono text-[10px] text-muted-foreground line-through">
                            <Price value={item.snapshot.originalPrice} />
                          </p>
                        )}
                        <p className={`font-mono text-[13px] ${item.snapshot.originalPrice ? "text-clay" : "text-ink"}`}>
                          <Price value={item.unitPrice * item.quantity} />
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Price breakdown */}
            <div className="mt-6 space-y-3 border-b border-border pb-6">
              <div className="flex justify-between font-mono text-[11px] text-ink/60">
                <span>Subtotal</span><Price value={order.subtotal} />
              </div>
              <div className="flex justify-between font-mono text-[11px] text-ink/60">
                <span>Shipping</span>
                <span>{formatMoney(order.shippingFee, currency, rate)}</span>
              </div>
              {order.paymentFee > 0 && (
                <div className="flex justify-between font-mono text-[11px] text-ink/60">
                  <span>Payment fee</span>
                  <span>{formatMoney(order.paymentFee, currency, rate)}</span>
                </div>
              )}
              {order.discountCode && (
                <div className="flex justify-between font-mono text-[11px] text-green-400">
                  <span>Discount <span className="ml-1.5 font-mono text-[10px] tracking-widest">{order.discountCode}</span></span>
                  <span>−{formatMoney(order.discountAmount, currency, rate)}</span>
                </div>
              )}
              {order.giftCardCode && order.giftCardAmountLek > 0 && (
                <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                  <span>Gift card <span className="ml-1.5 font-mono text-[10px] tracking-widest">{order.giftCardCode}</span></span>
                  <span>−ALL {new Intl.NumberFormat("sq-AL").format(Math.round(order.giftCardAmountLek))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total</span>
                <Price value={order.total} className="serif text-xl text-ink" />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Shipping address */}
            <div>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Ship to</p>
              <div className="border border-border p-5 space-y-1">
                <p className="font-mono text-[12px] text-ink">{addr.firstName} {addr.lastName}</p>
                <p className="font-mono text-[11px] text-ink/70">{addr.line1}</p>
                {addr.line2 && <p className="font-mono text-[11px] text-ink/70">{addr.line2}</p>}
                <p className="font-mono text-[11px] text-ink/70">{addr.postalCode} {addr.city}</p>
                <p className="font-mono text-[11px] text-ink/70">{addr.country}</p>
                {addr.phone && <p className="mt-2 font-mono text-[11px] text-muted-foreground/60">{addr.phone}</p>}
              </div>
            </div>

            {/* Tracking */}
            {order.trackingNumber && (
              <div>
                <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tracking</p>
                <div className="border border-border p-5">
                  <p className="font-mono text-[12px] text-ink">{order.trackingNumber}</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
