import "server-only";
import { createDb, type DB } from "./client";

let instance: DB | undefined;

/**
 * Lazily-created database client. Connecting on first use (not at import time)
 * lets `next build` succeed in environments where DATABASE_URL is injected only at runtime.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    instance ??= createDb();
    return Reflect.get(instance, prop, instance);
  },
});

export type { DB };
