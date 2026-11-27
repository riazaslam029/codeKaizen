import "server-only";
import { and, asc, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { isUniqueViolation, runBatch } from "@/db/batch";
import {
  announcements,
  answers,
  attempts,
  enrollments,
  examQuestions,
  exams,
  incidents,
  questions,
  scratchpads,
  users,
} from "@/db/schema";
import type { IncidentType } from "@/db/schema/enums";
import type { AnswerResponse, AttemptQuestionSnapshot, ScratchpadData } from "@/db/schema/types";
import type { SessionUser } from "@/lib/auth/dal";
import { examPhase } from "@/lib/exam-phase";
import { ApiError } from "@/lib/http";
import { assertCanManageExam } from "@/lib/permissions";
import { shuffle } from "@/lib/random";
import { isAnswered } from "@/lib/scoring";
import { audit } from "@/services/audit";
import { toCandidateQuestions } from "@/services/exams/candidate-view";
import { GradingService } from "@/services/grading/grading.service";

/**
 * Network grace for in-flight requests. A save that LEAVES the browser before the deadline may
 * arrive a moment later; anything later than this is rejected. Never extends the exam itself.
 */
export const DEADLINE_GRACE_MS = 3_000;

type AttemptRow = typeof attempts.$inferSelect;

export class AttemptService {
  /* ───────────────────────── start / resume ───────────────────────── */

  /**
   * Starts (or resumes) an attempt. The server fixes startedAt and expiresAt; the browser clock is never used.
   * Real attempts: enrolled + window open + attempts left. Sandbox: exam owner, any status, isolated from results.
   */
  static async start(actor: SessionUser, examId: string, opts: { sandbox: boolean }): Promise<{ attemptId: string; resumed: boolean }> {
    const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    if (!exam) throw ApiError.notFound("Exam not found");

    let enrollmentId: string | null = null;
    if (opts.sandbox) {
      await assertCanManageExam(actor, examId);
    } else {
      if (actor.role !== "CANDIDATE") throw ApiError.forbidden("Only candidates can sit examinations");
      const [enr] = await db
        .select({ id: enrollments.id, status: enrollments.status })
        .from(enrollments)
        .where(and(eq(enrollments.examId, examId), eq(enrollments.candidateId, actor.id)))
        .limit(1);
      if (!enr) throw ApiError.notFound("You are not enrolled in this examination");
      if (enr.status !== "ENROLLED") throw ApiError.forbidden(`Your enrolment is ${enr.status.toLowerCase()}`);
      enrollmentId = enr.id;
    }

    // Resume an open attempt rather than starting another (refresh / reconnect / second tab).
    const [open] = await db
      .select({ id: attempts.id, expiresAt: attempts.expiresAt })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.candidateId, actor.id), eq(attempts.status, "IN_PROGRESS")))
      .limit(1);
    if (open) {
      if (Date.now() <= open.expiresAt.getTime() + DEADLINE_GRACE_MS) return { attemptId: open.id, resumed: true };
      await this.finalize(open.id, "AUTO_SUBMITTED");
    }

    if (!opts.sandbox) {
      const phase = examPhase(exam);
      if (phase === "SCHEDULED") throw ApiError.forbidden("This examination has not opened yet");
      if (phase !== "ONGOING") throw ApiError.forbidden("This examination is not open");
      const [used] = await db
        .select({ n: count() })
        .from(attempts)
        .where(and(eq(attempts.examId, examId), eq(attempts.candidateId, actor.id), eq(attempts.isSandbox, false)));
      if ((used?.n ?? 0) >= exam.maxAttempts) throw ApiError.conflict("You have used all permitted attempts");
    }

    const snapshot = await this.buildSnapshot(examId, exam.shuffleQuestions, exam.shuffleOptions);
    if (snapshot.length === 0) throw ApiError.badRequest("This examination has no questions");

    const now = new Date();
    const byDuration = now.getTime() + exam.durationMinutes * 60_000;
    // Real attempts can never run past the exam window; sandbox previews get the full duration.
    const expiresAt = new Date(opts.sandbox ? byDuration : Math.min(byDuration, exam.endsAt.getTime()));
    if (expiresAt.getTime() - now.getTime() < 30_000) throw ApiError.forbidden("Too little time remains in the examination window");

    const [prev] = await db
      .select({ n: count() })
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.candidateId, actor.id)));

    try {
      const [row] = await db
        .insert(attempts)
        .values({
          examId,
          candidateId: actor.id,
          enrollmentId,
          isSandbox: opts.sandbox,
          attemptNumber: (prev?.n ?? 0) + 1,
          questionSnapshot: snapshot,
          startedAt: now,
          expiresAt,
          lastSeenAt: now,
        })
        .returning({ id: attempts.id });
      if (!opts.sandbox) await audit(actor.id, "attempt.start", `${actor.name} started ${exam.code}`, { type: "attempt", id: row!.id });
      return { attemptId: row!.id, resumed: false };
    } catch (err) {
      // Two tabs pressed "Start" at once: the partial unique index lets only one win; return that one.
      if (!isUniqueViolation(err)) throw err;
      const [winner] = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(and(eq(attempts.examId, examId), eq(attempts.candidateId, actor.id), eq(attempts.status, "IN_PROGRESS")))
        .limit(1);
      if (!winner) throw ApiError.conflict("Could not start the attempt. Please retry.");
      return { attemptId: winner.id, resumed: true };
    }
  }

  /** Freezes the paper + marking scheme. Later bank edits never alter an attempt already started. */
  private static async buildSnapshot(examId: string, shuffleQs: boolean, shuffleOpts: boolean): Promise<AttemptQuestionSnapshot[]> {
    const rows = await db
      .select({
        questionId: questions.id,
        type: questions.type,
        prompt: questions.prompt,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        marks: sql<number>`coalesce(${examQuestions.marks}, ${questions.defaultMarks})::float`,
        negativeMarks: questions.negativeMarks,
        multiScoring: questions.multiScoring,
      })
      .from(examQuestions)
      .innerJoin(questions, eq(questions.id, examQuestions.questionId))
      .where(eq(examQuestions.examId, examId))
      .orderBy(asc(examQuestions.position));
    const ordered = shuffleQs ? shuffle(rows) : rows;
    return ordered.map((q, i) => ({
      ...q,
      position: i + 1,
      options:
        q.options && shuffleOpts && q.type !== "TRUE_FALSE" ? shuffle(q.options) : q.options,
    }));
  }

  /* ───────────────────────── read state ───────────────────────── */

  private static async loadOwned(actor: SessionUser, attemptId: string): Promise<AttemptRow> {
    const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
    // 404 (not 403) for someone else's attempt: do not confirm it exists.
    if (!a || a.candidateId !== actor.id) throw ApiError.notFound("Attempt not found");
    return a;
  }

  /** Everything the workspace needs — with answer keys stripped. Also records refresh/recovery. */
  static async getState(actor: SessionUser, attemptId: string, clientSession?: string) {
    let a = await this.loadOwned(actor, attemptId);

    if (a.status === "IN_PROGRESS" && Date.now() > a.expiresAt.getTime() + DEADLINE_GRACE_MS) {
      await this.finalize(a.id, "AUTO_SUBMITTED");
      a = await this.loadOwned(actor, attemptId);
    }

    if (a.status === "IN_PROGRESS" && clientSession) {
      const isRecovery = a.clientSessionId !== null && a.clientSessionId !== clientSession;
      await db
        .update(attempts)
        .set({ clientSessionId: clientSession, lastSeenAt: new Date() })
        .where(eq(attempts.id, a.id));
      if (isRecovery && !a.isSandbox) {
        await this.recordIncident(a, "ATTEMPT_RESUMED", "LOW", {
          note: "Workspace reloaded (refresh, crash or new tab). Deadline unchanged.",
        });
      }
    }

    const [exam] = await db
      .select({ title: exams.title, code: exams.code, instructions: exams.instructions, passPercentage: exams.passPercentage })
      .from(exams)
      .where(eq(exams.id, a.examId))
      .limit(1);

    const saved = await db
      .select({ questionId: answers.questionId, response: answers.response, isFlagged: answers.isFlagged, revision: answers.revision })
      .from(answers)
      .where(eq(answers.attemptId, a.id));

    const notices = await db
      .select({ id: announcements.id, title: announcements.title, body: announcements.body, publishedAt: announcements.publishedAt })
      .from(announcements)
      .where(and(eq(announcements.examId, a.examId), inArray(announcements.audience, ["ALL", "CANDIDATES"])))
      .orderBy(desc(announcements.publishedAt))
      .limit(20);

    const questionsSafe = toCandidateQuestions(a.questionSnapshot);
    const answeredCount = saved.filter((s) => isAnswered(s.response)).length;

    return {
      serverNow: new Date().toISOString(),
      attempt: {
        id: a.id,
        status: a.status,
        isSandbox: a.isSandbox,
        startedAt: a.startedAt.toISOString(),
        expiresAt: a.expiresAt.toISOString(),
        submittedAt: a.submittedAt?.toISOString() ?? null,
      },
      exam: exam!,
      questions: questionsSafe,
      answers: Object.fromEntries(
        saved.map((s) => [s.questionId, { response: s.response, flagged: s.isFlagged, revision: s.revision }]),
      ),
      announcements: notices.map((n) => ({ ...n, publishedAt: n.publishedAt.toISOString() })),
      summary: { answered: answeredCount, total: questionsSafe.length },
      // Sandbox previews show the examiner the auto-marked score immediately; real candidates never see it here.
      sandboxScore: a.isSandbox && a.status !== "IN_PROGRESS" ? await GradingService.previewScore(a.id) : null,
    };
  }

  /* ───────────────────────── save answers ───────────────────────── */

  /**
   * Idempotent, order-safe saves: each answer carries a client revision and a row is only
   * overwritten by a HIGHER revision, so retries and out-of-order deliveries cannot regress an answer.
   */
  static async saveAnswers(
    actor: SessionUser,
    attemptId: string,
    input: { clientSessionId?: string; answers: { questionId: string; response: AnswerResponse | null; flagged: boolean; revision: number }[] },
  ) {
    const a = await this.loadOwned(actor, attemptId);
    if (a.status !== "IN_PROGRESS") throw new ApiError(409, "ATTEMPT_CLOSED", "This attempt has already been submitted");
    if (Date.now() > a.expiresAt.getTime() + DEADLINE_GRACE_MS) {
      if (!a.isSandbox) {
        await this.recordIncident(a, "LATE_ANSWER_REJECTED", "LOW", { count: input.answers.length });
      }
      await this.finalize(a.id, "AUTO_SUBMITTED");
      throw new ApiError(409, "DEADLINE_PASSED", "Time is up. Answers received after the deadline were not accepted.");
    }

    const byId = new Map(a.questionSnapshot.map((q) => [q.questionId, q]));
    for (const ans of input.answers) {
      const q = byId.get(ans.questionId);
      if (!q) throw ApiError.badRequest("Answer refers to a question that is not in this attempt");
      if (ans.response === null) continue;
      const isChoice = q.type === "MCQ_SINGLE" || q.type === "MCQ_MULTI" || q.type === "TRUE_FALSE";
      if (isChoice) {
        if (!("optionIds" in ans.response)) throw ApiError.badRequest("Choice questions need option ids");
        const allowed = new Set((q.options ?? []).map((o) => o.id));
        if (ans.response.optionIds.some((id) => !allowed.has(id))) throw ApiError.badRequest("Unknown option selected");
        if (q.type !== "MCQ_MULTI" && ans.response.optionIds.length > 1) throw ApiError.badRequest("Only one option may be selected");
      } else if (!("text" in ans.response)) throw ApiError.badRequest("Written questions need a text answer");
    }

    const now = new Date();
    await runBatch([
      db
        .insert(answers)
        .values(
          input.answers.map((x) => ({
            attemptId: a.id,
            questionId: x.questionId,
            response: x.response,
            isFlagged: x.flagged,
            revision: x.revision,
          })),
        )
        .onConflictDoUpdate({
          target: [answers.attemptId, answers.questionId],
          set: {
            response: sql`excluded.response`,
            isFlagged: sql`excluded.is_flagged`,
            revision: sql`excluded.revision`,
            updatedAt: now,
          },
          setWhere: sql`${answers.revision} < excluded.revision`,
        }),
      db
        .update(attempts)
        .set({ lastSeenAt: now, ...(input.clientSessionId ? { clientSessionId: input.clientSessionId } : {}) })
        .where(eq(attempts.id, a.id)),
    ]);

    const current = await db
      .select({ questionId: answers.questionId, revision: answers.revision })
      .from(answers)
      .where(and(eq(answers.attemptId, a.id), inArray(answers.questionId, input.answers.map((x) => x.questionId))));

    return {
      serverNow: now.toISOString(),
      expiresAt: a.expiresAt.toISOString(),
      // Server's revision per question; the client clears anything at or below it from its pending queue.
      revisions: Object.fromEntries(current.map((c) => [c.questionId, c.revision])),
    };
  }

  /* ───────────────────────── submit / finalize ───────────────────────── */

  /** Idempotent: a second submit returns the existing outcome (and is logged) instead of failing or regrading. */
  static async submit(actor: SessionUser, attemptId: string) {
    const a = await this.loadOwned(actor, attemptId);
    if (a.status !== "IN_PROGRESS") {
      if (!a.isSandbox) await this.recordIncident(a, "DUPLICATE_SUBMISSION", "LOW", { note: "Submit received for an attempt that was already finalised" });
      return { status: a.status, alreadySubmitted: true };
    }
    const late = Date.now() > a.expiresAt.getTime() + DEADLINE_GRACE_MS;
    const outcome = await this.finalize(a.id, late ? "AUTO_SUBMITTED" : "SUBMITTED");
    if (outcome.alreadyFinal && !a.isSandbox) {
      await this.recordIncident(a, "DUPLICATE_SUBMISSION", "LOW", { note: "Concurrent submit requests" });
    }
    const [after] = await db.select({ status: attempts.status }).from(attempts).where(eq(attempts.id, a.id)).limit(1);
    if (!a.isSandbox) await audit(actor.id, "attempt.submit", `${actor.name} submitted an attempt${late ? " (deadline)" : ""}`, { type: "attempt", id: a.id });
    return { status: after!.status, alreadySubmitted: outcome.alreadyFinal };
  }

  /**
   * The ONLY state transition out of IN_PROGRESS. The conditional UPDATE … WHERE status='IN_PROGRESS'
   * guarantees exactly one caller wins, even with concurrent submits, polls and deadline sweeps.
   */
  static async finalize(attemptId: string, status: "SUBMITTED" | "AUTO_SUBMITTED"): Promise<{ alreadyFinal: boolean }> {
    const [row] = await db
      .update(attempts)
      .set({ status, submittedAt: new Date() })
      .where(and(eq(attempts.id, attemptId), eq(attempts.status, "IN_PROGRESS")))
      .returning();
    if (!row) return { alreadyFinal: true };
    if (status === "AUTO_SUBMITTED" && !row.isSandbox) {
      await this.recordIncident(row, "AUTO_SUBMITTED", "LOW", { note: "Finalised automatically at the server deadline" });
    }
    await GradingService.gradeAttempt(attemptId);
    return { alreadyFinal: false };
  }

  /** Lazy deadline enforcement (no cron needed): finalises every attempt whose server deadline has passed. */
  static async finalizeExpired(scope: { examId?: string; candidateId?: string } = {}) {
    const cutoff = new Date(Date.now() - DEADLINE_GRACE_MS);
    const due = await db
      .select({ id: attempts.id })
      .from(attempts)
      .where(
        and(
          eq(attempts.status, "IN_PROGRESS"),
          lt(attempts.expiresAt, cutoff),
          scope.examId ? eq(attempts.examId, scope.examId) : undefined,
          scope.candidateId ? eq(attempts.candidateId, scope.candidateId) : undefined,
        ),
      )
      .limit(200);
    for (const d of due) await this.finalize(d.id, "AUTO_SUBMITTED");
    return due.length;
  }

  /* ───────────────────────── incidents ───────────────────────── */

  static async recordIncident(
    a: Pick<AttemptRow, "id" | "examId" | "candidateId">,
    type: IncidentType,
    severity: "LOW" | "MEDIUM" | "HIGH",
    details: Record<string, unknown>,
  ) {
    await db.insert(incidents).values({ attemptId: a.id, examId: a.examId, candidateId: a.candidateId, type, severity, details });
  }

  /** Browser-reported connectivity events. Repeated losses are raised to MEDIUM for review — not treated as misconduct. */
  static async reportClientEvent(
    actor: SessionUser,
    attemptId: string,
    event: { type: "NETWORK_LOSS" | "RECONNECTED" | "SYNC_FAILED"; details: Record<string, unknown> },
  ) {
    const a = await this.loadOwned(actor, attemptId);
    await db.update(attempts).set({ lastSeenAt: new Date() }).where(eq(attempts.id, a.id));
    if (a.isSandbox) return { recorded: false };
    let severity: "LOW" | "MEDIUM" = "LOW";
    if (event.type === "NETWORK_LOSS") {
      const [prev] = await db
        .select({ n: count() })
        .from(incidents)
        .where(and(eq(incidents.attemptId, a.id), eq(incidents.type, "NETWORK_LOSS")));
      if ((prev?.n ?? 0) >= 2) severity = "MEDIUM";
    }
    await this.recordIncident(a, event.type, severity, { ...event.details, source: "browser" });
    return { recorded: true };
  }

  /* ───────────────────────── scratchpad (never mixed with answers) ───────────────────────── */

  static async getScratchpad(actor: SessionUser, attemptId: string): Promise<ScratchpadData | null> {
    const a = await this.loadOwned(actor, attemptId);
    const [row] = await db.select({ data: scratchpads.data }).from(scratchpads).where(eq(scratchpads.attemptId, a.id)).limit(1);
    return row?.data ?? null;
  }

  static async saveScratchpad(actor: SessionUser, attemptId: string, data: ScratchpadData) {
    const a = await this.loadOwned(actor, attemptId);
    if (a.status !== "IN_PROGRESS") throw new ApiError(409, "ATTEMPT_CLOSED", "The scratchpad is read-only after submission");
    await db
      .insert(scratchpads)
      .values({ attemptId: a.id, data })
      .onConflictDoUpdate({ target: scratchpads.attemptId, set: { data, updatedAt: new Date() } });
  }

  /* ───────────────────────── monitoring ───────────────────────── */

  /** Live view of an exam's real attempts (sandbox excluded) with progress and incident counts. */
  static async monitor(actor: SessionUser, examId: string) {
    await assertCanManageExam(actor, examId);
    await this.finalizeExpired({ examId });
    const rows = await db
      .select({
        id: attempts.id,
        candidateId: attempts.candidateId,
        candidateName: users.name,
        candidateEmail: users.email,
        status: attempts.status,
        startedAt: attempts.startedAt,
        expiresAt: attempts.expiresAt,
        submittedAt: attempts.submittedAt,
        lastSeenAt: attempts.lastSeenAt,
        total: sql<number>`jsonb_array_length(${attempts.questionSnapshot})::int`,
        answered: sql<number>`(select count(*)::int from ${answers} where ${answers.attemptId} = ${attempts.id}
          and ${answers.response} is not null
          and (coalesce(jsonb_array_length(${answers.response}->'optionIds'), 0) > 0
               or length(trim(coalesce(${answers.response}->>'text', ''))) > 0))`,
        flagged: sql<number>`(select count(*)::int from ${answers} where ${answers.attemptId} = ${attempts.id} and ${answers.isFlagged})`,
        incidentCount: sql<number>`(select count(*)::int from ${incidents} where ${incidents.attemptId} = ${attempts.id})`,
        attentionCount: sql<number>`(select count(*)::int from ${incidents} where ${incidents.attemptId} = ${attempts.id} and ${incidents.severity} <> 'LOW')`,
      })
      .from(attempts)
      .innerJoin(users, eq(users.id, attempts.candidateId))
      .where(and(eq(attempts.examId, examId), eq(attempts.isSandbox, false)))
      .orderBy(desc(attempts.startedAt));
    return rows;
  }

  static async incidentsFor(actor: SessionUser, scope: { examId: string; attemptId?: string }) {
    await assertCanManageExam(actor, scope.examId);
    return db
      .select({
        id: incidents.id,
        attemptId: incidents.attemptId,
        candidateId: incidents.candidateId,
        type: incidents.type,
        severity: incidents.severity,
        details: incidents.details,
        occurredAt: incidents.occurredAt,
      })
      .from(incidents)
      .innerJoin(attempts, eq(attempts.id, incidents.attemptId))
      .where(
        and(
          eq(incidents.examId, scope.examId),
          eq(attempts.isSandbox, false),
          scope.attemptId ? eq(incidents.attemptId, scope.attemptId) : undefined,
        ),
      )
      .orderBy(desc(incidents.occurredAt))
      .limit(300);
  }

  /** Examiner's view of one attempt: per-question status from the frozen snapshot plus incidents. */
  static async detailForExaminer(actor: SessionUser, attemptId: string) {
    const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId)).limit(1);
    if (!a || a.isSandbox) throw ApiError.notFound("Attempt not found");
    await assertCanManageExam(actor, a.examId);
    const rows = await db.select().from(answers).where(eq(answers.attemptId, a.id));
    const byQ = new Map(rows.map((r) => [r.questionId, r]));
    return {
      attempt: a,
      questions: [...a.questionSnapshot]
        .sort((x, y) => x.position - y.position)
        .map((q) => ({ q, answer: byQ.get(q.questionId) ?? null })),
    };
  }
}

