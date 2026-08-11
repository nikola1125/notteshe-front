import { nanoid } from "nanoid";
import { db } from "@/db";
import { adminEvent } from "@/db/schema";

export type AdminEventType = "new_order" | "new_message" | "new_cancellation";

export interface AdminEventPayload {
  new_order: { ref: string; total: number };
  new_message: { name: string };
  new_cancellation: { name: string; orderRef: string };
}

// Write event to DB so ALL serverless instances can see it.
// On CF Workers unawaited Promises are killed when the response is sent —
// callers MUST await this function.
export async function notifyAdmins<T extends AdminEventType>(
  event: T,
  payload: AdminEventPayload[T]
) {
  try {
    await db().insert(adminEvent).values({
      id: nanoid(),
      type: event,
      payload: payload as Record<string, unknown>,
    });
    console.log(`[sse] event written: ${event}`);
  } catch (err) {
    // This usually means the admin_event table isn't migrated yet.
    // Run: bun db:migrate (or drizzle-kit migrate) against production.
    console.error("[sse] notifyAdmins FAILED — event lost:", event, err);
  }
}
