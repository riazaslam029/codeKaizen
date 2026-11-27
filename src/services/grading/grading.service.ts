import "server-only";
import type { BatchItem } from "drizzle-orm/batch";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/batch";
import { answers, attempts, exams, results } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";
import { assertCanManageExam } from "@/lib/permissions";
import { verificationCode } from "@/lib/random";
import { round2, scoreQuestion } from "@/lib/scoring";
import { audit } from "@/services/audit";

export class GradingService {
  /**
   * (Re)computes an attempt's marks from its frozen snapshot. Idempotent and safe to call repeatedly:
   * auto-marks are refreshed, examiner-entered marks (gradedById set) are preserved, and the
   * attempt/result rows are written in ONE transaction.
   */
  static async gradeAttempt(attemptId: string) {
    const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
    if (!a || a.status === "IN_PROGRESS") return null;
    const [exam] = await db.select({ passPercentage: exams.passPercentage }).from(exams).where(eq(exams.id, a.examId)).limit(1);
    const rows = await db.select().from(answers).where(eq(answers.attemptId, a.id));
    const byQ = new Map(rows.map((r) => [r.questionId, r]));

    const ops: BatchItem<"pg">[] = [];
    let total = 0;
    let pending = 0;
    let maxScore = 0;

    for (const q of a.questionSnapshot) {
      maxScore += q.marks;
      const ans = byQ.get(q.questionId);
      if (ans?.gradedById) {
        total += ans.marksAwarded ?? 0; // examiner's decision wins
        continue;
      }
      const { isCorrect, marks } = scoreQuestion(q, ans?.response);
      if (marks === null) {
        pending++;
        continue;
      }
      total += marks;
      if (ans && (ans.marksAwarded !== marks || ans.isCorrect !== isCorrect)) {
        ops.push(db.update(answers).set({ marksAwarded: marks, isCorrect }).where(eq(answers.id, ans.id)));
      }
    }

    const score = round2(Math.max(0, total));
    const percentage = maxScore > 0 ? round2(Math.min(100, (score / maxScore) * 100)) : 0;
    const passed = percentage >= (exam?.passPercentage ?? 50);

    if (!a.isSandbox) {
      ops.push(
        db
          .insert(results)
          .values({ attemptId: a.id, examId: a.examId, candidateId: a.candidateId, score, maxScore, percentage, passed })
          .onConflictDoUpdate({
            target: results.attemptId,
            set: { score, maxScore, percentage, passed, updatedAt: new Date() },
            setWhere: ne(results.status, "PUBLISHED"),
          }),
      );
    }
    if (pending === 0 && (a.status === "SUBMITTED" || a.status === "AUTO_SUBMITTED")) {
      ops.push(db.update(attempts).set({ status: "GRADED" }).where(eq(attempts.id, a.id)));
    }
    await runBatch(ops);
    return { score, maxScore, percentage, passed, pending };
  }

  /** Sandbox only: auto-marked score for the examiner's own preview. */
  static async previewScore(attemptId: string) {
    const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
    if (!a) return null;
    const rows = await db.select().from(answers).where(eq(answers.attemptId, a.id));
    const byQ = new Map(rows.map((r) => [r.questionId, r.response]));
    let total = 0;
    let max = 0;
    let manual = 0;
    for (const q of a.questionSnapshot) {
      max += q.marks;
      const { marks } = scoreQuestion(q, byQ.get(q.questionId));
      if (marks === null) manual++;
      else total += marks;
    }
    return { score: round2(Math.max(0, total)), maxScore: max, manualPending: manual };
  }

  /** Examiner sets marks/feedback for one question of a finalised attempt, before publication. */
  static async gradeAnswer(actor: SessionUser, input: { attemptId: string; questionId: string; marks: number; feedback: string }) {
    const [a] = await db.select().from(attempts).where(eq(attempts.id, input.attemptId)).limit(1);
    if (!a || a.isSandbox) throw ApiError.notFound("Attempt not found");
    await assertCanManageExam(actor, a.examId);
    if (a.status === "IN_PROGRESS") throw ApiError.conflict("The candidate is still answering");
    const [res] = await db.select({ status: results.status }).from(results).where(eq(results.attemptId, a.id)).limit(1);
    if (res?.status === "PUBLISHED") throw ApiError.conflict("Results are already published; grades are locked");

    const q = a.questionSnapshot.find((x) => x.questionId === input.questionId);
    if (!q) throw ApiError.badRequest("Question is not part of this attempt");
    const min = q.type === "ESSAY" ? 0 : -q.negativeMarks;
    if (input.marks < min || input.marks > q.marks) throw ApiError.badRequest(`Marks must be between ${min} and ${q.marks}`);

    const now = new Date();
    await db
      .insert(answers)
      .values({
        attemptId: a.id,
        questionId: q.questionId,
        response: null,
        marksAwarded: input.marks,
        feedback: input.feedback || null,
        gradedById: actor.id,
        gradedAt: now,
        isCorrect: q.type === "ESSAY" ? null : input.marks >= q.marks,
      })
      .onConflictDoUpdate({
        target: [answers.attemptId, answers.questionId],
        set: { marksAwarded: input.marks, feedback: input.feedback || null, gradedById: actor.id, gradedAt: now },
      });
    const summary = await this.gradeAttempt(a.id);
    await audit(actor.id, "grade.answer", `${actor.name} graded question ${q.position}`, { type: "attempt", id: a.id });
    return summary;
  }

  /**
   * Controlled publication: only fully graded attempts are published; each receives a unique
   * verification code. Nothing is ever published automatically.
   */
  static async publishResults(actor: SessionUser, examId: string) {
    await assertCanManageExam(actor, examId);
    const rows = await db
      .select({ resultId: results.id, attemptStatus: attempts.status })
      .from(results)
      .innerJoin(attempts, eq(attempts.id, results.attemptId))
      .where(and(eq(results.examId, examId), ne(results.status, "PUBLISHED")));
    const ready = rows.filter((r) => r.attemptStatus === "GRADED");
    const notReady = rows.length - ready.length;
    const now = new Date();
    await runBatch(
      ready.map((r) =>
        db
          .update(results)
          .set({ status: "PUBLISHED", publishedAt: now, verificationCode: verificationCode(), gradedById: actor.id })
          .where(and(eq(results.id, r.resultId), ne(results.status, "PUBLISHED"))),
      ),
    );
    await audit(actor.id, "results.publish", `${actor.name} published ${ready.length} result(s)`, { type: "exam", id: examId });
    return { published: ready.length, awaitingGrading: notReady };
  }

  /** Re-runs grading for every finalised attempt of an exam (recovers from any interrupted grading). */
  static async regradeExam(examId: string) {
    const rows = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, false), inArray(attempts.status, ["SUBMITTED", "AUTO_SUBMITTED"])));
    for (const r of rows) await this.gradeAttempt(r.id);
  }
}

