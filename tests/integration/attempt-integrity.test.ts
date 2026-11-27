import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { answers, attempts, enrollments, incidents, questions, results } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { AttemptService } from "@/services/attempts/attempt.service";
import { ExamService } from "@/services/exams/exam.service";
import { createOpenExam, createWorld, destroyWorld, type World } from "../helpers/world";

let w: World;
beforeAll(async () => {
  w = await createWorld("ai");
});
afterAll(async () => destroyWorld(w));

const err = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof ApiError) return { status: e.status, code: e.code, message: e.message };
    throw e;
  }
};

describe("eligibility to start", () => {
  it("unenrolled → 404, draft → 403, not yet open → 403, blocked enrolment → 403, staff cannot sit", async () => {
    const draft = await createOpenExam(w, { publish: false });
    expect((await err(AttemptService.start(w.users.c3, draft, { sandbox: false })))?.status).toBe(404);
    expect((await err(AttemptService.start(w.users.c1, draft, { sandbox: false })))?.status).toBe(403);

    const future = await createOpenExam(w, { startsAt: new Date(Date.now() + 3600_000), endsAt: new Date(Date.now() + 7200_000) });
    expect(await err(AttemptService.start(w.users.c1, future, { sandbox: false }))).toMatchObject({ status: 403, message: expect.stringMatching(/not opened/) });

    const open = await createOpenExam(w);
    await db.update(enrollments).set({ status: "BLOCKED" }).where(and(eq(enrollments.examId, open), eq(enrollments.candidateId, w.users.c2.id)));
    expect(await err(AttemptService.start(w.users.c2, open, { sandbox: false }))).toMatchObject({ status: 403, message: expect.stringMatching(/blocked/) });
    expect((await err(AttemptService.start(w.users.ex1, open, { sandbox: false })))?.status).toBe(403);
  });

  it("attempt limit is enforced", async () => {
    const id = await createOpenExam(w, { maxAttempts: 1 });
    const { attemptId } = await AttemptService.start(w.users.c1, id, { sandbox: false });
    await AttemptService.submit(w.users.c1, attemptId);
    expect((await err(AttemptService.start(w.users.c1, id, { sandbox: false })))?.status).toBe(409);
  });

  it("a candidate starting late gets only what is left of the window (server-capped deadline)", async () => {
    const endsAt = new Date(Date.now() + 5 * 60_000);
    const id = await createOpenExam(w, { endsAt, durationMinutes: 4 });
    // window ends in 5 min, duration 4 → deadline ≈ now + 4 min
    const { attemptId } = await AttemptService.start(w.users.c1, id, { sandbox: false });
    const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    expect(a!.expiresAt.getTime() - a!.startedAt.getTime()).toBe(4 * 60_000);
    expect(a!.expiresAt.getTime()).toBeLessThanOrEqual(endsAt.getTime());
  });
});

describe("start / resume / concurrency", () => {
  let examId: string;
  beforeAll(async () => {
    examId = await createOpenExam(w, { shuffle: true });
  });

  it("parallel start requests create exactly one attempt", async () => {
    const res = await Promise.all(Array.from({ length: 5 }, () => AttemptService.start(w.users.c2, examId, { sandbox: false })));
    expect(new Set(res.map((r) => r.attemptId)).size).toBe(1);
    const rows = await db.select().from(attempts).where(and(eq(attempts.examId, examId), eq(attempts.candidateId, w.users.c2.id)));
    expect(rows.length).toBe(1);
  });

  it("resuming does not change the deadline (refresh cannot add time)", async () => {
    const { attemptId } = await AttemptService.start(w.users.c2, examId, { sandbox: false });
    const [before] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    const again = await AttemptService.start(w.users.c2, examId, { sandbox: false });
    await AttemptService.getState(w.users.c2, attemptId, "sessionNew0001");
    const [after] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    expect(again).toEqual({ attemptId, resumed: true });
    expect(after!.expiresAt.getTime()).toBe(before!.expiresAt.getTime());
    expect(after!.startedAt.getTime()).toBe(before!.startedAt.getTime());
  });

  it("candidate state never contains answer keys", async () => {
    const { attemptId } = await AttemptService.start(w.users.c2, examId, { sandbox: false });
    const s = await AttemptService.getState(w.users.c2, attemptId);
    expect(s.questions).toHaveLength(4);
    expect(JSON.stringify(s.questions)).not.toMatch(/correctAnswer|accepted|negativeMarks|Paris/);
  });

  it("the question snapshot is frozen: editing the bank after start does not change the attempt", async () => {
    const { attemptId } = await AttemptService.start(w.users.c2, examId, { sandbox: false });
    await db.update(questions).set({ prompt: "CHANGED AFTER START", correctAnswer: { optionIds: ["a"] } }).where(eq(questions.id, w.questions.single.id));
    const s = await AttemptService.getState(w.users.c2, attemptId);
    expect(s.questions.find((q) => q.questionId === w.questions.single.id)!.prompt).toContain("single: pick B");
    const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    expect(a!.questionSnapshot.find((q) => q.questionId === w.questions.single.id)!.correctAnswer).toEqual({ optionIds: ["b"] });
    await db.update(questions).set({ prompt: `IT ${w.run} single: pick B`, correctAnswer: { optionIds: ["b"] } }).where(eq(questions.id, w.questions.single.id));
  });

  it("another candidate cannot read, write, submit or report events on this attempt (404)", async () => {
    const { attemptId } = await AttemptService.start(w.users.c2, examId, { sandbox: false });
    const save = { answers: [{ questionId: w.questions.short.id, response: { text: "x" }, flagged: false, revision: 99 }] };
    expect((await err(AttemptService.getState(w.users.c1, attemptId)))?.status).toBe(404);
    expect((await err(AttemptService.saveAnswers(w.users.c1, attemptId, save)))?.status).toBe(404);
    expect((await err(AttemptService.submit(w.users.c1, attemptId)))?.status).toBe(404);
    expect((await err(AttemptService.reportClientEvent(w.users.c1, attemptId, { type: "NETWORK_LOSS", details: {} })))?.status).toBe(404);
    expect((await err(AttemptService.getScratchpad(w.users.ex1, attemptId)))?.status).toBe(404);
  });
});

