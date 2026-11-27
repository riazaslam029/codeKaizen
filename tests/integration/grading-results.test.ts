import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { announcements, attempts, results } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { renderResultPdf } from "@/services/reports/pdf";
import { AttemptService } from "@/services/attempts/attempt.service";
import { GradingService } from "@/services/grading/grading.service";
import { ResultsService } from "@/services/results/results.service";
import { createOpenExam, createWorld, destroyWorld, type World } from "../helpers/world";

let w: World;
let examId: string;
let a1: string; // c1: everything correct + essay
let a2: string; // c2: wrong single (penalty), partial multi, blank essay
let a3: string; // sandbox

beforeAll(async () => {
  w = await createWorld("gr");
  examId = await createOpenExam(w);
  const q = w.questions;
  ({ attemptId: a1 } = await AttemptService.start(w.users.c1, examId, { sandbox: false }));
  await AttemptService.saveAnswers(w.users.c1, a1, {
    answers: [
      { questionId: q.single.id, response: { optionIds: ["b"] }, flagged: false, revision: 1 },
      { questionId: q.multi.id, response: { optionIds: ["a", "c"] }, flagged: false, revision: 1 },
      { questionId: q.short.id, response: { text: " paris " }, flagged: false, revision: 1 },
      { questionId: q.essay.id, response: { text: "A thoughtful essay." }, flagged: false, revision: 1 },
    ],
  });
  await AttemptService.submit(w.users.c1, a1);
  ({ attemptId: a2 } = await AttemptService.start(w.users.c2, examId, { sandbox: false }));
  await AttemptService.saveAnswers(w.users.c2, a2, {
    answers: [
      { questionId: q.single.id, response: { optionIds: ["a"] }, flagged: false, revision: 1 },
      { questionId: q.multi.id, response: { optionIds: ["a"] }, flagged: false, revision: 1 },
    ],
  });
  await AttemptService.submit(w.users.c2, a2);
  ({ attemptId: a3 } = await AttemptService.start(w.users.ex1, examId, { sandbox: true }));
  await AttemptService.submit(w.users.ex1, a3);
});
afterAll(async () => destroyWorld(w));

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof ApiError) return e.status;
    throw e;
  }
};
const result = async (attemptId: string) => (await db.select().from(results).where(eq(results.attemptId, attemptId)))[0]!;

describe("automatic grading from the frozen marking scheme", () => {
  it("all-correct candidate: auto marks = 2 + 4 + 1, essay pending → SUBMITTED", async () => {
    const r = await result(a1);
    expect(r).toMatchObject({ score: 7, maxScore: 17 });
    expect((await db.select().from(attempts).where(eq(attempts.id, a1)))[0]!.status).toBe("SUBMITTED");
  });
  it("penalty + partial credit + blank essay → (−0.5 + 2 + 0 + 0) = 1.5, fully auto-graded", async () => {
    const r = await result(a2);
    expect(r).toMatchObject({ score: 1.5, maxScore: 17, passed: false });
    expect(r.percentage).toBeCloseTo((1.5 / 17) * 100, 2);
    expect((await db.select().from(attempts).where(eq(attempts.id, a2)))[0]!.status).toBe("GRADED");
  });
});

describe("manual grading", () => {
  it("rejects marks outside 0..max, other examiners, and in-progress attempts", async () => {
    expect(await status(GradingService.gradeAnswer(w.users.ex1, { attemptId: a1, questionId: w.questions.essay.id, marks: 11, feedback: "" }))).toBe(400);
    expect(await status(GradingService.gradeAnswer(w.users.ex1, { attemptId: a1, questionId: w.questions.essay.id, marks: -1, feedback: "" }))).toBe(400);
    expect(await status(GradingService.gradeAnswer(w.users.ex2, { attemptId: a1, questionId: w.questions.essay.id, marks: 5, feedback: "" }))).toBe(404);
    expect(await status(GradingService.gradeAnswer(w.users.ex1, { attemptId: a3, questionId: w.questions.essay.id, marks: 5, feedback: "" }))).toBe(404);
  });
  it("valid mark completes grading with an exact total", async () => {
    const g = await GradingService.gradeAnswer(w.users.ex1, { attemptId: a1, questionId: w.questions.essay.id, marks: 8.5, feedback: "Good" });
    expect(g).toMatchObject({ score: 15.5, maxScore: 17, pending: 0, passed: true });
    expect(g!.percentage).toBe(91.18);
  });
  it("examiners can correct an auto mark before publication (override is preserved on regrade)", async () => {
    await GradingService.gradeAnswer(w.users.ex1, { attemptId: a2, questionId: w.questions.single.id, marks: 0, feedback: "Penalty waived" });
    await GradingService.gradeAttempt(a2);
    expect((await result(a2)).score).toBe(2);
  });
});

