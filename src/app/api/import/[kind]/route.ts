import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { ApiError, readJson, route } from "@/lib/http";
import { ImportService } from "@/services/import/import.service";

const body = z.object({
  format: z.enum(["csv", "json"]),
  content: z.string().min(1, "The file is empty"),
  defaultPassword: z.string().max(128).optional(),
  examId: z.uuid().optional(),
});

/** POST /api/import/candidates | /api/import/questions — validated, all-or-nothing bulk import. */
export const POST = route(async (req, ctx: { params: Promise<{ kind: string }> }) => {
  const actor = await authorize("EXAMINER", "ADMIN");
  const { kind } = await ctx.params;
  const input = body.parse(await readJson(req));
  if (kind === "candidates") return NextResponse.json(await ImportService.importCandidates(actor, input));
  if (kind === "questions") return NextResponse.json(await ImportService.importQuestions(actor, input));
  throw ApiError.notFound("Unknown import type");
});
