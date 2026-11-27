import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/db/schema/enums";
import { ApiError } from "@/lib/http";
import { readSession } from "./session";
import { homeForRole } from "./token";

/** The only user shape that leaves the data access layer — never includes the password hash. */
export type SessionUser = { id: string; email: string; name: string; role: UserRole };

/**
 * Verifies the session cookie AND re-loads the user from the database on every request.
 * The role used for authorization comes from the DB, not the token, so a demoted or
 * deactivated user loses access immediately. Deduplicated per request with React `cache`.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSession();
  if (!session) return null;

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || !user.isActive) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
});

/* ── For Server Components / pages: redirect on failure ── */

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeForRole(user.role));
  return user;
}

/* ── For Route Handlers / Server Actions: throw 401 / 403 ── */

export async function authorize(...roles: UserRole[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw ApiError.unauthorized();
  if (roles.length > 0 && !roles.includes(user.role)) throw ApiError.forbidden();
  return user;
}