describe("publication, reports and verification", () => {
  it("publishes only graded results, issues unique codes and locks grades", async () => {
    const pub = await GradingService.publishResults(w.users.ex1, examId);
    expect(pub).toEqual({ published: 2, awaitingGrading: 0 });
    const [r1, r2] = [await result(a1), await result(a2)];
    expect(r1.status).toBe("PUBLISHED");
    expect(r1.verificationCode).not.toBe(r2.verificationCode);
    expect(await status(GradingService.gradeAnswer(w.users.ex1, { attemptId: a1, questionId: w.questions.essay.id, marks: 1, feedback: "" }))).toBe(409);
    expect(await GradingService.publishResults(w.users.ex1, examId)).toEqual({ published: 0, awaitingGrading: 0 });
    expect(await db.select().from(results).where(eq(results.attemptId, a3))).toHaveLength(0);
  });
  it("candidates see only their own published results; breakdown has no answer keys", async () => {
    const mine = await ResultsService.candidateResults(w.users.c1.id);
    expect(mine).toHaveLength(1);
    const r1 = await result(a1);
    const bd = await ResultsService.candidateBreakdown(w.users.c1, r1.id);
    expect(bd.find((b) => b.type === "ESSAY")).toMatchObject({ awarded: 8.5, feedback: "Good" });
    expect(JSON.stringify(bd)).not.toMatch(/correctAnswer|accepted/);
    expect(await status(ResultsService.candidateBreakdown(w.users.c2, r1.id))).toBe(404);
  });
  it("report access matrix: own candidate, owning examiner, admin — nobody else", async () => {
    const id = (await result(a1)).id;
    expect(await status(ResultsService.forReport(w.users.c1, id))).toBe(200);
    expect(await status(ResultsService.forReport(w.users.ex1, id))).toBe(200);
    expect(await status(ResultsService.forReport(w.users.admin, id))).toBe(200);
    expect(await status(ResultsService.forReport(w.users.c2, id))).toBe(404);
    expect(await status(ResultsService.forReport(w.users.ex2, id))).toBe(404);
  });
  it("generates a real PDF from the stored result", async () => {
    const r = await ResultsService.forReport(w.users.c1, (await result(a1)).id);
    const bytes = await renderResultPdf({ ...r, verificationCode: r.verificationCode!, verifyUrl: "https://example.test/verify/x", publishedAt: r.publishedAt! });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });
  it("public verification reveals only masked, minimal data", async () => {
    const v = await ResultsService.verify((await result(a1)).verificationCode!.toLowerCase());
    expect(v).toMatchObject({ candidate: "Cara C.", outcome: "Pass" });
    expect(JSON.stringify(v)).not.toMatch(/@|it\.test|[0-9a-f]{8}-[0-9a-f]{4}/);
    expect(await ResultsService.verify("CKZ-AAAA-BBBB-CCCC")).toBeNull();
    expect(await ResultsService.verify("'; drop table results; --")).toBeNull();
  });
});

describe("summaries, analytics and announcements", () => {
  it("exam summary uses real rows only (sandbox excluded)", async () => {
    const s = await ResultsService.examSummary(w.users.ex1, examId);
    expect(s.stats).toMatchObject({ count: 2, passed: 1, published: 2, highest: 91.18 });
    expect(await status(ResultsService.examSummary(w.users.ex2, examId))).toBe(404);
  });
  it("question analytics: two real attempts, skipped essay counted", async () => {
    const qa = await ResultsService.questionAnalytics(w.users.ex1, examId);
    expect(qa.attempts).toBe(2);
    const essay = qa.questions.find((q) => q.questionId === w.questions.essay.id)!;
    expect(essay).toMatchObject({ answered: 1, skipped: 1 });
    const single = qa.questions.find((q) => q.questionId === w.questions.single.id)!;
    expect(single.commonWrong).toEqual({ text: "A", count: 1 });
  });
  it("announcements are delivered inside the candidate's attempt state", async () => {
    const id = await createOpenExam(w);
    const { attemptId } = await AttemptService.start(w.users.c1, id, { sandbox: false });
    await db.insert(announcements).values({ examId: id, authorId: w.users.ex1.id, title: "Q2 fixed", body: "Option C typo corrected", audience: "CANDIDATES" });
    const s = await AttemptService.getState(w.users.c1, attemptId);
    expect(s.announcements[0]).toMatchObject({ title: "Q2 fixed" });
  });
});
