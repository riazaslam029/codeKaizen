import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/batch";
import { users } from "@/db/schema";
import type { UserRole } from "@/db/schema/enums";
import type { SessionUser } from "@/lib/auth/dal";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { ApiError } from "@/lib/http";
import { assertCanChangeRole } from "@/lib/permissions";
import { audit } from "@/services/audit";

const publicColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  isActive: users.isActive,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

export type PublicUser = Awaited<ReturnType<typeof UserService.list>>[number];

export class UserService {
  /** Returns the user on valid credentials, otherwise null. Similar timing for unknown emails. */
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
    await audit(user.id, "auth.login", `${user.name} signed in`, { type: "user", id: user.id });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  static list(role?: UserRole) {
    return db
      .select(publicColumns)
      .from(users)
      .where(role ? eq(users.role, role) : undefined)
      .orderBy(asc(users.role), asc(users.name));
  }

  static async create(actor: SessionUser, input: { name: string; email: string; role: UserRole; password: string }) {
    if (actor.role !== "ADMIN" && input.role !== "CANDIDATE") throw ApiError.forbidden("Only administrators can create staff accounts");
    await this.assertEmailFree(input.email);
    try {
      const [created] = await db
        .insert(users)
        .values({ name: input.name, email: input.email, role: input.role, passwordHash: await hashPassword(input.password) })
        .returning(publicColumns);
      await audit(actor.id, "user.create", `${actor.name} created ${input.role.toLowerCase()} ${input.name}`, { type: "user", id: created!.id });
      return created!;
    } catch (err) {
      if (isUniqueViolation(err)) throw ApiError.conflict("An account with this email already exists");
      throw err;
    }
  }

  static async update(actor: SessionUser, id: string, input: { name: string; email: string; password?: string }) {
    if (actor.role !== "ADMIN") throw ApiError.forbidden();
    await this.assertEmailFree(input.email, id);
    const patch: Partial<typeof users.$inferInsert> = { name: input.name, email: input.email };
    if (input.password) patch.passwordHash = await hashPassword(input.password);
    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning(publicColumns);
    if (!updated) throw ApiError.notFound("User not found");
    await audit(actor.id, "user.update", `${actor.name} updated ${updated.name}${input.password ? " (password reset)" : ""}`, { type: "user", id });
    return updated;
  }

  static async changeRole(actor: SessionUser, targetId: string, role: UserRole) {
    assertCanChangeRole(actor, targetId);
    const [updated] = await db.update(users).set({ role }).where(eq(users.id, targetId)).returning(publicColumns);
    if (!updated) throw ApiError.notFound("User not found");
    await audit(actor.id, "user.role", `${actor.name} set ${updated.name}'s role to ${role.toLowerCase()}`, { type: "user", id: targetId });
    return updated;
  }

  /** Deactivated users cannot sign in, and existing sessions stop working on the next request (DAL checks isActive). */
  static async setActive(actor: SessionUser, targetId: string, isActive: boolean) {
    if (actor.role !== "ADMIN") throw ApiError.forbidden();
    if (actor.id === targetId) throw ApiError.forbidden("You cannot deactivate your own account");
    const [updated] = await db.update(users).set({ isActive }).where(eq(users.id, targetId)).returning(publicColumns);
    if (!updated) throw ApiError.notFound("User not found");
    await audit(actor.id, isActive ? "user.activate" : "user.deactivate", `${actor.name} ${isActive ? "activated" : "deactivated"} ${updated.name}`, { type: "user", id: targetId });
    return updated;
  }

  static async countByRole(): Promise<Record<UserRole, number>> {
    const rows = await db.select({ role: users.role, n: sql<number>`count(*)::int` }).from(users).groupBy(users.role);
    const out: Record<UserRole, number> = { ADMIN: 0, EXAMINER: 0, CANDIDATE: 0 };
    for (const r of rows) out[r.role] = r.n;
    return out;
  }

  private static async assertEmailFree(email: string, exceptId?: string) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(sql`lower(${users.email})`, email.toLowerCase()), exceptId ? ne(users.id, exceptId) : undefined))
      .limit(1);
    if (existing) throw ApiError.conflict("An account with this email already exists");
  }
}
