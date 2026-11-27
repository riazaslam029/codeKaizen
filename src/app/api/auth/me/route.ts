import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/dal";
import { route } from "@/lib/http";

export const GET = route(async () => {
  const user = await authorize();
  return NextResponse.json({ user });
});
