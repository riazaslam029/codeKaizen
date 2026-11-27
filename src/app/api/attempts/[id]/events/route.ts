import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { readJson, route } from "@/lib/http";
import { clientEventSchema } from "@/lib/validations/attempt";
import { AttemptService } from "@/services/attempts/attempt.service";

/** Connectivity / sync indicators reported by the browser (recorded for review, never auto-penalised). */
export const POST = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await authorize();
  const id = z.uuid().parse((await ctx.params).id);
  const event = clientEventSchema.parse(await readJson(req));
  return NextResponse.json(await AttemptService.reportClientEvent(actor, id, event), { status: 202 });
});
