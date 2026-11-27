import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/db/schema/enums";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";
import { assertCanChangeRole } from "@/lib/permissions";

const publicColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

export class UserService {
  /** Returns the user on valid credentials, otherwise null. Constant-ish time for unknown emails. */
  static async authenticate(email: string, password: string): Promise<SessionUser | null> {
    const [user] = await db
      .select({ ...publicColumns, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
      .limit(1);

    if (!user) {
      await verifyPassword(password, await getDummyHash());
      return null;
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok || !user.isActive) return null;

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  static list() {
    return db.select(publicColumns).from(users).orderBy(asc(users.role), asc(users.name));
  }

  static async changeRole(actor: SessionUser, targetId: string, role: UserRole) {
    assertCanChangeRole(actor, targetId);
    const [updated] = await db.update(users).set({ role }).where(eq(users.id, targetId)).returning(publicColumns);
    if (!updated) throw ApiError.notFound("User not found");
    return updated;
  }

  static async countByRole(): Promise<Record<UserRole, number>> {
    const rows = await db.select({ role: users.role, n: sql<number>`count(*)::int` }).from(users).groupBy(users.role);
    const out: Record<UserRole, number> = { ADMIN: 0, EXAMINER: 0, CANDIDATE: 0 };
    for (const r of rows) out[r.role] = r.n;
    return out;
  }
}
