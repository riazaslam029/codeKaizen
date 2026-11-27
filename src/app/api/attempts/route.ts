import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { readJson, route } from "@/lib/http";
import { AttemptService } from "@/services/attempts/attempt.service";

const body = z.object({ examId: z.uuid() });

/** Start or resume an attempt. Candidates: real attempt. Examiners/admins: sandbox preview only. */
export const POST = route(async (req) => {
  const actor = await authorize("CANDIDATE", "EXAMINER", "ADMIN");
  const { examId } = body.parse(await readJson(req));
  // The role decides the mode server-side; the client cannot request a sandbox or a real attempt.
  const result = await AttemptService.start(actor, examId, { sandbox: actor.role !== "CANDIDATE" });
  return NextResponse.json(result, { status: result.resumed ? 200 : 201 });
});
