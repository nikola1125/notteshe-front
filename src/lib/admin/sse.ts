import { nanoid } from "nanoid";

export type AdminEventType = "new_order" | "new_message" | "new_cancellation";

export interface AdminEventPayload {
  new_order: { ref: string; total: number };
  new_message: { name: string };
  new_cancellation: { name: string; orderRef: string };
}

// Write event to DB so ALL serverless instances can see it.
// The SSE endpoint polls the DB and delivers it to the connected admin.
export async function notifyAdmins<T extends AdminEventType>(
  event: T,
  payload: AdminEventPayload[T]
) {
  try {
    const { db } = await import("@/db");
    const { adminEvent } = await import("@/db/schema");
    await db().insert(adminEvent).values({
      id: nanoid(),
      type: event,
      payload: payload as Record<string, unknown>,
    });
  } catch (err) {
    console.error("[sse] notifyAdmins failed:", err);
  }
}
