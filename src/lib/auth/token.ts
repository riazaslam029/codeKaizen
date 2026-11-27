import { jwtVerify } from "jose";
import type { UserRole } from "@/db/schema/enums";

/** Shared by the server session helpers and proxy.ts (no `server-only` / `next/headers` imports here). */
export const SESSION_COOKIE = "ckz_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours — covers a long exam day

const ROLES: readonly UserRole[] = ["ADMIN", "EXAMINER", "CANDIDATE"];

/** `ver` must equal users.session_version; restricting a user or changing their role bumps it. */
export type SessionPayload = { userId: string; role: UserRole; ver: number; expiresAt: number };

export async function verifySessionToken(token: string | undefined, key: Uint8Array): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: "codekaizen",
      audience: "codekaizen-web",
    });
    const role = payload.role as UserRole;
    if (!payload.sub || !ROLES.includes(role) || !payload.exp) return null;
    const ver = typeof payload.ver === "number" ? payload.ver : 0;
    return { userId: payload.sub, role, ver, expiresAt: payload.exp };
  } catch {
    return null;
  }
}

export function homeForRole(role: UserRole): string {
  return role === "ADMIN" ? "/admin" : role === "EXAMINER" ? "/examiner" : "/candidate";
}

export const RESTRICTED_MESSAGE = "Your account has been restricted by an administrator. Contact your institution.";
