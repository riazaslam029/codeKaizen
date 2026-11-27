import "server-only";
import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { answers, attempts, auditLogs, exams, questions, results, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";
import { assertCanManageExam } from "@/lib/permissions";
import { computeQuestionAnalytics, summarizeResults } from "@/lib/analytics";
import { isAnswered } from "@/lib/scoring";
import { AttemptService } from "@/services/attempts/attempt.service";
import { GradingService } from "@/services/grading/grading.service";

const FINAL = ["SUBMITTED", "AUTO_SUBMITTED", "GRADED"] as const;

export class ResultsService {
  /** Per-exam results with grading progress. Sandbox attempts never have result rows. */
  static async examSummary(actor: SessionUser, examId: string) {
    await assertCanManageExam(actor, examId);
    await AttemptService.finalizeExpired({ examId });
    await GradingService.regradeExam(examId);

    const rows = await db
      .select({
        resultId: results.id,
        attemptId: results.attemptId,
        candidateId: users.id,
        name: users.name,
        email: users.email,
        score: results.score,
        maxScore: results.maxScore,
        percentage: results.percentage,
        passed: results.passed,
        status: results.status,
        publishedAt: results.publishedAt,
        verificationCode: results.verificationCode,
        attemptStatus: attempts.status,
        submittedAt: attempts.submittedAt,
        startedAt: attempts.startedAt,
        manualGrades: sql<number>`(select count(*)::int from ${answers} where ${answers.attemptId} = ${attempts.id} and ${answers.gradedById} is not null)`,
        publishedBy: sql<string | null>`(select u.name from ${users} u where u.id = ${results.publishedById})`,
      })
      .from(results)
      .innerJoin(users, eq(users.id, results.candidateId))
      .innerJoin(attempts, eq(attempts.id, results.attemptId))
      .where(eq(results.examId, examId))
      .orderBy(desc(results.percentage));

    const withStatus = rows.map((r) => ({
      ...r,
      gradingStatus: (r.attemptStatus !== "GRADED" ? "NEEDS_GRADING" : r.manualGrades > 0 ? "GRADED_MANUAL" : "AUTO_GRADED") as "NEEDS_GRADING" | "GRADED_MANUAL" | "AUTO_GRADED",
    }));
    return { rows: withStatus, ...summarizeResults(rows) };
  }

  /** Finalised attempts in the examiner's exams that still contain un-graded written answers. */
  static async gradingQueue(actor: SessionUser) {
    const mine = await db.select({ id: exams.id }).from(exams).where(actor.role === "ADMIN" ? undefined : eq(exams.createdById, actor.id));
    if (!mine.length) return [];
    const examIds = mine.map((e) => e.id);
    for (const id of examIds) await AttemptService.finalizeExpired({ examId: id });
    return db
      .select({
        attemptId: attempts.id,
        examId: exams.id,
        examCode: exams.code,
        examTitle: exams.title,
        candidate: users.name,
        status: attempts.status,
        submittedAt: attempts.submittedAt,
        resultStatus: results.status,
        pending: sql<number>`(
          select count(*)::int from jsonb_array_elements(${attempts.questionSnapshot}) q
          left join ${answers} an on an.attempt_id = ${attempts.id} and an.question_id = (q->>'questionId')::uuid
          where q->>'type' = 'ESSAY' and an.marks_awarded is null
            and length(trim(coalesce(an.response->>'text', ''))) > 0)`,
      })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .leftJoin(results, eq(results.attemptId, attempts.id))
      .where(and(inArray(attempts.examId, examIds), eq(attempts.isSandbox, false), inArray(attempts.status, [...FINAL])))
      .orderBy(desc(attempts.submittedAt));
  }

  /**
   * Question analytics from real responses only (finalised, non-sandbox attempts).
   * Facility index = share of attempts that earned full marks; skipped = no answer saved.
   */
  static async questionAnalytics(actor: SessionUser, examId: string) {
    await assertCanManageExam(actor, examId);
    const tries = await db
      .select({ id: attempts.id, snapshot: attempts.questionSnapshot })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, false), inArray(attempts.status, [...FINAL])));
    if (!tries.length) return { attempts: 0, questions: [] };

    const ans = await db
      .select({ attemptId: answers.attemptId, questionId: answers.questionId, response: answers.response, marks: answers.marksAwarded })
      .from(answers)
      .where(inArray(answers.attemptId, tries.map((t) => t.id)));
    const computed = computeQuestionAnalytics(tries, ans);
    // Snapshots taken before difficulty was frozen fall back to the bank's current difficulty.
    const missing = computed.filter((q) => !q.assignedDifficulty).map((q) => q.questionId);
    const bank = missing.length
      ? new Map((await db.select({ id: questions.id, d: questions.difficulty }).from(questions).where(inArray(questions.id, missing))).map((q) => [q.id, q.d]))
      : new Map<string, "EASY" | "MEDIUM" | "HARD">();
    const questionsOut = computed.map((q) => ({ ...q, assignedDifficulty: q.assignedDifficulty ?? bank.get(q.questionId) ?? null }));
    return { attempts: tries.length, questions: questionsOut };
  }

  /** Candidate: only their own PUBLISHED results. */
  static candidateResults(candidateId: string) {
    return db
      .select({
        resultId: results.id,
        examCode: exams.code,
        examTitle: exams.title,
        score: results.score,
        maxScore: results.maxScore,
        percentage: results.percentage,
        passed: results.passed,
        passPercentage: exams.passPercentage,
        publishedAt: results.publishedAt,
        verificationCode: results.verificationCode,
        submittedAt: attempts.submittedAt,
      })
      .from(results)
      .innerJoin(exams, eq(exams.id, results.examId))
      .innerJoin(attempts, eq(attempts.id, results.attemptId))
      .where(and(eq(results.candidateId, candidateId), eq(results.status, "PUBLISHED")))
      .orderBy(desc(results.publishedAt));
  }

  /** Per-question marks + feedback for a candidate's own published result (no answer keys). */
  static async candidateBreakdown(actor: SessionUser, resultId: string) {
    const [r] = await db.select().from(results).where(eq(results.id, resultId)).limit(1);
    if (!r || r.candidateId !== actor.id || r.status !== "PUBLISHED") throw ApiError.notFound("Result not found");
    const [a] = await db.select().from(attempts).where(eq(attempts.id, r.attemptId)).limit(1);
    const rows = await db.select().from(answers).where(eq(answers.attemptId, r.attemptId));
    const byQ = new Map(rows.map((x) => [x.questionId, x]));
    // Older snapshots may not carry topic: fall back to the bank's current topic for display only.
    const missing = a!.questionSnapshot.filter((q) => q.topic === undefined).map((q) => q.questionId);
    const bankTopics = missing.length
      ? new Map(
          (await db.select({ id: questions.id, topic: questions.topic, subject: questions.subject }).from(questions).where(inArray(questions.id, missing))).map((q) => [q.id, q.topic ?? q.subject]),
        )
      : new Map<string, string | null>();
    const items = [...a!.questionSnapshot]
      .sort((x, y) => x.position - y.position)
      .map((q) => {
        const ans = byQ.get(q.questionId);
        const answered = isAnswered(ans?.response);
        const awarded = ans?.marksAwarded ?? 0;
        const outcome = !answered ? "skipped" : awarded >= q.marks ? "correct" : awarded > 0 ? "partial" : "incorrect";
        return {
          position: q.position,
          prompt: q.prompt,
          type: q.type,
          topic: (q.topic ?? bankTopics.get(q.questionId) ?? null) || "General",
          marks: q.marks,
          awarded,
          feedback: ans?.feedback ?? null,
          answered,
          outcome: outcome as "correct" | "partial" | "incorrect" | "skipped",
        };
      });
    const topics = [...new Set(items.map((i) => i.topic))].map((topic) => {
      const t = items.filter((i) => i.topic === topic);
      const max = t.reduce((s2, i) => s2 + i.marks, 0);
      const got = t.reduce((s2, i) => s2 + Math.max(0, i.awarded), 0);
      return { topic, questions: t.length, marks: max, awarded: got, percentage: max ? Math.round((got / max) * 1000) / 10 : 0 };
    });
    const timeSpentSeconds = a!.submittedAt ? Math.max(0, Math.round((a!.submittedAt.getTime() - a!.startedAt.getTime()) / 1000)) : null;
    return { items, topics, timeSpentSeconds };
  }

  /** Candidate's finalised attempts whose results are not (yet) published — shown as a friendly waiting state. */
  static candidateAwaiting(candidateId: string) {
    return db
      .select({ attemptId: attempts.id, examTitle: exams.title, examCode: exams.code, submittedAt: attempts.submittedAt, resultStatus: results.status })
      .from(attempts)
      .innerJoin(exams, eq(exams.id, attempts.examId))
      .leftJoin(results, eq(results.attemptId, attempts.id))
      .where(
        and(
          eq(attempts.candidateId, candidateId),
          eq(attempts.isSandbox, false),
          inArray(attempts.status, [...FINAL]),
          sql`(${results.status} is null or ${results.status} <> 'PUBLISHED')`,
        ),
      )
      .orderBy(desc(attempts.submittedAt));
  }

  /** Everything the PDF needs, with access control: candidate (own), exam owner, or admin — published only. */
  static async forReport(actor: SessionUser, resultId: string) {
    const [row] = await db
      .select({
        id: results.id,
        status: results.status,
        candidateId: results.candidateId,
        examId: results.examId,
        score: results.score,
        maxScore: results.maxScore,
        percentage: results.percentage,
        passed: results.passed,
        publishedAt: results.publishedAt,
        verificationCode: results.verificationCode,
        examCode: exams.code,
        examTitle: exams.title,
        passPercentage: exams.passPercentage,
        examOwner: exams.createdById,
        candidateName: users.name,
        candidateEmail: users.email,
        submittedAt: attempts.submittedAt,
        startedAt: attempts.startedAt,
      })
      .from(results)
      .innerJoin(exams, eq(exams.id, results.examId))
      .innerJoin(users, eq(users.id, results.candidateId))
      .innerJoin(attempts, eq(attempts.id, results.attemptId))
      .where(eq(results.id, resultId))
      .limit(1);
    const allowed =
      row &&
      row.status === "PUBLISHED" &&
      (actor.role === "ADMIN" || row.candidateId === actor.id || (actor.role === "EXAMINER" && row.examOwner === actor.id));
    if (!allowed) throw ApiError.notFound("Report not found");
    return row;
  }

  /**
   * Public verification. Returns ONLY what is needed to confirm a printed report is genuine:
   * masked name, exam title, outcome, percentage and publication date. No email, ids or answers.
   */
  static async verify(code: string): Promise<{ status: "valid" | "revoked"; code: string; examTitle: string; issuedAt: Date } | null> {
    const normalized = code.trim().toUpperCase();
    if (!/^CKZ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(normalized)) return null;
    const [row] = await db
      .select({ examTitle: exams.title, status: results.status, publishedAt: results.publishedAt })
      .from(results)
      .innerJoin(exams, eq(exams.id, results.examId))
      .where(eq(results.verificationCode, normalized))
      .limit(1);
    if (!row || !row.publishedAt) return null;
    // Only the minimum needed to establish authenticity: no name, score, email or ids.
    return { status: row.status === "PUBLISHED" ? "valid" : "revoked", code: normalized, examTitle: row.examTitle, issuedAt: row.publishedAt };
  }

  /** All published results in exams the examiner owns (Reports page). */
  static publishedForExaminer(actor: SessionUser) {
    return db
      .select({
        resultId: results.id,
        examCode: exams.code,
        examTitle: exams.title,
        candidate: users.name,
        percentage: results.percentage,
        passed: results.passed,
        publishedAt: results.publishedAt,
        verificationCode: results.verificationCode,
      })
      .from(results)
      .innerJoin(exams, eq(exams.id, results.examId))
      .innerJoin(users, eq(users.id, results.candidateId))
      .where(and(eq(results.status, "PUBLISHED"), actor.role === "ADMIN" ? undefined : eq(exams.createdById, actor.id)))
      .orderBy(desc(results.publishedAt))
      .limit(500);
  }

  /** Admin activity feed + 14-day daily series from the audit log and real attempts. */
  static async platformActivity() {
    const since = new Date(Date.now() - 13 * 86_400_000);
    since.setUTCHours(0, 0, 0, 0);
    const [feed, perDay, attemptsPerDay] = await Promise.all([
      db
        .select({ id: auditLogs.id, action: auditLogs.action, summary: auditLogs.summary, createdAt: auditLogs.createdAt, actor: users.name })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(100),
      db
        .select({ day: sql<string>`to_char(${auditLogs.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
        .from(auditLogs)
        .where(gte(auditLogs.createdAt, since))
        .groupBy(sql`1`),
      db
        .select({ day: sql<string>`to_char(${attempts.startedAt} at time zone 'UTC', 'YYYY-MM-DD')`, n: sql<number>`count(*)::int` })
        .from(attempts)
        .where(and(gte(attempts.startedAt, since), eq(attempts.isSandbox, false)))
        .groupBy(sql`1`),
    ]);
    const series = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      return {
        day: d.slice(5),
        events: perDay.find((p) => p.day === d)?.n ?? 0,
        attempts: attemptsPerDay.find((p) => p.day === d)?.n ?? 0,
      };
    });
    return { feed, series };
  }

  /** Examiner overview numbers. */
  static async examinerOverview(actor: SessionUser) {
    const [counts] = await db
      .select({
        exams: sql<number>`count(distinct ${exams.id})::int`,
        live: sql<number>`count(distinct ${exams.id}) filter (where ${exams.status} = 'PUBLISHED' and now() between ${exams.startsAt} and ${exams.endsAt})::int`,
        inProgress: sql<number>`count(${attempts.id}) filter (where ${attempts.status} = 'IN_PROGRESS' and not ${attempts.isSandbox})::int`,
        submitted: sql<number>`count(${attempts.id}) filter (where ${attempts.status} <> 'IN_PROGRESS' and not ${attempts.isSandbox})::int`,
      })
      .from(exams)
      .leftJoin(attempts, eq(attempts.examId, exams.id))
      .where(eq(exams.createdById, actor.id));
    const [unpublished] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(results)
      .innerJoin(exams, eq(exams.id, results.examId))
      .where(and(eq(exams.createdById, actor.id), ne(results.status, "PUBLISHED")));
    return { ...counts!, unpublished: unpublished?.n ?? 0 };
  }

  static examsForSelect(actor: SessionUser) {
    return db
      .select({ id: exams.id, code: exams.code, title: exams.title, status: exams.status })
      .from(exams)
      .where(actor.role === "ADMIN" ? undefined : eq(exams.createdById, actor.id))
      .orderBy(asc(exams.code));
  }
}
