import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";
import { route } from "@/lib/http";

export const POST = route(async () => {
  await deleteSession();
  return NextResponse.json({ ok: true });
});
