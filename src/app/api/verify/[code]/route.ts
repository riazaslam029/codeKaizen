import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { ResultsService } from "@/services/results/results.service";

/** Public: confirms a report code. Returns only minimal, non-sensitive fields. */
export const GET = route(async (_req, ctx: { params: Promise<{ code: string }> }) => {
  const result = await ResultsService.verify((await ctx.params).code);
  if (!result) return NextResponse.json({ valid: false }, { status: 404 });
  return NextResponse.json({ valid: true, ...result });
});
