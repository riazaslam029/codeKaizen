import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/token";
import { ApiError, readJson, route } from "@/lib/http";
import { loginSchema } from "@/lib/validations/auth";
import { UserService } from "@/services/users/user.service";

export const POST = route(async (req) => {
  const { email, password } = loginSchema.parse(await readJson(req));
  const user = await UserService.authenticate(email, password);
  // Same message for unknown email and wrong password.
  if (!user) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  await createSession(user.id, user.role);
  return NextResponse.json({ user, redirectTo: homeForRole(user.role) });
});
