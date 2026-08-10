import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getAdminUserFn, logoutAdminFn } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { AdminUser } from "@/db/schema";
import { Toaster, toast } from "sonner";
import { db } from "@/db";
import { orders, cancellationRequest } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin/auth";

const getAdminCounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { and } = await import("drizzle-orm");
  const [[newOrders], [pendingCancellations]] = await Promise.all([
    db().select({ count: count() }).from(orders).where(eq(orders.status, "PENDING")),
    db().select({ count: count() }).from(cancellationRequest).where(
      and(eq(cancellationRequest.status, "pending"), eq(cancellationRequest.isRead, false))
    ),
  ]);
  return {
    newOrders: newOrders?.count ?? 0,
    pendingCancellations: pendingCancellations?.count ?? 0,
  };
});

// Client-side cache — avoids a server round-trip on every sidebar navigation.
// Cleared on logout; refreshed at most once per 5 minutes.
let _adminCache: { admin: AdminUser; exp: number } | null = null;

async function getCachedAdmin(): Promise<AdminUser | null> {
  if (_adminCache && _adminCache.exp > Date.now()) return _adminCache.admin;
  const admin = await getAdminUserFn();
  if (admin) _adminCache = { admin, exp: Date.now() + 5 * 60 * 1000 };
  else _adminCache = null;
  return admin;
}

export function clearAdminCache() {
  _adminCache = null;
}

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const admin = await getCachedAdmin();
    if (!admin) {
      throw redirect({ to: "/admin-login" });
    }
    return { admin };
  },
  loader: () => getAdminCounts(),
  component: AdminLayout,
});

function AdminLayout() {
  const { admin } = Route.useRouteContext() as { admin: AdminUser };
  const { newOrders, pendingCancellations } = Route.useLoaderData();
  const router = useRouter();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource("/api/admin-events");
      esRef.current = es;

      es.onmessage = (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { event: string; ref?: string; total?: number; name?: string; orderRef?: string };
        if (data.event === "connected" || data.event === "ping") return;

        router.invalidate();

        if (data.event === "new_order") {
          toast.success(`New order #${data.ref} · ${data.total?.toFixed(0)} L`, { duration: 6000 });
        } else if (data.event === "new_cancellation") {
          toast.warning(`Cancellation request from ${data.name} · Order #${data.orderRef}`, { duration: 8000 });
        } else if (data.event === "new_message") {
          toast.info(`New message from ${data.name}`, { duration: 6000 });
        }
      };

      es.onerror = () => {
        es.close();
        // Reconnect after 5 seconds
        setTimeout(connect, 5000);
      };
    }

    connect();
    return () => {
      esRef.current?.close();
    };
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="flex w-full flex-col lg:flex-row">
        <AdminSidebar
          adminName={admin.name}
          adminRole={admin.role}
          newOrders={newOrders}
          pendingCancellations={pendingCancellations}
        />
        <main className="flex-1 lg:ml-56">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
