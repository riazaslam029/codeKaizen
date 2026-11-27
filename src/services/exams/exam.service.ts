import "server-only";
import { and, asc, count, countDistinct, desc, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { isUniqueViolation, runBatch } from "@/db/batch";
import { attempts, enrollments, examQuestions, exams, incidents, questions, results, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import { examPhase } from "@/lib/exam-phase";
import { ApiError } from "@/lib/http";
import { assertCanManageExam } from "@/lib/permissions";
import type { ExamInput } from "@/lib/validations/exam";
import { audit } from "@/services/audit";

const examColumns = {
  id: exams.id,
  code: exams.code,
  title: exams.title,
  description: exams.description,
  instructions: exams.instructions,
  status: exams.status,
  startsAt: exams.startsAt,
  endsAt: exams.endsAt,
  durationMinutes: exams.durationMinutes,
  passPercentage: exams.passPercentage,
  maxAttempts: exams.maxAttempts,
  shuffleQuestions: exams.shuffleQuestions,
  shuffleOptions: exams.shuffleOptions,
  createdById: exams.createdById,
  createdAt: exams.createdAt,
};

const questionMarks = sql<number>`coalesce(${examQuestions.marks}, ${questions.defaultMarks})::float`;

export class ExamService {
  /* ───────────── reads ───────────── */

  static async listForExaminer(examinerId: string) {
    const rows = await db
      .select({
        ...examColumns,
        questionCount: countDistinct(examQuestions.id),
        candidateCount: countDistinct(enrollments.id),
      })
      .from(exams)
      .leftJoin(examQuestions, eq(examQuestions.examId, exams.id))
      .leftJoin(enrollments, and(eq(enrollments.examId, exams.id), eq(enrollments.status, "ENROLLED")))
      .where(eq(exams.createdById, examinerId))
      .groupBy(exams.id)
      .orderBy(desc(exams.startsAt));
    const now = new Date();
    return rows.map((r) => ({ ...r, phase: examPhase(r, now) }));
  }

  /** Exam + ordered questions (with answer keys — examiner only) + totals. Enforces ownership. */
  static async getForExaminer(actor: SessionUser, examId: string) {
    await assertCanManageExam(actor, examId);
    const [exam] = await db.select(examColumns).from(exams).where(eq(exams.id, examId)).limit(1);
    if (!exam) throw ApiError.notFound("Exam not found");
    const paper = await db
      .select({
        linkId: examQuestions.id,
        position: examQuestions.position,
        marks: questionMarks,
        id: questions.id,
        type: questions.type,
        prompt: questions.prompt,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        negativeMarks: questions.negativeMarks,
        multiScoring: questions.multiScoring,
        difficulty: questions.difficulty,
        subject: questions.subject,
        topic: questions.topic,
      })
      .from(examQuestions)
      .innerJoin(questions, eq(questions.id, examQuestions.questionId))
      .where(eq(examQuestions.examId, examId))
      .orderBy(asc(examQuestions.position));
    const [realAttempts] = await db
      .select({ n: count() })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, false)));
    const totalMarks = paper.reduce((s, q) => s + q.marks, 0);
    return { exam: { ...exam, phase: examPhase(exam) }, paper, totalMarks, attemptCount: realAttempts?.n ?? 0 };
  }

  /** Exams a candidate is enrolled in, with their latest attempt and published result. No question content. */
  static async listForCandidate(candidateId: string) {
    const rows = await db
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
        maxAttempts: exams.maxAttempts,
        examiner: users.name,
      })
      .from(enrollments)
      .innerJoin(exams, eq(exams.id, enrollments.examId))
      .innerJoin(users, eq(users.id, exams.createdById))
      .where(and(eq(enrollments.candidateId, candidateId), ne(exams.status, "DRAFT")))
      .orderBy(asc(exams.startsAt));

    const ids = rows.map((r) => r.id);
    const tries = ids.length
      ? await db
          .select({
            id: attempts.id,
            examId: attempts.examId,
            status: attempts.status,
            startedAt: attempts.startedAt,
            expiresAt: attempts.expiresAt,
            submittedAt: attempts.submittedAt,
            resultStatus: results.status,
            percentage: results.percentage,
            passed: results.passed,
            resultId: results.id,
          })
          .from(attempts)
          .leftJoin(results, eq(results.attemptId, attempts.id))
          .where(and(eq(attempts.candidateId, candidateId), eq(attempts.isSandbox, false), inArray(attempts.examId, ids)))
          .orderBy(desc(attempts.startedAt))
      : [];

    const now = new Date();
    return rows.map((r) => {
      const mine = tries.filter((t) => t.examId === r.id);
      const open = mine.find((t) => t.status === "IN_PROGRESS");
      const finished = mine.filter((t) => t.status !== "IN_PROGRESS");
      const phase = examPhase(r, now);
      const latest = mine[0];
      return {
        ...r,
        phase,
        openAttemptId: open?.id ?? null,
        attemptsUsed: mine.length,
        latestAttempt: latest ?? null,
        publishedResult: finished.find((t) => t.resultStatus === "PUBLISHED") ?? null,
        canStart:
          r.enrollmentStatus === "ENROLLED" && phase === "ONGOING" && (open !== undefined || mine.length < r.maxAttempts),
      };
    });
  }

  static async platformStats() {
    const [[examTotals], [enrolled], [openIncidents], [attemptTotals]] = await Promise.all([
      db
        .select({
          total: count(),
          live: sql<number>`count(*) filter (where ${exams.status} = 'PUBLISHED' and now() between ${exams.startsAt} and ${exams.endsAt})::int`,
        })
        .from(exams),
      db.select({ n: count() }).from(enrollments).where(eq(enrollments.status, "ENROLLED")),
      db.select({ n: count() }).from(incidents).where(isNull(incidents.reviewedAt)),
      db
        .select({
          total: count(),
          inProgress: sql<number>`count(*) filter (where ${attempts.status} = 'IN_PROGRESS')::int`,
        })
        .from(attempts)
        .where(eq(attempts.isSandbox, false)),
    ]);
    return {
      exams: examTotals?.total ?? 0,
      liveExams: examTotals?.live ?? 0,
      enrollments: enrolled?.n ?? 0,
      openIncidents: openIncidents?.n ?? 0,
      attempts: attemptTotals?.total ?? 0,
      attemptsInProgress: attemptTotals?.inProgress ?? 0,
    };
  }

  /* ───────────── writes ───────────── */

  static async create(actor: SessionUser, input: ExamInput) {
    if (actor.role !== "EXAMINER" && actor.role !== "ADMIN") throw ApiError.forbidden();
    try {
      const [exam] = await db
        .insert(exams)
        .values({ ...this.toColumns(input), createdById: actor.id, status: "DRAFT" })
        .returning({ id: exams.id });
      await audit(actor.id, "exam.create", `${actor.name} created exam ${input.code}`, { type: "exam", id: exam!.id });
      return exam!;
    } catch (err) {
      if (isUniqueViolation(err)) throw ApiError.conflict("Another exam already uses this code");
      throw err;
    }
  }

  static async update(actor: SessionUser, examId: string, input: ExamInput) {
    await assertCanManageExam(actor, examId);
    try {
      await db.update(exams).set(this.toColumns(input)).where(eq(exams.id, examId));
    } catch (err) {
      if (isUniqueViolation(err)) throw ApiError.conflict("Another exam already uses this code");
      throw err;
    }
    await audit(actor.id, "exam.update", `${actor.name} updated exam ${input.code}`, { type: "exam", id: examId });
  }

  static async publish(actor: SessionUser, examId: string) {
    const { exam, paper } = await this.getForExaminer(actor, examId);
    if (exam.status !== "DRAFT") throw ApiError.conflict("Only draft exams can be published");
    if (paper.length === 0) throw ApiError.badRequest("Add at least one question before publishing");
    if (new Date(exam.endsAt) <= new Date()) throw ApiError.badRequest("The availability window has already ended");
    await db.update(exams).set({ status: "PUBLISHED" }).where(eq(exams.id, examId));
    await audit(actor.id, "exam.publish", `${actor.name} published ${exam.code}`, { type: "exam", id: examId });
  }

  static async unpublish(actor: SessionUser, examId: string) {
    const { exam, attemptCount } = await this.getForExaminer(actor, examId);
    if (exam.status !== "PUBLISHED") throw ApiError.conflict("Exam is not published");
    if (attemptCount > 0) throw ApiError.conflict("Candidates have already attempted this exam; it cannot return to draft");
    await db.update(exams).set({ status: "DRAFT" }).where(eq(exams.id, examId));
    await audit(actor.id, "exam.unpublish", `${actor.name} returned ${exam.code} to draft`, { type: "exam", id: examId });
  }

  /** Ends the availability window now. Open attempts keep their own (server-stored) deadline. */
  static async close(actor: SessionUser, examId: string) {
    const { exam } = await this.getForExaminer(actor, examId);
    if (exam.status !== "PUBLISHED") throw ApiError.conflict("Only published exams can be closed");
    await db.update(exams).set({ status: "CLOSED" }).where(eq(exams.id, examId));
    await audit(actor.id, "exam.close", `${actor.name} closed ${exam.code}`, { type: "exam", id: examId });
  }

  /**
   * Archive: hides a finished/unused exam from day-to-day lists while keeping every attempt,
   * result and report intact. Refused while the exam is live so no candidate is cut off.
   */
  static async archive(actor: SessionUser, examId: string) {
    const { exam } = await this.getForExaminer(actor, examId);
    if (exam.status === "ARCHIVED") throw ApiError.conflict("Exam is already archived");
    if (exam.phase === "ONGOING") throw ApiError.conflict("Close the examination before archiving it — candidates may be sitting it");
    const [open] = await db
      .select({ n: count() })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.status, "IN_PROGRESS"), eq(attempts.isSandbox, false)));
    if ((open?.n ?? 0) > 0) throw ApiError.conflict("Attempts are still in progress");
    await db.update(exams).set({ status: "ARCHIVED" }).where(eq(exams.id, examId));
    await audit(actor.id, "exam.archive", `${actor.name} archived ${exam.code}`, { type: "exam", id: examId });
  }

  /**
   * Permanent delete — only for drafts that no candidate ever attempted. Sandbox previews are
   * removed with it; questions stay in the bank. One transaction.
   */
  static async remove(actor: SessionUser, examId: string) {
    const { exam, attemptCount } = await this.getForExaminer(actor, examId);
    if (exam.status !== "DRAFT") throw ApiError.conflict("Only draft examinations can be deleted — archive published ones instead");
    if (attemptCount > 0) throw ApiError.conflict("Candidates have attempted this examination; archive it instead");
    await runBatch([
      db.delete(attempts).where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, true))),
      db.delete(exams).where(eq(exams.id, examId)),
    ]);
    await audit(actor.id, "exam.delete", `${actor.name} deleted draft ${exam.code}`, { type: "exam", id: examId });
  }

  /* ───────────── paper composition (draft only) ───────────── */

  private static async assertDraft(actor: SessionUser, examId: string) {
    await assertCanManageExam(actor, examId);
    const [exam] = await db.select({ status: exams.status }).from(exams).where(eq(exams.id, examId)).limit(1);
    if (exam?.status !== "DRAFT") throw ApiError.conflict("Questions can only be changed while the exam is a draft");
  }

  static async addQuestions(actor: SessionUser, examId: string, questionIds: string[]) {
    await this.assertDraft(actor, examId);
    const existing = await db
      .select({ questionId: examQuestions.questionId })
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId));
    const have = new Set(existing.map((e) => e.questionId));
    const toAdd = [...new Set(questionIds)].filter((id) => !have.has(id));
    if (toAdd.length === 0) return { added: 0 };
    const valid = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(inArray(questions.id, toAdd), eq(questions.isArchived, false)));
    if (valid.length !== toAdd.length) throw ApiError.badRequest("Some questions no longer exist");
    const [{ maxPos } = { maxPos: 0 }] = await db
      .select({ maxPos: max(examQuestions.position) })
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId));
    const start = (maxPos ?? 0) + 1;
    await db.insert(examQuestions).values(toAdd.map((questionId, i) => ({ examId, questionId, position: start + i })));
    return { added: toAdd.length };
  }

  static async removeQuestion(actor: SessionUser, examId: string, questionId: string) {
    await this.assertDraft(actor, examId);
    await db.delete(examQuestions).where(and(eq(examQuestions.examId, examId), eq(examQuestions.questionId, questionId)));
  }

  /** Swaps a question with its neighbour. Three statements in one transaction keep (exam, position) unique. */
  static async moveQuestion(actor: SessionUser, examId: string, questionId: string, direction: "up" | "down") {
    await this.assertDraft(actor, examId);
    const rows = await db
      .select({ id: examQuestions.id, questionId: examQuestions.questionId, position: examQuestions.position })
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId))
      .orderBy(asc(examQuestions.position));
    const i = rows.findIndex((r) => r.questionId === questionId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const a = rows[i]!;
    const b = rows[j]!;
    await runBatch([
      db.update(examQuestions).set({ position: 1_000_000 }).where(eq(examQuestions.id, a.id)),
      db.update(examQuestions).set({ position: a.position }).where(eq(examQuestions.id, b.id)),
      db.update(examQuestions).set({ position: b.position }).where(eq(examQuestions.id, a.id)),
    ]);
  }

  private static toColumns(input: ExamInput) {
    return {
      title: input.title,
      code: input.code,
      description: input.description || null,
      instructions: input.instructions || null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      durationMinutes: input.durationMinutes,
      passPercentage: input.passPercentage,
      maxAttempts: input.maxAttempts,
      shuffleQuestions: input.shuffleQuestions,
      shuffleOptions: input.shuffleOptions,
    };
  }
}

