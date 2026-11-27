import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { ResultsService } from "@/services/results/results.service";

/** Public: confirms a report code. Returns only exam title, issue date and status (valid / revoked / invalid). */
export const GET = route(async (_req, ctx: { params: Promise<{ code: string }> }) => {
  const result = await ResultsService.verify((await ctx.params).code);
  if (!result) return NextResponse.json({ valid: false, status: "invalid" }, { status: 404 });
  return NextResponse.json({ valid: result.status === "valid", ...result });
});
