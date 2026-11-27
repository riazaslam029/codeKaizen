import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { enrollments, exams } from "@/db/schema";
import { authorize } from "@/lib/auth/dal";
import { route } from "@/lib/http";
import { assertCanAccessCandidate } from "@/lib/permissions";

/** A candidate's enrollments. Candidates: own only. Examiners: candidates in their exams. Admins: all. */
export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await authorize();
  const candidateId = z.uuid().parse((await ctx.params).id);
  await assertCanAccessCandidate(actor, candidateId);

  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      status: enrollments.status,
      exam: { id: exams.id, code: exams.code, title: exams.title, startsAt: exams.startsAt, status: exams.status },
    })
    .from(enrollments)
    .innerJoin(exams, eq(exams.id, enrollments.examId))
    .where(eq(enrollments.candidateId, candidateId))
    .orderBy(desc(exams.startsAt));

  return NextResponse.json({ enrollments: rows });
});
