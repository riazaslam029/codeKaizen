/**
 * Isolated test world on the dev branch: its own users, questions and exams, all tagged with a
 * per-run prefix, so cleanup deletes ONLY records this run created.
 */
import bcrypt from "bcryptjs";
import { inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import * as t from "@/db/schema";
import type { UserRole } from "@/db/schema/enums";
import type { SessionUser } from "@/lib/auth/dal";
import type { QuestionInput } from "@/lib/validations/question";
import { ExamService } from "@/services/exams/exam.service";
import { QuestionService } from "@/services/questions/question.service";

export const PASSWORD = "Integration-Pass-1";

export type World = Awaited<ReturnType<typeof createWorld>>;

export async function createWorld(tag: string) {
  const run = `${tag}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toLowerCase();
  const hash = await bcrypt.hash(PASSWORD, 4); // fast cost for fixtures only
  const mk = (key: string, role: UserRole, name: string) => ({ email: `it-${run}-${key}@it.test`, name, role, passwordHash: hash });
  const rows = await db
    .insert(t.users)
    .values([
      mk("admin", "ADMIN", "IT Admin"),
      mk("ex1", "EXAMINER", "IT Examiner One"),
      mk("ex2", "EXAMINER", "IT Examiner Two"),
      mk("c1", "CANDIDATE", "Cara Candidate"),
      mk("c2", "CANDIDATE", "Dan Candidate"),
      mk("c3", "CANDIDATE", "Eve Candidate"),
    ])
    .returning({ id: t.users.id, email: t.users.email, name: t.users.name, role: t.users.role });
  const by = (key: string) => rows.find((r) => r.email.includes(`-${key}@`))! as SessionUser;
  const users = { admin: by("admin"), ex1: by("ex1"), ex2: by("ex2"), c1: by("c1"), c2: by("c2"), c3: by("c3") };

  const q = (input: Partial<QuestionInput> & Pick<QuestionInput, "type" | "prompt">) =>
    QuestionService.create(users.ex1, {
      options: [],
      correctOptionIds: [],
      accepted: [],
      marks: 2,
      negativeMarks: 0,
      multiScoring: "ALL_OR_NOTHING",
      difficulty: "MEDIUM",
      subject: "IT",
      topic: run,
      explanation: "",
      ...input,
    } as QuestionInput);
  const opts = (...xs: string[]) => xs.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
  const questions = {
    single: await q({ type: "MCQ_SINGLE", prompt: `IT ${run} single: pick B`, options: opts("A", "B", "C"), correctOptionIds: ["b"], marks: 2, negativeMarks: 0.5 }),
    multi: await q({ type: "MCQ_MULTI", prompt: `IT ${run} multi: pick A and C`, options: opts("A", "B", "C", "D"), correctOptionIds: ["a", "c"], marks: 4, multiScoring: "PARTIAL" }),
    short: await q({ type: "SHORT_ANSWER", prompt: `IT ${run} short: say paris`, accepted: ["Paris"], marks: 1 }),
    essay: await q({ type: "ESSAY", prompt: `IT ${run} essay: discuss`, marks: 10 }),
  };
  return { run, users, questions };
}

/** Creates an exam owned by ex1 that is open now (or with overrides), adds all questions, enrols c1 + c2. */
export async function createOpenExam(w: World, overrides: Partial<{ startsAt: Date; endsAt: Date; durationMinutes: number; maxAttempts: number; publish: boolean; shuffle: boolean }> = {}) {
  const now = Date.now();
  const startsAt = overrides.startsAt ?? new Date(now - 5 * 60_000);
  const endsAt = overrides.endsAt ?? new Date(now + 2 * 3600_000);
  const { id } = await ExamService.create(w.users.ex1, {
    title: `IT exam ${w.run}`,
    code: `IT-${w.run.slice(-10).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`,
    description: "",
    instructions: "",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    durationMinutes: overrides.durationMinutes ?? 30,
    passPercentage: 50,
    maxAttempts: overrides.maxAttempts ?? 1,
    shuffleQuestions: overrides.shuffle ?? false,
    shuffleOptions: overrides.shuffle ?? false,
  });
  await ExamService.addQuestions(w.users.ex1, id, Object.values(w.questions).map((q) => q.id));
  const { EnrollmentService } = await import("@/services/exams/exam.service");
  await EnrollmentService.enroll(w.users.ex1, id, [w.users.c1.id, w.users.c2.id]);
  if (overrides.publish !== false) await ExamService.publish(w.users.ex1, id);
  return id;
}

/** Deletes everything created by this run, respecting foreign keys. Never touches other data. */
export async function destroyWorld(w: World | undefined) {
  if (!w) return;
  const userIds = Object.values(w.users).map((u) => u.id);
  const examRows = await db.select({ id: t.exams.id }).from(t.exams).where(inArray(t.exams.createdById, userIds));
  const examIds = examRows.map((e) => e.id);
  const attemptRows = await db
    .select({ id: t.attempts.id })
    .from(t.attempts)
    .where(or(inArray(t.attempts.candidateId, userIds), examIds.length ? inArray(t.attempts.examId, examIds) : sql`false`));
  const attemptIds = attemptRows.map((a) => a.id);
  if (attemptIds.length) {
    await db.delete(t.results).where(inArray(t.results.attemptId, attemptIds));
    await db.delete(t.attempts).where(inArray(t.attempts.id, attemptIds)); // answers, incidents, scratchpads cascade
  }
  await db.delete(t.announcements).where(inArray(t.announcements.authorId, userIds));
  if (examIds.length) await db.delete(t.exams).where(inArray(t.exams.id, examIds)); // exam_questions, enrollments cascade
  await db.delete(t.questions).where(inArray(t.questions.authorId, userIds));
  await db.delete(t.auditLogs).where(inArray(t.auditLogs.actorId, userIds));
  await db.delete(t.users).where(inArray(t.users.id, userIds));
  await db.delete(t.users).where(like(t.users.email, `it-${w.run}-%`)); // users created by tests (e.g. imports)
}
