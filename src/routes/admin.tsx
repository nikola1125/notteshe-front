import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core/request-response";
import { getAdminUserFn, logoutAdminFn } from "@/lib/admin/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { AdminUser } from "@/db/schema";
import { Toaster, toast } from "sonner";
import { db } from "@/db";
import { orders, cancellationRequest, adminEvent } from "@/db/schema";
import { eq, count, gt, and } from "drizzle-orm";
import { adminSession } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";

const getAdminCounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
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

// Fetch events from DB newer than a given ISO timestamp
const pollAdminEvents = createServerFn({ method: "GET" })
  .validator((input: unknown) => ({ since: (input as { since: string }).since }))
  .handler(async ({ data }) => {
    const token = getCookie("admin_token");
    if (!token) return [];
    const [session] = await db()
      .select({ id: adminSession.id })
      .from(adminSession)
      .where(and(eq(adminSession.token, token), gt(adminSession.expiresAt, new Date())))
      .limit(1);
    if (!session) return [];
    const events = await db()
      .select()
      .from(adminEvent)
      .where(gt(adminEvent.createdAt, new Date(data.since)))
      .orderBy(adminEvent.createdAt);
    console.log(`[poll] found ${events.length} events since ${data.since}`);
    return events.map((e) => ({ type: e.type, payload: e.payload as Record<string, unknown> }));
  });

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
    if (!admin) throw redirect({ to: "/admin-login" });
    return { admin };
  },
  loader: () => getAdminCounts(),
  component: AdminLayout,
});

function AdminLayout() {
  const { admin } = Route.useRouteContext() as { admin: AdminUser };
  const { newOrders, pendingCancellations } = Route.useLoaderData();
  const router = useRouter();
  const lastSeenRef = useRef(new Date().toISOString());

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const events = await pollAdminEvents({ data: { since: lastSeenRef.current } });
        lastSeenRef.current = new Date().toISOString();

        if (events.length === 0) return;

        // Refresh sidebar counts + current page data
        router.invalidate();

        // Play a short chime using Web Audio API (no audio file required)
        try {
          const ctx = new AudioContext();
          const frequencies = [880, 1108, 1320];
          frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
            gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
            osc.start(ctx.currentTime + i * 0.12);
            osc.stop(ctx.currentTime + i * 0.12 + 0.4);
          });
        } catch (_) { /* audio not available */ }

        for (const ev of events) {
          const p = ev.payload;
          if (ev.type === "new_order") {
            toast.success(`New order #${p.ref} · ${Number(p.total).toFixed(0)} L`, { duration: 6000 });
          } else if (ev.type === "new_cancellation") {
            toast.warning(`Cancellation request from ${p.name} · Order #${p.orderRef}`, { duration: 8000 });
          } else if (ev.type === "new_message") {
            toast.info(`New message from ${p.name}`, { duration: 6000 });
          }
        }
      } catch (err) {
        console.error("[poll] error:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
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
