import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { DEFAULT_PREFERENCES, type WorkspacePreferences } from "@/db/schema/types";

/** Workspace preferences live in the database so they follow the candidate across devices and sessions. */
export class PreferencesService {
  static async get(userId: string): Promise<WorkspacePreferences> {
    const [row] = await db.select({ p: userPreferences.preferences }).from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
    return { ...DEFAULT_PREFERENCES, ...(row?.p ?? {}) };
  }

  static async set(userId: string, preferences: WorkspacePreferences) {
    await db
      .insert(userPreferences)
      .values({ userId, preferences })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { preferences, updatedAt: new Date() } });
    return preferences;
  }
}
