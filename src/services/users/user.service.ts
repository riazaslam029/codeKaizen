import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/batch";
import { attempts, incidents, users } from "@/db/schema";
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

export type AuthResult =
  | { status: "ok"; user: SessionUser; sessionVersion: number }
  | { status: "invalid" }
  | { status: "restricted" };

export class UserService {
  /**
   * Password is verified FIRST. Only a correct password reveals that an account is restricted, so
   * restricted accounts cannot be discovered by guessing emails. Unknown emails take similar time.
   */
  static async authenticate(email: string, password: string): Promise<AuthResult> {
    const [user] = await db
      .select({ ...publicColumns, passwordHash: users.passwordHash, sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
      .limit(1);

    if (!user) {
      await verifyPassword(password, await getDummyHash());
      return { status: "invalid" };
    }
    if (!(await verifyPassword(password, user.passwordHash))) return { status: "invalid" };
    if (!user.isActive) {
      await audit(user.id, "auth.blocked", `${user.name} tried to sign in while restricted`, { type: "user", id: user.id });
      return { status: "restricted" };
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    await audit(user.id, "auth.login", `${user.name} signed in`, { type: "user", id: user.id });
    return { status: "ok", user: { id: user.id, email: user.email, name: user.name, role: user.role }, sessionVersion: user.sessionVersion };
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
    const patch: PgUpdateSetSource<typeof users> = { name: input.name, email: input.email };
    if (input.password) {
      patch.passwordHash = await hashPassword(input.password);
      patch.sessionVersion = sql`${users.sessionVersion} + 1`; // a password reset signs out other sessions
    }
    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning(publicColumns);
    if (!updated) throw ApiError.notFound("User not found");
    await audit(actor.id, "user.update", `${actor.name} updated ${updated.name}${input.password ? " (password reset)" : ""}`, { type: "user", id });
    return updated;
  }

  /** Role change: admins only, never self, never the last active admin. Signs the user out everywhere. */
  static async changeRole(actor: SessionUser, targetId: string, role: UserRole) {
    assertCanChangeRole(actor, targetId);
    const target = await this.get(targetId);
    if (target.role === "ADMIN" && role !== "ADMIN") await this.assertNotLastAdmin(targetId);
    const [updated] = await db
      .update(users)
      .set({ role, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, targetId))
      .returning(publicColumns);
    await audit(actor.id, "user.role", `${actor.name} set ${updated!.name}'s role to ${role.toLowerCase()}`, { type: "user", id: targetId });
    return updated!;
  }

  /**
   * Restrict / restore access.
   * - Restricting bumps session_version, so every open session fails on its next request.
   * - In-progress attempts are preserved untouched; the server timer keeps running (no time is ever added).
   *   An ACCESS_RESTRICTED / ACCESS_RESTORED event is written to each open attempt's timeline for examiners.
   * - Admins cannot restrict themselves or the last active administrator.
   */
  static async setActive(actor: SessionUser, targetId: string, isActive: boolean) {
    if (actor.role !== "ADMIN") throw ApiError.forbidden();
    if (actor.id === targetId) throw ApiError.forbidden("You cannot restrict your own account");
    const target = await this.get(targetId);
    if (!isActive && target.role === "ADMIN") await this.assertNotLastAdmin(targetId);

    const [updated] = await db
      .update(users)
      .set(isActive ? { isActive } : { isActive, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, targetId))
      .returning(publicColumns);

    const open = await db
      .select({ id: attempts.id, examId: attempts.examId })
      .from(attempts)
      .where(and(eq(attempts.candidateId, targetId), eq(attempts.status, "IN_PROGRESS"), eq(attempts.isSandbox, false)));
    if (open.length) {
      await db.insert(incidents).values(
        open.map((a) => ({
          attemptId: a.id,
          examId: a.examId,
          candidateId: targetId,
          type: isActive ? ("ACCESS_RESTORED" as const) : ("ACCESS_RESTRICTED" as const),
          severity: "LOW" as const,
          details: { by: actor.name, note: isActive ? "Access restored by an administrator. Deadline unchanged." : "Access restricted by an administrator. Saved answers preserved; timer keeps running." },
        })),
      );
    }
    await audit(
      actor.id,
      isActive ? "user.unrestrict" : "user.restrict",
      `${actor.name} ${isActive ? "restored access for" : "restricted"} ${updated!.name}${open.length ? ` (${open.length} attempt(s) in progress)` : ""}`,
      { type: "user", id: targetId },
    );
    return updated!;
  }

  static async countByRole(): Promise<Record<UserRole, number>> {
    const rows = await db.select({ role: users.role, n: sql<number>`count(*)::int` }).from(users).groupBy(users.role);
    const out: Record<UserRole, number> = { ADMIN: 0, EXAMINER: 0, CANDIDATE: 0 };
    for (const r of rows) out[r.role] = r.n;
    return out;
  }

  private static async get(id: string) {
    const [u] = await db.select({ id: users.id, role: users.role, name: users.name }).from(users).where(eq(users.id, id)).limit(1);
    if (!u) throw ApiError.notFound("User not found");
    return u;
  }

  private static async assertNotLastAdmin(exceptId: string) {
    const [others] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true), ne(users.id, exceptId)));
    if ((others?.n ?? 0) === 0) throw ApiError.conflict("At least one active administrator must remain");
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
