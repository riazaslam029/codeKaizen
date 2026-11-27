import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/** Records platform activity for the admin activity feed. Never throws (auditing must not break the action). */
export async function audit(
  actorId: string | null,
  action: string,
  summary: string,
  entity?: { type: string; id: string },
): Promise<void> {
  try {
    await db.insert(auditLogs).values({ actorId, action, summary, entityType: entity?.type, entityId: entity?.id });
  } catch (err) {
    console.error("[audit] failed", err);
  }
}
