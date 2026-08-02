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
  return session;
}
