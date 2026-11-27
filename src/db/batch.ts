import "server-only";
import type { BatchItem } from "drizzle-orm/batch";
import { db } from "./index";

/**
 * Runs several statements atomically. The Neon HTTP driver executes a batch as ONE
 * transaction: either every statement commits or none do.
 */
export async function runBatch(items: BatchItem<"pg">[]): Promise<void> {
  if (items.length === 0) return;
  await db.batch(items as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}

/** Postgres unique-violation detection (works for the Neon HTTP driver's error shape). */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
