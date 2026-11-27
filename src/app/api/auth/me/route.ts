import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/dal";
import { readSession } from "@/lib/auth/session";
import { route } from "@/lib/http";

/** Current user + session expiry (used by the client session guard for polling and expiry warnings). */
export const GET = route(async () => {
  const user = await authorize();
  const session = await readSession();
  return NextResponse.json({ user, sessionExpiresAt: session ? new Date(session.expiresAt * 1000).toISOString() : null }, { headers: { "Cache-Control": "no-store" } });
});
