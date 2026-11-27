import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { examQuestions, exams, users } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { assertCanAccessCandidate, assertCanManageExam } from "@/lib/permissions";
import { AttemptService } from "@/services/attempts/attempt.service";
import { EnrollmentService, ExamService } from "@/services/exams/exam.service";
import { QuestionService } from "@/services/questions/question.service";
import { UserService } from "@/services/users/user.service";
import { createOpenExam, createWorld, destroyWorld, PASSWORD, type World } from "../helpers/world";

let w: World;
beforeAll(async () => {
  w = await createWorld("ue");
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

describe("authentication against the database", () => {
  it("valid credentials (email case-insensitive) return the user without a hash", async () => {
    const u = await UserService.authenticate(w.users.c1.email.toUpperCase(), PASSWORD);
    expect(u).toMatchObject({ id: w.users.c1.id, role: "CANDIDATE" });
    expect(u).not.toHaveProperty("passwordHash");
  });
  it("wrong password and unknown email both return null", async () => {
    expect(await UserService.authenticate(w.users.c1.email, "wrong-password")).toBeNull();
    expect(await UserService.authenticate(`nobody-${w.run}@it.test`, PASSWORD)).toBeNull();
  });
  it("records last sign-in time", async () => {
    const [row] = await db.select({ t: users.lastLoginAt }).from(users).where(eq(users.id, w.users.c1.id));
    expect(row!.t).toBeInstanceOf(Date);
  });
});

describe("user administration", () => {
  it("admin creates a user; duplicate email (any case) is a 409", async () => {
    const email = `it-${w.run}-new@it.test`;
    const u = await UserService.create(w.users.admin, { name: "New Person", email, role: "EXAMINER", password: "Strong-Pass-9" });
    expect(u.role).toBe("EXAMINER");
    expect(await status(UserService.create(w.users.admin, { name: "Dup", email: email.toUpperCase(), role: "CANDIDATE", password: "Strong-Pass-9" }))).toBe(409);
  });
  it("examiners may create candidates but never staff accounts", async () => {
    expect(await status(UserService.create(w.users.ex1, { name: "Sneaky", email: `it-${w.run}-sneaky@it.test`, role: "ADMIN", password: "Strong-Pass-9" }))).toBe(403);
    const c = await UserService.create(w.users.ex1, { name: "Fine Candidate", email: `it-${w.run}-fine@it.test`, role: "CANDIDATE", password: "Strong-Pass-9" });
    expect(c.role).toBe("CANDIDATE");
  });
  it("role changes: admin only, never on self", async () => {
    expect(await status(UserService.changeRole(w.users.ex1, w.users.c3.id, "ADMIN"))).toBe(403);
    expect(await status(UserService.changeRole(w.users.c3, w.users.c3.id, "ADMIN"))).toBe(403);
    expect(await status(UserService.changeRole(w.users.admin, w.users.admin.id, "CANDIDATE"))).toBe(403);
    expect((await UserService.changeRole(w.users.admin, w.users.c3.id, "EXAMINER")).role).toBe("EXAMINER");
    await UserService.changeRole(w.users.admin, w.users.c3.id, "CANDIDATE");
  });
  it("deactivation blocks sign-in; admins cannot deactivate themselves", async () => {
    expect(await status(UserService.setActive(w.users.admin, w.users.admin.id, false))).toBe(403);
    await UserService.setActive(w.users.admin, w.users.c3.id, false);
    expect(await UserService.authenticate(w.users.c3.email, PASSWORD)).toBeNull();
    await UserService.setActive(w.users.admin, w.users.c3.id, true);
    expect(await UserService.authenticate(w.users.c3.email, PASSWORD)).not.toBeNull();
  });
  it("updating a user can reset the password", async () => {
    await UserService.update(w.users.admin, w.users.c3.id, { name: "Eve Renamed", email: w.users.c3.email, password: "Brand-New-Pass-2" });
    expect(await UserService.authenticate(w.users.c3.email, "Brand-New-Pass-2")).not.toBeNull();
    await UserService.update(w.users.admin, w.users.c3.id, { name: "Eve Candidate", email: w.users.c3.email, password: PASSWORD });
  });
});

describe("exam lifecycle, paper composition and ownership", () => {
  let examId: string;
  beforeAll(async () => {
    examId = await createOpenExam(w, { publish: false });
  });

  it("only the owner (or an admin) can manage the exam — others get 404", async () => {
    await expect(assertCanManageExam(w.users.ex1, examId)).resolves.toBeUndefined();
    await expect(assertCanManageExam(w.users.admin, examId)).resolves.toBeUndefined();
    expect(await status(assertCanManageExam(w.users.ex2, examId))).toBe(404);
    expect(await status(assertCanManageExam(w.users.c1, examId))).toBe(403);
    expect(await status(ExamService.getForExaminer(w.users.ex2, examId))).toBe(404);
    expect(await status(ExamService.publish(w.users.ex2, examId))).toBe(404);
  });
  it("duplicate exam codes are rejected", async () => {
    const [e] = await db.select({ code: exams.code }).from(exams).where(eq(exams.id, examId));
    const now = Date.now();
    const dup = ExamService.create(w.users.ex1, { title: "Dup code", code: e!.code, description: "", instructions: "", startsAt: new Date(now).toISOString(), endsAt: new Date(now + 3600_000).toISOString(), durationMinutes: 10, passPercentage: 50, maxAttempts: 1, shuffleQuestions: false, shuffleOptions: false });
    expect(await status(dup)).toBe(409);
  });
  it("adding the same question twice does not duplicate it", async () => {
    const before = await db.select().from(examQuestions).where(eq(examQuestions.examId, examId));
    const r = await ExamService.addQuestions(w.users.ex1, examId, [w.questions.single.id]);
    expect(r.added).toBe(0);
    expect((await db.select().from(examQuestions).where(eq(examQuestions.examId, examId))).length).toBe(before.length);
  });
  it("reordering swaps neighbours and keeps positions unique", async () => {
    await ExamService.moveQuestion(w.users.ex1, examId, w.questions.multi.id, "up");
    const paper = (await ExamService.getForExaminer(w.users.ex1, examId)).paper;
    expect(paper[0]!.id).toBe(w.questions.multi.id);
    expect(new Set(paper.map((p) => p.position)).size).toBe(paper.length);
    await ExamService.moveQuestion(w.users.ex1, examId, w.questions.multi.id, "down");
  });
  it("cannot publish an empty paper", async () => {
    const id = await createOpenExam(w, { publish: false });
    for (const q of Object.values(w.questions)) await ExamService.removeQuestion(w.users.ex1, id, q.id);
    expect(await status(ExamService.publish(w.users.ex1, id))).toBe(400);
  });
  it("publish → paper locked; unpublish allowed only before attempts; close stops new starts", async () => {
    await ExamService.publish(w.users.ex1, examId);
    expect(await status(ExamService.addQuestions(w.users.ex1, examId, [w.questions.essay.id]))).toBe(409);
    expect(await status(ExamService.publish(w.users.ex1, examId))).toBe(409);
    await AttemptService.start(w.users.c1, examId, { sandbox: false });
    expect(await status(ExamService.unpublish(w.users.ex1, examId))).toBe(409);
    await ExamService.close(w.users.ex1, examId);
    expect(await status(AttemptService.start(w.users.c2, examId, { sandbox: false }))).toBe(403);
  });
});

describe("question bank", () => {
  it("only the author (or admin) may edit; questions in use cannot be archived", async () => {
    const input = { type: "ESSAY" as const, prompt: "Edited essay prompt", options: [], correctOptionIds: [], accepted: [], marks: 5, negativeMarks: 0, multiScoring: "ALL_OR_NOTHING" as const, difficulty: "HARD" as const, subject: "", topic: "", explanation: "" };
    expect(await status(QuestionService.update(w.users.ex2, w.questions.essay.id, input))).toBe(403);
    expect(await status(QuestionService.archive(w.users.ex1, w.questions.essay.id))).toBe(409);
    const own = await QuestionService.create(w.users.ex2, { ...input, prompt: `IT ${w.run} archivable` });
    await QuestionService.archive(w.users.ex2, own.id);
    expect((await QuestionService.list({ q: `IT ${w.run} archivable` })).length).toBe(0);
  });
});

describe("enrolment and candidate-record access", () => {
  it("only CANDIDATE accounts can be enrolled", async () => {
    const id = await createOpenExam(w, { publish: false });
    expect(await status(EnrollmentService.enroll(w.users.ex1, id, [w.users.ex2.id]))).toBe(400);
  });
  it("candidates see only themselves; examiners only candidates in their exams", async () => {
    await expect(assertCanAccessCandidate(w.users.c1, w.users.c1.id)).resolves.toBeUndefined();
    expect(await status(assertCanAccessCandidate(w.users.c1, w.users.c2.id))).toBe(404);
    await expect(assertCanAccessCandidate(w.users.ex1, w.users.c1.id)).resolves.toBeUndefined();
    expect(await status(assertCanAccessCandidate(w.users.ex2, w.users.c1.id))).toBe(404);
  });
});

describe("archive and delete", () => {
  it("drafts with no attempts can be deleted (sandbox previews removed with them); others cannot", async () => {
    const draft = await createOpenExam(w, { publish: false });
    const { attemptId } = await AttemptService.start(w.users.ex1, draft, { sandbox: true });
    expect(await status(ExamService.remove(w.users.ex2, draft))).toBe(404);
    await ExamService.remove(w.users.ex1, draft);
    expect(await db.select().from(exams).where(eq(exams.id, draft))).toHaveLength(0);
    const { attempts } = await import("@/db/schema");
    expect(await db.select().from(attempts).where(eq(attempts.id, attemptId))).toHaveLength(0);
    const published = await createOpenExam(w);
    expect(await status(ExamService.remove(w.users.ex1, published))).toBe(409);
  });
  it("live exams cannot be archived; closed ones can, keeping their attempts", async () => {
    const id = await createOpenExam(w);
    const { attemptId } = await AttemptService.start(w.users.c1, id, { sandbox: false });
    expect(await status(ExamService.archive(w.users.ex1, id))).toBe(409);
    await AttemptService.submit(w.users.c1, attemptId);
    await ExamService.close(w.users.ex1, id);
    await ExamService.archive(w.users.ex1, id);
    expect((await ExamService.getForExaminer(w.users.ex1, id)).exam.phase).toBe("ARCHIVED");
    expect((await ExamService.getForExaminer(w.users.ex1, id)).attemptCount).toBe(1);
    expect(await status(ExamService.archive(w.users.ex1, id))).toBe(409);
    expect(await status(ExamService.archive(w.users.ex2, id))).toBe(404);
  });
});
