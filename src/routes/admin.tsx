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
import { z } from "zod";

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

// Fetch events from DB newer than a given ISO timestamp.
// Must be POST — CF edge caches GET responses, making polls return stale data.
const pollAdminEvents = createServerFn({ method: "POST" })
  .validator(z.object({ since: z.string() }))
  .handler(async ({ data }) => {
    const token = getCookie("admin_token");
    if (!token) return [];
    const [session] = await db()
      .select({ id: adminSession.id })
      .from(adminSession)
      .where(and(eq(adminSession.token, token), gt(adminSession.expiresAt, new Date())))
      .limit(1);
    if (!session) return [];
    const since = new Date(data.since);
    if (isNaN(since.getTime())) return [];
    const events = await db()
      .select()
      .from(adminEvent)
      .where(gt(adminEvent.createdAt, since))
      .orderBy(adminEvent.createdAt);
    return events.map((e) => ({ id: e.id, type: e.type, payload: e.payload as Record<string, unknown> }));
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
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "manifest", href: "/manifest.json" }],
  }),
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
  // Start 60 s in the past — absorbs browser/DB clock skew and catches events
  // that arrived while the page was loading.
  const lastSeenRef = useRef(new Date(Date.now() - 60_000).toISOString());
  // Track delivered event IDs so the 2-second overlap doesn't show duplicate toasts.
  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {/* sw registration is best-effort */});
    }
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      (window as any).__installPrompt = e;
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const events = await pollAdminEvents({ data: { since: lastSeenRef.current } });
        // Subtract 2 s from "now" so the next poll overlaps slightly and never
        // misses an event inserted between the query and the timestamp update.
        lastSeenRef.current = new Date(Date.now() - 2000).toISOString();

        const freshEvents = events.filter((ev) => !seenIdsRef.current.has(ev.id));
        freshEvents.forEach((ev) => seenIdsRef.current.add(ev.id));

        if (freshEvents.length === 0) return;

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

        for (const ev of freshEvents) {
          const p = ev.payload;
          if (ev.type === "new_order") {
            toast.success(`New order #${p.ref} · ${Number(p.total).toFixed(0)} €`, { duration: 6000 });
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
