import { getRequest } from "@tanstack/start-server-core/request-response";
import { auth } from "./server";

export async function getServerSession() {
  try {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    return session;
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const session = await getServerSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  // Re-check the suspension flag on every privileged action. A blocked user must
  // not be able to keep acting through an existing or cookie-cached session.
  // Intentionally NOT fail-open: if we can't verify, the query throws and the
  // action is denied (the caller can retry) rather than silently skipping.
  const { db } = await import("@/db");
  const { user } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db()
    .select({ blocked: user.blocked })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (row?.blocked) {
    throw new Error("ACCOUNT_SUSPENDED");
  }
  return session;
}
