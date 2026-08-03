import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/order-confirmed")({
  component: OrderConfirmedPage,
});

function OrderConfirmedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-5 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border">
        <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-ink">
          <polyline points="1 8 7 14 21 1" />
        </svg>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Order confirmed</p>
        <h1 className="serif mt-3 text-4xl text-ink md:text-5xl">Thank you.</h1>
      </div>
      <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        A confirmation email is on its way to you. Your order will be dispatched within 2 working days.
      </p>
      <div className="flex flex-col items-center gap-4">
        <Link
          to="/account/orders"
          className="bg-ink px-8 py-3 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90"
        >
          View my orders
        </Link>
        <Link
          to="/"
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-ink"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
