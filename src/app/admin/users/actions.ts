"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-types";
import { runAction } from "@/lib/actions";
import { authorize } from "@/lib/auth/dal";
import { createUserSchema, role, updateUserSchema } from "@/lib/validations/user";
import { UserService } from "@/services/users/user.service";

export async function createUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await authorize("ADMIN");
    const u = await UserService.create(actor, createUserSchema.parse(input));
    return { id: u.id };
  }, "Account created");
}

export async function updateUserAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("ADMIN");
    const data = updateUserSchema.parse(input);
    await UserService.update(actor, z.uuid().parse(id), { ...data, password: data.password || undefined });
    return null;
  }, "Account updated");
}

export async function changeRoleAction(id: string, newRole: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("ADMIN");
    await UserService.changeRole(actor, z.uuid().parse(id), role.parse(newRole));
    return null;
  }, "Role updated");
}

export async function setActiveAction(id: string, active: boolean): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await authorize("ADMIN");
    await UserService.setActive(actor, z.uuid().parse(id), z.boolean().parse(active));
    return null;
  }, active ? "Account activated" : "Account deactivated");
}
