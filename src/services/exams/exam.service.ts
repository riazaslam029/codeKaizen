import "server-only";
import { and, asc, count, countDistinct, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, examQuestions, exams, incidents, users } from "@/db/schema";

export class ExamService {
  /** Exams an examiner owns, with question and enrolment counts. */
  static listForExaminer(examinerId: string) {
    return db
      .select({
        id: exams.id,
        code: exams.code,
        title: exams.title,
        status: exams.status,
        startsAt: exams.startsAt,
        durationMinutes: exams.durationMinutes,
        questionCount: countDistinct(examQuestions.id),
        candidateCount: countDistinct(enrollments.id),
      })
      .from(exams)
      .leftJoin(examQuestions, eq(examQuestions.examId, exams.id))
      .leftJoin(enrollments, and(eq(enrollments.examId, exams.id), eq(enrollments.status, "ENROLLED")))
      .where(eq(exams.createdById, examinerId))
      .groupBy(exams.id)
      .orderBy(asc(exams.startsAt));
  }

  /** Exams a candidate is enrolled in. Never selects question content. */
  static listForCandidate(candidateId: string) {
    return db
      .select({
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
        id: exams.id,
        code: exams.code,
        title: exams.title,
        description: exams.description,
        status: exams.status,
        startsAt: exams.startsAt,
        endsAt: exams.endsAt,
        durationMinutes: exams.durationMinutes,
        examiner: users.name,
      })
      .from(enrollments)
      .innerJoin(exams, eq(exams.id, enrollments.examId))
      .innerJoin(users, eq(users.id, exams.createdById))
      .where(eq(enrollments.candidateId, candidateId))
      .orderBy(asc(exams.startsAt));
  }

  static async platformStats() {
    const [[examTotals], [enrolled], [openIncidents]] = await Promise.all([
      db
        .select({
          total: count(),
          live: sql<number>`count(*) filter (where ${exams.status} in ('PUBLISHED','ACTIVE'))::int`,
        })
        .from(exams),
      db.select({ n: count() }).from(enrollments).where(eq(enrollments.status, "ENROLLED")),
      db.select({ n: count() }).from(incidents).where(isNull(incidents.reviewedAt)),
    ]);
    return {
      exams: examTotals?.total ?? 0,
      liveExams: examTotals?.live ?? 0,
      enrollments: enrolled?.n ?? 0,
      openIncidents: openIncidents?.n ?? 0,
    };
  }
}
