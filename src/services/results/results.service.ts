import "server-only";
import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { answers, attempts, auditLogs, exams, results, users } from "@/db/schema";
import type { AttemptQuestionSnapshot } from "@/db/schema/types";
import type { SessionUser } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";
import { assertCanManageExam } from "@/lib/permissions";
import { isAnswered, round2 } from "@/lib/scoring";
import { AttemptService } from "@/services/attempts/attempt.service";
import { GradingService } from "@/services/grading/grading.service";

const FINAL = ["SUBMITTED", "AUTO_SUBMITTED", "GRADED"] as const;

function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

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
      })
      .from(results)
      .innerJoin(users, eq(users.id, results.candidateId))
      .innerJoin(attempts, eq(attempts.id, results.attemptId))
      .where(eq(results.examId, examId))
      .orderBy(desc(results.percentage));

    const pcts = rows.map((r) => r.percentage);
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: i === 9 ? "90–100" : `${i * 10}–${i * 10 + 9}`,
      count: pcts.filter((p) => Math.min(9, Math.floor(p / 10)) === i).length,
    }));
    return {
      rows,
      stats: {
        count: rows.length,
        average: rows.length ? round2(pcts.reduce((a, b) => a + b, 0) / rows.length) : 0,
        median: round2(median(pcts)),
        highest: rows.length ? Math.max(...pcts) : 0,
        lowest: rows.length ? Math.min(...pcts) : 0,
        passRate: rows.length ? round2((rows.filter((r) => r.passed).length / rows.length) * 100) : 0,
        passed: rows.filter((r) => r.passed).length,
        published: rows.filter((r) => r.status === "PUBLISHED").length,
        awaitingGrading: rows.filter((r) => r.attemptStatus !== "GRADED").length,
      },
      distribution: buckets,
    };
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
    const key = (a: string, q: string) => `${a}:${q}`;
    const ansMap = new Map(ans.map((a) => [key(a.attemptId, a.questionId), a]));

    type Acc = {
      q: AttemptQuestionSnapshot;
      seen: number;
      answered: number;
      fullMarks: number;
      marksSum: number;
      optionCounts: Map<string, number>;
      wrongCounts: Map<string, number>;
    };
    const acc = new Map<string, Acc>();
    for (const t of tries) {
      for (const q of t.snapshot) {
        const e =
          acc.get(q.questionId) ??
          { q, seen: 0, answered: 0, fullMarks: 0, marksSum: 0, optionCounts: new Map(), wrongCounts: new Map() };
        e.seen++;
        const a = ansMap.get(key(t.id, q.questionId));
        if (a && isAnswered(a.response)) {
          e.answered++;
          if (a.response && "optionIds" in a.response) {
            const correct = new Set(q.correctAnswer && "optionIds" in q.correctAnswer ? q.correctAnswer.optionIds : []);
            for (const id of a.response.optionIds) {
              e.optionCounts.set(id, (e.optionCounts.get(id) ?? 0) + 1);
              if (!correct.has(id)) e.wrongCounts.set(id, (e.wrongCounts.get(id) ?? 0) + 1);
            }
          }
        }
        const m = a?.marks ?? 0;
        e.marksSum += Math.max(0, m);
        if (m >= q.marks) e.fullMarks++;
        acc.set(q.questionId, e);
      }
    }

    const questions = [...acc.values()].map((e) => {
      const facility = e.seen ? e.fullMarks / e.seen : 0;
      const correctIds = new Set(e.q.correctAnswer && "optionIds" in e.q.correctAnswer ? e.q.correctAnswer.optionIds : []);
      const topWrong = [...e.wrongCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        questionId: e.q.questionId,
        type: e.q.type,
        prompt: e.q.prompt,
        marks: e.q.marks,
        attempts: e.seen,
        answered: e.answered,
        skipped: e.seen - e.answered,
        skipRate: e.seen ? round2(((e.seen - e.answered) / e.seen) * 100) : 0,
        correctRate: round2(facility * 100),
        averageMarksPct: e.seen ? round2((e.marksSum / (e.seen * e.q.marks)) * 100) : 0,
        difficulty: e.seen < 3 ? "Insufficient data" : facility >= 0.7 ? "Easy" : facility >= 0.3 ? "Moderate" : "Hard",
        commonWrong: topWrong
          ? { text: e.q.options?.find((o) => o.id === topWrong[0])?.text ?? topWrong[0], count: topWrong[1] }
          : null,
        distribution: (e.q.options ?? []).map((o) => ({
          id: o.id,
          text: o.text,
          count: e.optionCounts.get(o.id) ?? 0,
          correct: correctIds.has(o.id),
        })),
      };
    });
    return { attempts: tries.length, questions };
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
    return [...a!.questionSnapshot]
      .sort((x, y) => x.position - y.position)
      .map((q) => ({
        position: q.position,
        prompt: q.prompt,
        type: q.type,
        marks: q.marks,
        awarded: byQ.get(q.questionId)?.marksAwarded ?? 0,
        feedback: byQ.get(q.questionId)?.feedback ?? null,
        answered: isAnswered(byQ.get(q.questionId)?.response),
      }));
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
  static async verify(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!/^CKZ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(normalized)) return null;
    const [row] = await db
      .select({
        name: users.name,
        examTitle: exams.title,
        examCode: exams.code,
        percentage: results.percentage,
        passed: results.passed,
        publishedAt: results.publishedAt,
      })
      .from(results)
      .innerJoin(users, eq(users.id, results.candidateId))
      .innerJoin(exams, eq(exams.id, results.examId))
      .where(and(eq(results.verificationCode, normalized), eq(results.status, "PUBLISHED")))
      .limit(1);
    if (!row) return null;
    return {
      code: normalized,
      candidate: maskName(row.name),
      examTitle: row.examTitle,
      examCode: row.examCode,
      percentage: row.percentage,
      outcome: row.passed ? "Pass" : "Not passed",
      publishedAt: row.publishedAt!,
    };
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

function maskName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p : `${p[0]}.`))
    .join(" ");
}