export class EnrollmentService {
  static async listForExam(actor: SessionUser, examId: string) {
    await assertCanManageExam(actor, examId);
    return db
      .select({
        enrollmentId: enrollments.id,
        status: enrollments.status,
        enrolledAt: enrollments.createdAt,
        candidateId: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
      })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.candidateId))
      .where(eq(enrollments.examId, examId))
      .orderBy(asc(users.name));
  }

  /** Enrols candidates; re-enrols withdrawn ones. Only CANDIDATE accounts can be enrolled. */
  static async enroll(actor: SessionUser, examId: string, candidateIds: string[]) {
    await assertCanManageExam(actor, examId);
    const ids = [...new Set(candidateIds)];
    if (ids.length === 0) return { enrolled: 0 };
    const valid = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, ids), eq(users.role, "CANDIDATE")));
    if (valid.length !== ids.length) throw ApiError.badRequest("Only candidate accounts can be enrolled");
    await db
      .insert(enrollments)
      .values(ids.map((candidateId) => ({ examId, candidateId, enrolledById: actor.id })))
      .onConflictDoUpdate({
        target: [enrollments.examId, enrollments.candidateId],
        set: { status: "ENROLLED", enrolledById: actor.id },
      });
    await audit(actor.id, "enrollment.add", `${actor.name} enrolled ${ids.length} candidate(s)`, { type: "exam", id: examId });
    return { enrolled: ids.length };
  }

  static async setStatus(actor: SessionUser, enrollmentId: string, status: "ENROLLED" | "WITHDRAWN" | "BLOCKED") {
    const [row] = await db
      .select({ examId: enrollments.examId })
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .limit(1);
    if (!row) throw ApiError.notFound("Enrolment not found");
    await assertCanManageExam(actor, row.examId);
    await db.update(enrollments).set({ status }).where(eq(enrollments.id, enrollmentId));
    await audit(actor.id, "enrollment.status", `${actor.name} set an enrolment to ${status.toLowerCase()}`, { type: "exam", id: row.examId });
  }

  /** All candidate accounts with how many exams they are enrolled in (for the examiner's candidate directory). */
  static listCandidates() {
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
        enrolments: sql<number>`count(${enrollments.id}) filter (where ${enrollments.status} = 'ENROLLED')::int`,
      })
      .from(users)
      .leftJoin(enrollments, eq(enrollments.candidateId, users.id))
      .where(eq(users.role, "CANDIDATE"))
      .groupBy(users.id)
      .orderBy(asc(users.name));
  }
}
