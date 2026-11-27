import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/dal";
import { route } from "@/lib/http";
import { UserService } from "@/services/users/user.service";

/** Admin only: list all users (never includes password hashes). */
export const GET = route(async () => {
  await authorize("ADMIN");
  return NextResponse.json({ users: await UserService.list() });
});
