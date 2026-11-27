import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/db/schema/enums";
import { ApiError } from "@/lib/http";
import { readSession } from "./session";
import { homeForRole, RESTRICTED_MESSAGE } from "./token";

/** The only user shape that leaves the data access layer — never includes the password hash. */
export type SessionUser = { id: string; email: string; name: string; role: UserRole };

export type SessionState =
  | { status: "ok"; user: SessionUser }
  | { status: "none" } // no / invalid / expired cookie
  | { status: "revoked" } // token predates a restriction or role change (session_version moved on)
  | { status: "restricted" }; // account restricted by an administrator

/**
 * Verifies the signed cookie AND re-reads the account on EVERY request (deduplicated per request).
 * Authorization uses the DB role, the active flag and the session version — never the token alone —
 * so restricting a user or changing their role takes effect on their very next request.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const session = await readSession();
  if (!session) return { status: "none" };
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, isActive: users.isActive, sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return { status: "none" };
  if (!user.isActive) return { status: "restricted" };
  if (user.sessionVersion !== session.ver) return { status: "revoked" };
  return { status: "ok", user: { id: user.id, email: user.email, name: user.name, role: user.role } };
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  const s = await getSessionState();
  return s.status === "ok" ? s.user : null;
}

/* ── For Server Components / pages: redirect on failure ── */

export async function requireUser(): Promise<SessionUser> {
  const s = await getSessionState();
  if (s.status === "ok") return s.user;
  // The sign-out route clears the cookie (pages cannot) and shows the reason on the login page.
  if (s.status === "restricted") redirect("/api/auth/signout?reason=restricted");
  if (s.status === "revoked") redirect("/api/auth/signout?reason=revoked");
  redirect("/login");
}

export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeForRole(user.role));
  return user;
}

/* ── For Route Handlers / Server Actions: throw 401 / 403 ── */

export async function authorize(...roles: UserRole[]): Promise<SessionUser> {
  const s = await getSessionState();
  if (s.status === "restricted") throw new ApiError(403, "ACCOUNT_RESTRICTED", RESTRICTED_MESSAGE);
  if (s.status === "revoked") throw new ApiError(401, "SESSION_REVOKED", "Your session has ended. Please sign in again.");
  if (s.status !== "ok") throw ApiError.unauthorized();
  if (roles.length > 0 && !roles.includes(s.user.role)) throw ApiError.forbidden();
  return s.user;
}