describe("answer saving", () => {
  let examId: string;
  let attemptId: string;
  beforeAll(async () => {
    examId = await createOpenExam(w);
    ({ attemptId } = await AttemptService.start(w.users.c1, examId, { sandbox: false }));
  });
  const save = (questionId: string, response: unknown, revision: number, flagged = false) =>
    AttemptService.saveAnswers(w.users.c1, attemptId, { answers: [{ questionId, response: response as never, flagged, revision }] });

  it("persists answers and flags", async () => {
    await save(w.questions.short.id, { text: "Paris" }, 1, true);
    const [row] = await db.select().from(answers).where(and(eq(answers.attemptId, attemptId), eq(answers.questionId, w.questions.short.id)));
    expect(row).toMatchObject({ response: { text: "Paris" }, isFlagged: true, revision: 1 });
  });

  it("out-of-order and concurrent saves: the highest revision always wins", async () => {
    const revs = [3, 9, 1, 7, 10, 2, 8, 5, 4, 6];
    await Promise.all(revs.map((r) => save(w.questions.single.id, { optionIds: [r === 10 ? "b" : "a"] }, r)));
    const [row] = await db.select().from(answers).where(and(eq(answers.attemptId, attemptId), eq(answers.questionId, w.questions.single.id)));
    expect(row).toMatchObject({ revision: 10, response: { optionIds: ["b"] } });
    const rows = await db.select().from(answers).where(eq(answers.attemptId, attemptId));
    expect(rows.filter((r) => r.questionId === w.questions.single.id)).toHaveLength(1);
  });

  it("a retried (identical) save is idempotent", async () => {
    const r1 = await save(w.questions.multi.id, { optionIds: ["a", "c"] }, 5);
    const r2 = await save(w.questions.multi.id, { optionIds: ["a", "c"] }, 5);
    expect(r1.revisions[w.questions.multi.id]).toBe(5);
    expect(r2.revisions[w.questions.multi.id]).toBe(5);
  });

  it("rejects manipulated payloads", async () => {
    expect((await err(save("00000000-0000-4000-8000-000000000000", { text: "x" }, 50)))?.status).toBe(400);
    expect((await err(save(w.questions.single.id, { optionIds: ["z"] }, 50)))?.status).toBe(400);
    expect((await err(save(w.questions.single.id, { optionIds: ["a", "b"] }, 50)))?.status).toBe(400);
    expect((await err(save(w.questions.single.id, { text: "B" }, 50)))?.status).toBe(400);
    expect((await err(save(w.questions.essay.id, { optionIds: ["a"] }, 50)))?.status).toBe(400);
  });

  it("scratchpad is stored separately and never changes answers", async () => {
    const before = await db.select().from(answers).where(eq(answers.attemptId, attemptId));
    await AttemptService.saveScratchpad(w.users.c1, attemptId, { pages: [{ id: "p1", title: "P1", notes: "Paris?", strokes: [{ points: [[0.1, 0.2]], width: 2 }] }] });
    expect((await AttemptService.getScratchpad(w.users.c1, attemptId))?.pages[0]!.notes).toBe("Paris?");
    const after = await db.select().from(answers).where(eq(answers.attemptId, attemptId));
    expect(after).toEqual(before);
  });
});

