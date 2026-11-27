import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { route } from "@/lib/http";
import { AttemptService } from "@/services/attempts/attempt.service";

/** Idempotent final submission: repeated calls return the existing outcome. */
export const POST = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await authorize();
  const id = z.uuid().parse((await ctx.params).id);
  return NextResponse.json(await AttemptService.submit(actor, id));
});
