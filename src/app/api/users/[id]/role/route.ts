import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { readJson, route } from "@/lib/http";
import { changeRoleSchema } from "@/lib/validations/auth";
import { UserService } from "@/services/users/user.service";

/** Admin only; an admin cannot change their own role (enforced in UserService → permissions). */
export const PATCH = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await authorize("ADMIN");
  const id = z.uuid().parse((await ctx.params).id);
  const { role } = changeRoleSchema.parse(await readJson(req));
  return NextResponse.json({ user: await UserService.changeRole(actor, id, role) });
});
