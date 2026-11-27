import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { readJson, route } from "@/lib/http";
import { saveAnswersSchema } from "@/lib/validations/attempt";
import { AttemptService } from "@/services/attempts/attempt.service";

/** Batch answer save. Idempotent per (question, revision); rejected after the server deadline. */
export const PUT = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await authorize();
  const id = z.uuid().parse((await ctx.params).id);
  const input = saveAnswersSchema.parse(await readJson(req));
  return NextResponse.json(await AttemptService.saveAnswers(actor, id, input));
});
