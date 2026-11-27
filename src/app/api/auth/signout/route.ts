import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/token";

const REASONS = new Set(["restricted", "revoked", "expired"]);

/**
 * Clears the session cookie and returns to the login page with a reason. Used when a page detects that
 * the account was restricted or the session revoked (pages cannot modify cookies themselves).
 * It only ever logs the caller out, so it is safe as a GET.
 */
export async function GET(req: Request) {
  const reason = new URL(req.url).searchParams.get("reason");
  const target = new URL("/login", req.url);
  if (reason && REASONS.has(reason)) target.searchParams.set("reason", reason);
  const res = NextResponse.redirect(target);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
