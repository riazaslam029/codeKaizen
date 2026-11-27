import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { ApiError, route } from "@/lib/http";
import { scratchpadSchema } from "@/lib/validations/attempt";
import { AttemptService } from "@/services/attempts/attempt.service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, ctx: Ctx) => {
  const actor = await authorize();
  const id = z.uuid().parse((await ctx.params).id);
  return NextResponse.json({ data: await AttemptService.getScratchpad(actor, id) }, { headers: { "Cache-Control": "no-store" } });
});

export const PUT = route(async (req, ctx: Ctx) => {
  const actor = await authorize();
  const id = z.uuid().parse((await ctx.params).id);
  const raw = await req.text();
  if (raw.length > 1_500_000) throw ApiError.badRequest("Scratchpad is too large (1.5 MB max)");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON");
  }
  await AttemptService.saveScratchpad(actor, id, scratchpadSchema.parse(json));
  return NextResponse.json({ ok: true });
});