describe("deadline, submission and incidents", () => {
  it("answers after the server deadline are rejected and the attempt is auto-finalised once", async () => {
    const examId = await createOpenExam(w);
    const { attemptId } = await AttemptService.start(w.users.c1, examId, { sandbox: false });
    await AttemptService.saveAnswers(w.users.c1, attemptId, { answers: [{ questionId: w.questions.short.id, response: { text: "Paris" }, flagged: false, revision: 1 }] });
    await db.update(attempts).set({ startedAt: new Date(Date.now() - 40 * 60_000), expiresAt: new Date(Date.now() - 60_000) }).where(eq(attempts.id, attemptId));
    const late = await err(AttemptService.saveAnswers(w.users.c1, attemptId, { answers: [{ questionId: w.questions.short.id, response: { text: "London" }, flagged: false, revision: 2 }] }));
    expect(late).toMatchObject({ status: 409, code: "DEADLINE_PASSED" });
    const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    expect(["AUTO_SUBMITTED", "GRADED"]).toContain(a!.status);
    const [ans] = await db.select().from(answers).where(and(eq(answers.attemptId, attemptId), eq(answers.questionId, w.questions.short.id)));
    expect(ans!.response).toEqual({ text: "Paris" });
    const inc = await db.select().from(incidents).where(eq(incidents.attemptId, attemptId));
    expect(inc.map((i) => i.type).sort()).toEqual(["AUTO_SUBMITTED", "LATE_ANSWER_REJECTED"]);
  });

  it("finalizeExpired sweeps attempts nobody touched", async () => {
    const examId = await createOpenExam(w);
    const { attemptId } = await AttemptService.start(w.users.c2, examId, { sandbox: false });
    await db.update(attempts).set({ startedAt: new Date(Date.now() - 40 * 60_000), expiresAt: new Date(Date.now() - 10_000) }).where(eq(attempts.id, attemptId));
    expect(await AttemptService.finalizeExpired({ examId })).toBe(1);
    expect(await AttemptService.finalizeExpired({ examId })).toBe(0);
  });

  it("concurrent submits: exactly one wins, one result row, duplicates logged", async () => {
    const examId = await createOpenExam(w);
    const { attemptId } = await AttemptService.start(w.users.c1, examId, { sandbox: false });
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => AttemptService.submit(w.users.c1, attemptId)));
    expect(outcomes.filter((o) => !o.alreadySubmitted)).toHaveLength(1);
    expect((await db.select().from(results).where(eq(results.attemptId, attemptId))).length).toBe(1);
    const dups = await db.select().from(incidents).where(and(eq(incidents.attemptId, attemptId), eq(incidents.type, "DUPLICATE_SUBMISSION")));
    expect(dups.length).toBe(4);
    expect((await err(AttemptService.saveAnswers(w.users.c1, attemptId, { answers: [{ questionId: w.questions.short.id, response: { text: "x" }, flagged: false, revision: 9 }] })))?.code).toBe("ATTEMPT_CLOSED");
  });

  it("connectivity indicators: repeated loss escalates to MEDIUM; reload records ATTEMPT_RESUMED", async () => {
    const examId = await createOpenExam(w);
    const { attemptId } = await AttemptService.start(w.users.c2, examId, { sandbox: false });
    for (let i = 0; i < 3; i++) await AttemptService.reportClientEvent(w.users.c2, attemptId, { type: "NETWORK_LOSS", details: { offlineSeconds: 4 } });
    await AttemptService.getState(w.users.c2, attemptId, "sessionAAAA0001");
    await AttemptService.getState(w.users.c2, attemptId, "sessionAAAA0001"); // same tab polling: no new incident
    await AttemptService.getState(w.users.c2, attemptId, "sessionBBBB0002"); // reload / new tab
    const inc = await db.select().from(incidents).where(eq(incidents.attemptId, attemptId));
    expect(inc.filter((i) => i.type === "NETWORK_LOSS").map((i) => i.severity)).toEqual(expect.arrayContaining(["LOW", "MEDIUM"]));
    expect(inc.filter((i) => i.type === "ATTEMPT_RESUMED")).toHaveLength(1);
    const mon = await AttemptService.monitor(w.users.ex1, examId);
    expect(mon[0]).toMatchObject({ incidentCount: 4, attentionCount: 1 });
  });
});

describe("sandbox isolation", () => {
  it("examiner preview attempts never create results and are excluded from monitoring", async () => {
    const examId = await createOpenExam(w, { publish: false });
    const { attemptId } = await AttemptService.start(w.users.ex1, examId, { sandbox: true });
    await AttemptService.saveAnswers(w.users.ex1, attemptId, { answers: [{ questionId: w.questions.single.id, response: { optionIds: ["b"] }, flagged: false, revision: 1 }] });
    await AttemptService.reportClientEvent(w.users.ex1, attemptId, { type: "NETWORK_LOSS", details: {} });
    await AttemptService.submit(w.users.ex1, attemptId);
    const s = await AttemptService.getState(w.users.ex1, attemptId);
    expect(s.sandboxScore).toMatchObject({ score: 2, manualPending: 0 });
    expect(await db.select().from(results).where(eq(results.attemptId, attemptId))).toHaveLength(0);
    expect(await db.select().from(incidents).where(eq(incidents.attemptId, attemptId))).toHaveLength(0);
    expect(await AttemptService.monitor(w.users.ex1, examId)).toHaveLength(0);
    expect((await ExamService.getForExaminer(w.users.ex1, examId)).attemptCount).toBe(0);
  });
  it("other examiners cannot sandbox someone else's exam", async () => {
    const examId = await createOpenExam(w, { publish: false });
    expect((await err(AttemptService.start(w.users.ex2, examId, { sandbox: true })))?.status).toBe(404);
  });
});
