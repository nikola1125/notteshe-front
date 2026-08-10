import { createAPIFileRoute } from "@tanstack/react-start/api";

const POLL_INTERVAL_MS = 3000;
const EVENT_TTL_MS = 60 * 60 * 1000; // clean up events older than 1h

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const entry = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { db } = await import("@/db");
    const { adminSession, adminUser } = await import("@/db/schema");
    const { eq, and, gt } = await import("drizzle-orm");
    const rows = await db()
      .select({ id: adminUser.id })
      .from(adminSession)
      .innerJoin(adminUser, eq(adminSession.adminId, adminUser.id))
      .where(and(eq(adminSession.token, token), gt(adminSession.expiresAt, new Date()), eq(adminUser.isActive, true)))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

export const APIRoute = createAPIFileRoute("/api/admin-events")({
  GET: async ({ request }: { request: Request }) => {
    const token = parseCookie(request.headers.get("cookie"), "admin_token");
    if (!token || !(await verifyAdminToken(token))) {
      return new Response("Unauthorized", { status: 401 });
    }

    const encoder = new TextEncoder();
    // Track the last event time we've delivered to avoid re-sending
    let lastSeen = new Date();

    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    let pollTimer: ReturnType<typeof setInterval>;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        ctrl = controller;

        // Confirm connection
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "connected" })}\n\n`));

        // Poll DB for new events every 3s
        pollTimer = setInterval(async () => {
          try {
            const { db } = await import("@/db");
            const { adminEvent } = await import("@/db/schema");
            const { gt, lt } = await import("drizzle-orm");

            const since = lastSeen;
            lastSeen = new Date();

            const events = await db()
              .select()
              .from(adminEvent)
              .where(gt(adminEvent.createdAt, since))
              .orderBy(adminEvent.createdAt);

            for (const ev of events) {
              const msg = JSON.stringify({ event: ev.type, ...ev.payload });
              controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
            }

            // Cleanup old events (fire-and-forget)
            db().delete(adminEvent)
              .where(lt(adminEvent.createdAt, new Date(Date.now() - EVENT_TTL_MS)))
              .catch(() => {});
          } catch {
            // DB error — keep connection alive, retry next interval
          }
        }, POLL_INTERVAL_MS);

        // Keep-alive ping every 25s to prevent proxy timeouts
        const pingTimer = setInterval(() => {
          try { controller.enqueue(encoder.encode(": ping\n\n")); }
          catch { clearInterval(pingTimer); }
        }, 25_000);
      },
      cancel() {
        clearInterval(pollTimer);
      },
    });

    request.signal.addEventListener("abort", () => {
      clearInterval(pollTimer);
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
});
