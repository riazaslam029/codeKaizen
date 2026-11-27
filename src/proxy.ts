import { type NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/db/schema/enums";
import { homeForRole, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

/**
 * Optimistic routing only: verifies the signed cookie (no DB call) to redirect early.
 * Real authorization happens server-side in the data access layer (lib/auth/dal.ts)
 * on every page and route handler.
 */
const AREAS: Record<string, UserRole> = { "/admin": "ADMIN", "/examiner": "EXAMINER", "/candidate": "CANDIDATE" };

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.AUTH_SECRET;
  const session =
    secret && secret.length >= 32
      ? await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, new TextEncoder().encode(secret))
      : null;

  const area = Object.keys(AREAS).find((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (area) {
    if (!session) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (AREAS[area] !== session.role) return NextResponse.redirect(new URL(homeForRole(session.role), req.url));
  }

  // Exam workspace: any signed-in user (ownership of the attempt is checked server-side).
  if (pathname.startsWith("/attempt/") && !session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/") && session) {
    return NextResponse.redirect(new URL(homeForRole(session.role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/examiner/:path*", "/candidate/:path*", "/attempt/:path*"],
};
