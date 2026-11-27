import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import { homeForRole, RESTRICTED_MESSAGE } from "@/lib/auth/token";
import { ApiError, readJson, route } from "@/lib/http";
import { loginSchema } from "@/lib/validations/auth";
import { UserService } from "@/services/users/user.service";

export const POST = route(async (req) => {
  const { email, password } = loginSchema.parse(await readJson(req));
  const r = await UserService.authenticate(email, password);
  // Same message for unknown email and wrong password (no account enumeration).
  if (r.status === "invalid") throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  // Only reachable with the CORRECT password, so it does not reveal which emails exist.
  if (r.status === "restricted") throw new ApiError(403, "ACCOUNT_RESTRICTED", RESTRICTED_MESSAGE);

  await createSession(r.user.id, r.user.role, r.sessionVersion);
  return NextResponse.json({ user: r.user, redirectTo: homeForRole(r.user.role) });
});
