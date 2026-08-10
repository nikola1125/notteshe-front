import { createAPIFileRoute } from "@tanstack/react-start/api";
import { addClient, removeClient } from "@/lib/admin/sse";

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
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    let pingInterval: ReturnType<typeof setInterval>;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        ctrl = controller;
        addClient(controller);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: "connected" })}\n\n`));

        // Keep-alive ping every 25 seconds to prevent proxy timeouts
        pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            clearInterval(pingInterval);
          }
        }, 25_000);
      },
      cancel() {
        clearInterval(pingInterval);
        removeClient(ctrl);
      },
    });

    request.signal.addEventListener("abort", () => {
      clearInterval(pingInterval);
      removeClient(ctrl);
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
