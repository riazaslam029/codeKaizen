/**
 * Browser-test fixtures on the DEVELOPMENT branch. Creates an isolated cast of users and questions
 * (emails `e2e-<run>-…@e2e.test`) and removes exactly those records afterwards.
 */
import { readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { inArray, or, sql } from "drizzle-orm";
import { createDb } from "../../src/db/client";
import * as t from "../../src/db/schema";

export const WORLD_FILE = "tests/.e2e-world.json";
export const E2E_PASSWORD = "E2e-Test-Pass-1";

export type E2EWorld = {
  run: string;
  users: Record<"admin" | "examiner" | "examiner2" | "cand1" | "cand2", { id: string; email: string; name: string }>;
  questions: Record<"single" | "multi" | "essay", { id: string; prompt: string }>;
};

export function devDb() {
  config({ path: ".env.local", override: true, quiet: true });
  const branch = process.env.NEON_BRANCH;
  if (!branch || branch === "production") throw new Error(`E2E refuses to run against branch "${branch ?? "unknown"}"`);
  return createDb();
}

export async function createE2EWorld(): Promise<E2EWorld> {
  const db = devDb();
  const run = Date.now().toString(36);
  const hash = await bcrypt.hash(E2E_PASSWORD, 10);
  const mk = (k: string, role: "ADMIN" | "EXAMINER" | "CANDIDATE", name: string) => ({ email: `e2e-${run}-${k}@e2e.test`, name, role, passwordHash: hash });
  const rows = await db
    .insert(t.users)
    .values([
      mk("admin", "ADMIN", "Avery Admin"),
      mk("examiner", "EXAMINER", "Eli Examiner"),
      mk("examiner2", "EXAMINER", "Ola Otherexaminer"),
      mk("cand1", "CANDIDATE", "Casey Candidate"),
      mk("cand2", "CANDIDATE", "Drew Candidate"),
    ])
    .returning({ id: t.users.id, email: t.users.email, name: t.users.name });
  const u = (k: string) => rows.find((r) => r.email.includes(`-${k}@`))!;
  const users = { admin: u("admin"), examiner: u("examiner"), examiner2: u("examiner2"), cand1: u("cand1"), cand2: u("cand2") };
  const opts = (...xs: string[]) => xs.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
  const qs = await db
    .insert(t.questions)
    .values([
      { authorId: users.examiner.id, type: "MCQ_SINGLE", prompt: `E2E ${run}: Which protocol secures web traffic?`, options: opts("FTP", "HTTPS", "Telnet"), correctAnswer: { optionIds: ["b"] }, defaultMarks: 2, subject: "E2E" },
      { authorId: users.examiner.id, type: "MCQ_MULTI", prompt: `E2E ${run}: Select the prime numbers`, options: opts("2", "4", "5", "9"), correctAnswer: { optionIds: ["a", "c"] }, defaultMarks: 4, multiScoring: "PARTIAL", subject: "E2E" },
      { authorId: users.examiner.id, type: "ESSAY", prompt: `E2E ${run}: Explain why autosave matters in online exams`, options: null, correctAnswer: null, defaultMarks: 10, subject: "E2E" },
    ])
    .returning({ id: t.questions.id, prompt: t.questions.prompt });
  const world: E2EWorld = { run, users, questions: { single: qs[0]!, multi: qs[1]!, essay: qs[2]! } };
  writeFileSync(WORLD_FILE, JSON.stringify(world, null, 2));
  return world;
}

export function loadWorld(): E2EWorld {
  return JSON.parse(readFileSync(WORLD_FILE, "utf8"));
}

export async function destroyE2EWorld(world: E2EWorld) {
  const db = devDb();
  const userIds = Object.values(world.users).map((x) => x.id);
  const extra = await db.select({ id: t.users.id }).from(t.users).where(sql`${t.users.email} like ${`e2e-${world.run}-%`}`);
  const allUsers = [...new Set([...userIds, ...extra.map((x) => x.id)])];
  const examIds = (await db.select({ id: t.exams.id }).from(t.exams).where(inArray(t.exams.createdById, allUsers))).map((e) => e.id);
  const attemptIds = (
    await db
      .select({ id: t.attempts.id })
      .from(t.attempts)
      .where(or(inArray(t.attempts.candidateId, allUsers), examIds.length ? inArray(t.attempts.examId, examIds) : sql`false`))
  ).map((a) => a.id);
  if (attemptIds.length) {
    await db.delete(t.results).where(inArray(t.results.attemptId, attemptIds));
    await db.delete(t.attempts).where(inArray(t.attempts.id, attemptIds));
  }
  await db.delete(t.announcements).where(inArray(t.announcements.authorId, allUsers));
  if (examIds.length) await db.delete(t.exams).where(inArray(t.exams.id, examIds));
  await db.delete(t.questions).where(inArray(t.questions.authorId, allUsers));
  await db.delete(t.auditLogs).where(inArray(t.auditLogs.actorId, allUsers));
  await db.delete(t.userPreferences).where(inArray(t.userPreferences.userId, allUsers));
  await db.delete(t.users).where(inArray(t.users.id, allUsers));
}

/** Lazily reads the fixture file on first property access (specs load before global setup runs). */
let cached: E2EWorld | undefined;
export const world: E2EWorld = new Proxy({} as E2EWorld, {
  get: (_t, key: keyof E2EWorld) => (cached ??= loadWorld())[key],
});
