import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { route } from "@/lib/http";
import { clientSessionId } from "@/lib/validations/attempt";
import { AttemptService } from "@/services/attempts/attempt.service";

/** Candidate-safe attempt state (no answer keys) + server time for clock-skew-free countdowns. */
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await authorize();
  const id = z.uuid().parse((await ctx.params).id);
  const session = clientSessionId.safeParse(req.headers.get("x-client-session"));
  const state = await AttemptService.getState(actor, id, session.success ? session.data : undefined);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
});
