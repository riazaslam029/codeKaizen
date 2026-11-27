import "server-only";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "@/db/schema/enums";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, type SessionPayload, verifySessionToken } from "./token";

export { SESSION_COOKIE };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: { userId: string; role: UserRole; ver?: number }): Promise<string> {
  return new SignJWT({ role: payload.role, ver: payload.ver ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .setIssuer("codekaizen")
    .setAudience("codekaizen-web")
    .sign(secretKey());
}

/** Creates the session cookie. HTTP-only, SameSite=Lax, Secure in production. */
export async function createSession(userId: string, role: UserRole, ver: number): Promise<void> {
  const token = await signSession({ userId, role, ver });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    priority: "high",
  });
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Reads and cryptographically verifies the session cookie. Returns null if absent/invalid/expired. */
export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, secretKey());
}
