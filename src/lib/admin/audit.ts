import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function logAudit(
  adminId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  diff?: { before?: unknown; after?: unknown }
): Promise<void> {
  try {
    await db()
      .insert(auditLog)
      .values({
        id: randomUUID(),
        adminId,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        diff: diff ?? null,
      });
  } catch (err) {
    // Never let audit failure break the main operation
    console.error("audit log failed", err);
  }
}
