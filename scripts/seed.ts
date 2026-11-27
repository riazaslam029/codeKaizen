/**
 * DEVELOPMENT-ONLY seed. Idempotent: safe to run repeatedly.
 * Usage: npm run db:seed
 *
 * Development branch only: refuses unless NEON_BRANCH is set and is not "production".
 * Passwords come from SEED_*_PASSWORD env vars and are bcrypt-hashed.
 */
import { assertNotProduction, loadDbEnv } from "./db-env";

loadDbEnv();
assertNotProduction("seed demo data");

import { eq, sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { answers, attempts, auditLogs, enrollments, examQuestions, exams, incidents, questions, results, users } from "../src/db/schema";
import type { AnswerResponse, AttemptQuestionSnapshot, CorrectAnswer, QuestionOption } from "../src/db/schema/types";
import type { QuestionType, UserRole } from "../src/db/schema/enums";
import { hashPassword } from "../src/lib/auth/password";
import { verificationCode } from "../src/lib/random";
import { round2, scoreQuestion } from "../src/lib/scoring";

function requiredPassword(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 8) {
    console.error(`✗ ${name} must be set (min 8 characters) in .env.local`);
    process.exit(1);
  }
  return v;
}

const PASSWORDS: Record<UserRole, string> = {
  ADMIN: requiredPassword("SEED_ADMIN_PASSWORD"),
  EXAMINER: requiredPassword("SEED_EXAMINER_PASSWORD"),
  CANDIDATE: requiredPassword("SEED_CANDIDATE_PASSWORD"),
};

const PEOPLE: { email: string; name: string; role: UserRole; restricted?: true }[] = [
  { email: "admin@codekaizen.test", name: "Amara Okafor", role: "ADMIN" },
  { email: "d.reyes@codekaizen.test", name: "Daniel Reyes", role: "EXAMINER" },
  { email: "p.nair@codekaizen.test", name: "Priya Nair", role: "EXAMINER" },
  { email: "lena.fischer@codekaizen.test", name: "Lena Fischer", role: "CANDIDATE" },
  { email: "omar.haddad@codekaizen.test", name: "Omar Haddad", role: "CANDIDATE" },
  { email: "sofia.marin@codekaizen.test", name: "Sofia Marin", role: "CANDIDATE" },
  { email: "mei.tanaka@codekaizen.test", name: "Mei Tanaka", role: "CANDIDATE" },
  { email: "jonas.berg@codekaizen.test", name: "Jonas Berg", role: "CANDIDATE" },
  { email: "aisha.bello@codekaizen.test", name: "Aisha Bello", role: "CANDIDATE" },
  // Demonstrates account restriction: correct password → "Your account has been restricted…" message.
  { email: "ravi.kumar@codekaizen.test", name: "Ravi Kumar", role: "CANDIDATE", restricted: true },
];

const opts = (...texts: string[]): QuestionOption[] => texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));

const QUESTIONS: {
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correct: CorrectAnswer | null;
  marks: number;
  negative?: number;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  explanation?: string;
}[] = [
  {
    type: "MCQ_SINGLE",
    prompt: "Which HTTP status code should an API return when a valid token lacks permission for a resource?",
    options: opts("400 Bad Request", "401 Unauthorized", "403 Forbidden", "404 Not Found"),
    correct: { optionIds: ["c"] },
    marks: 2,
    negative: 0.5,
    difficulty: "EASY",
    explanation: "401 means unauthenticated; 403 means authenticated but not allowed.",
  },
  {
    type: "MCQ_SINGLE",
    prompt: "Which cookie attribute prevents client-side JavaScript from reading a session cookie?",
    options: opts("Secure", "HttpOnly", "SameSite=Strict", "Path=/"),
    correct: { optionIds: ["b"] },
    marks: 2,
    negative: 0.5,
    difficulty: "EASY",
  },
  {
    type: "MCQ_SINGLE",
    prompt: "What is the primary defence against SQL injection?",
    options: opts("Escaping quotes manually", "Parameterised queries", "Client-side validation", "Hiding error messages"),
    correct: { optionIds: ["b"] },
    marks: 2,
    negative: 0.5,
    difficulty: "MEDIUM",
  },
  {
    type: "MCQ_SINGLE",
    prompt: "Why is bcrypt preferred over SHA-256 for storing passwords?",
    options: opts(
      "It produces shorter hashes",
      "It is deliberately slow and salted",
      "It is reversible for password recovery",
      "It is faster to verify",
    ),
    correct: { optionIds: ["b"] },
    marks: 2,
    negative: 0.5,
    difficulty: "MEDIUM",
  },
  {
    type: "MCQ_MULTI",
    prompt: "Select ALL items that belong in a JWT used as a session token.",
    options: opts("Subject (user id)", "Expiry time", "The user's password hash", "Issuer"),
    correct: { optionIds: ["a", "b", "d"] },
    marks: 3,
    difficulty: "MEDIUM",
  },
  {
    type: "MCQ_MULTI",
    prompt: "Which of these are examples of broken access control? Select all that apply.",
    options: opts(
      "Changing an id in the URL to view another user's record",
      "A candidate calling an admin-only endpoint successfully",
      "Using TLS for all traffic",
      "Hiding a button in the UI but not checking on the server",
    ),
    correct: { optionIds: ["a", "b", "d"] },
    marks: 3,
    difficulty: "HARD",
  },
  {
    type: "TRUE_FALSE",
    prompt: "Hiding a route in the frontend menu is sufficient to protect it from unauthorised users.",
    options: opts("True", "False"),
    correct: { optionIds: ["b"] },
    marks: 1,
    difficulty: "EASY",
  },
  {
    type: "TRUE_FALSE",
    prompt: "A foreign key with ON DELETE RESTRICT prevents deleting a parent row that still has children.",
    options: opts("True", "False"),
    correct: { optionIds: ["a"] },
    marks: 1,
    difficulty: "EASY",
  },
  {
    type: "SHORT_ANSWER",
    prompt: "Name the OWASP category that covers attackers injecting malicious scripts into pages viewed by other users (abbreviation accepted).",
    correct: { accepted: ["cross-site scripting", "cross site scripting", "xss"] },
    marks: 2,
    difficulty: "MEDIUM",
  },
  {
    type: "SHORT_ANSWER",
    prompt: "Which HTTP header lets a server control which other origins may read its responses in the browser?",
    correct: { accepted: ["access-control-allow-origin", "cors", "access control allow origin"] },
    marks: 2,
    difficulty: "HARD",
  },
  {
    type: "ESSAY",
    prompt:
      "Explain why an online examination system should freeze each candidate's questions and marking scheme when an attempt starts. Discuss fairness and auditability.",
    correct: null,
    marks: 10,
    difficulty: "HARD",
  },
];

async function main() {
  const db = createDb();

  // ── users (upsert by case-insensitive email) ──
  const ids: Record<string, string> = {};
  for (const p of PEOPLE) {
    const passwordHash = await hashPassword(PASSWORDS[p.role]);
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, p.email))
      .limit(1);
    if (existing) {
      await db.update(users).set({ name: p.name, role: p.role, passwordHash, isActive: !p.restricted }).where(eq(users.id, existing.id));
      ids[p.email] = existing.id;
    } else {
      const [row] = await db
        .insert(users)
        .values({ email: p.email, name: p.name, role: p.role, passwordHash, isActive: !p.restricted })
        .returning({ id: users.id });
      ids[p.email] = row!.id;
    }
  }
  console.log(`✓ ${PEOPLE.length} users ready`);

  // ── sample exam (skipped if it already exists) ──
  const EXAM_CODE = "WSEC-101";
  const [existingExam] = await db.select({ id: exams.id }).from(exams).where(eq(exams.code, EXAM_CODE)).limit(1);
  if (existingExam) {
    console.log(`• Exam ${EXAM_CODE} already exists — skipping questions and enrolments`);
    await seedPracticeExam(db, ids);
    await seedHistory(db, ids);
    return;
  }

  const examinerId = ids["d.reyes@codekaizen.test"]!;
  const startsAt = new Date();
  startsAt.setUTCDate(startsAt.getUTCDate() + 1);
  startsAt.setUTCHours(9, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

  const [exam] = await db
    .insert(exams)
    .values({
      code: EXAM_CODE,
      title: "Web Application Security Fundamentals",
      description: "Authentication, access control, injection and secure session handling.",
      instructions: "Answer every question. Negative marking applies to single-choice questions only.",
      createdById: examinerId,
      status: "PUBLISHED",
      durationMinutes: 60,
      startsAt,
      endsAt,
      passPercentage: 50,
    })
    .returning({ id: exams.id });

  const inserted = await db
    .insert(questions)
    .values(
      QUESTIONS.map((q) => ({
        authorId: examinerId,
        type: q.type,
        prompt: q.prompt,
        options: q.options ?? null,
        correctAnswer: q.correct,
        explanation: q.explanation ?? null,
        subject: "Web Security",
        difficulty: q.difficulty,
        defaultMarks: q.marks,
        negativeMarks: q.negative ?? 0,
      })),
    )
    .returning({ id: questions.id });

  await db.insert(examQuestions).values(inserted.map((q, i) => ({ examId: exam!.id, questionId: q.id, position: i + 1 })));

  // Two of three candidates enrolled — the third demonstrates isolation (sees an empty list).
  await db.insert(enrollments).values(
    ["lena.fischer@codekaizen.test", "omar.haddad@codekaizen.test"].map((email) => ({
      examId: exam!.id,
      candidateId: ids[email]!,
      enrolledById: examinerId,
    })),
  );

  console.log(`✓ Exam ${EXAM_CODE} with ${inserted.length} questions and 2 enrolments`);
  await seedPracticeExam(db, ids);
  await seedHistory(db, ids);
}

/**
 * An always-open practice exam (window: now−1h → now+30 days, 20 minutes) reusing the bank questions,
 * with all three candidates enrolled — so the candidate workspace can be demonstrated at any time.
 */
async function seedPracticeExam(db: ReturnType<typeof createDb>, ids: Record<string, string>) {
  const CODE = "WSEC-PRACTICE";
  const [exists] = await db.select({ id: exams.id }).from(exams).where(eq(exams.code, CODE)).limit(1);
  if (exists) {
    console.log(`• Exam ${CODE} already exists`);
    return;
  }
  const examinerId = ids["d.reyes@codekaizen.test"]!;
  const bank = await db.select({ id: questions.id }).from(questions).where(eq(questions.authorId, examinerId)).limit(11);
  const now = Date.now();
  const [exam] = await db
    .insert(exams)
    .values({
      code: CODE,
      title: "Web Security — Practice Paper",
      description: "Open practice paper. Try the workspace: autosave, offline mode, scratchpad and review.",
      instructions: "20 minutes. Questions and options are shuffled for every candidate. Up to 3 attempts.",
      createdById: examinerId,
      status: "PUBLISHED",
      durationMinutes: 20,
      startsAt: new Date(now - 60 * 60_000),
      endsAt: new Date(now + 30 * 86_400_000),
      passPercentage: 50,
      maxAttempts: 3,
      shuffleQuestions: true,
      shuffleOptions: true,
    })
    .returning({ id: exams.id });
  await db.insert(examQuestions).values(bank.map((q, i) => ({ examId: exam!.id, questionId: q.id, position: i + 1 })));
  await db.insert(enrollments).values(
    ["lena.fischer@codekaizen.test", "omar.haddad@codekaizen.test", "sofia.marin@codekaizen.test"].map((email) => ({
      examId: exam!.id,
      candidateId: ids[email]!,
      enrolledById: examinerId,
    })),
  );
  console.log(`✓ Exam ${CODE} (open for 30 days) with ${bank.length} questions and 3 enrolments`);
}

/* ───────────────────────── demo history (past exams, results, disruptions) ───────────────────────── */

/** Topic per bank question (matched by prompt prefix) so per-topic charts have data. */
const TOPICS: [string, string][] = [
  ["Which HTTP status code", "HTTP & APIs"],
  ["Which cookie attribute", "Sessions & cookies"],
  ["What is the primary defence", "Injection"],
  ["Why is bcrypt", "Passwords"],
  ["Select ALL items that belong in a JWT", "Sessions & cookies"],
  ["Which of these are examples of broken", "Access control"],
  ["Hiding a route", "Access control"],
  ["A foreign key", "Databases"],
  ["Name the OWASP category", "Injection"],
  ["Which HTTP header lets", "HTTP & APIs"],
  ["Explain why an online examination", "Exam design"],
];

/** Small deterministic PRNG so re-seeding a fresh branch gives the same story. */
function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Db = ReturnType<typeof createDb>;
type Plan = {
  email: string;
  skill: number;
  status: "SUBMITTED" | "AUTO_SUBMITTED";
  minutesUsed: number;
  events?: { type: "NETWORK_LOSS" | "RECONNECTED" | "SYNC_FAILED" | "ATTEMPT_RESUMED" | "AUTO_SUBMITTED"; at: number; details?: Record<string, unknown> }[];
};

async function seedHistory(db: Db, ids: Record<string, string>) {
  const examinerId = ids["d.reyes@codekaizen.test"]!;
  const bank = await db
    .select()
    .from(questions)
    .where(eq(questions.authorId, examinerId))
    .orderBy(questions.createdAt)
    .limit(11);
  for (const q of bank) {
    const topic = TOPICS.find(([prefix]) => q.prompt.startsWith(prefix))?.[1];
    if (topic && q.topic !== topic) await db.update(questions).set({ topic }).where(eq(questions.id, q.id));
    q.topic = topic ?? q.topic;
  }

  const day = 86_400_000;
  const now = Date.now();
  const essay = bank.find((q) => q.type === "ESSAY");

  await pastExam(db, ids, bank, {
    code: "WSEC-DIAG",
    title: "Web Security — Diagnostic Test",
    startsAt: now - 24 * day,
    duration: 30,
    publish: true,
    questionFilter: (q) => q.type !== "ESSAY",
    plans: [
      { email: "lena.fischer@codekaizen.test", skill: 0.6, status: "SUBMITTED", minutesUsed: 22 },
      { email: "omar.haddad@codekaizen.test", skill: 0.45, status: "SUBMITTED", minutesUsed: 27 },
      { email: "sofia.marin@codekaizen.test", skill: 0.75, status: "SUBMITTED", minutesUsed: 18 },
      { email: "mei.tanaka@codekaizen.test", skill: 0.35, status: "AUTO_SUBMITTED", minutesUsed: 30, events: [{ type: "AUTO_SUBMITTED", at: 30 }] },
    ],
  });

  await pastExam(db, ids, bank, {
    code: "WSEC-MID",
    title: "Web Security — Mid-term Examination",
    startsAt: now - 10 * day,
    duration: 45,
    publish: true,
    questionFilter: () => true,
    plans: [
      {
        email: "lena.fischer@codekaizen.test",
        skill: 0.8,
        status: "SUBMITTED",
        minutesUsed: 38,
        events: [
          { type: "NETWORK_LOSS", at: 12, details: { source: "browser" } },
          { type: "RECONNECTED", at: 14, details: { offlineSeconds: 104, source: "browser" } },
        ],
      },
      {
        email: "omar.haddad@codekaizen.test",
        skill: 0.55,
        status: "SUBMITTED",
        minutesUsed: 41,
        events: [{ type: "ATTEMPT_RESUMED", at: 20, details: { note: "Workspace reloaded (refresh, crash or new tab). Deadline unchanged." } }],
      },
      { email: "sofia.marin@codekaizen.test", skill: 0.9, status: "SUBMITTED", minutesUsed: 33 },
      {
        email: "mei.tanaka@codekaizen.test",
        skill: 0.4,
        status: "AUTO_SUBMITTED",
        minutesUsed: 45,
        events: [
          { type: "SYNC_FAILED", at: 30, details: { failures: 3, source: "browser" } },
          { type: "AUTO_SUBMITTED", at: 45 },
        ],
      },
      { email: "jonas.berg@codekaizen.test", skill: 0.3, status: "SUBMITTED", minutesUsed: 44 },
      { email: "aisha.bello@codekaizen.test", skill: 0.65, status: "SUBMITTED", minutesUsed: 36 },
    ],
  });

  // Closed two days ago, NOT published: essays still need manual grading → shows the publish checklist.
  await pastExam(db, ids, bank, {
    code: "WSEC-SESS",
    title: "Secure Sessions Quiz",
    startsAt: now - 2 * day,
    duration: 20,
    publish: false,
    questionFilter: (q) => ["Sessions & cookies", "Passwords", "Access control"].includes(q.topic ?? "") || q.id === essay?.id,
    plans: [
      { email: "lena.fischer@codekaizen.test", skill: 0.7, status: "SUBMITTED", minutesUsed: 15 },
      { email: "omar.haddad@codekaizen.test", skill: 0.5, status: "SUBMITTED", minutesUsed: 19, events: [{ type: "NETWORK_LOSS", at: 6, details: { source: "browser" } }, { type: "RECONNECTED", at: 7, details: { offlineSeconds: 41, source: "browser" } }] },
      { email: "aisha.bello@codekaizen.test", skill: 0.85, status: "SUBMITTED", minutesUsed: 12 },
    ],
  });

  await upcomingExam(db, ids, bank);

  // Restricted account: record the admin action so it shows in Platform activity.
  const ravi = ids["ravi.kumar@codekaizen.test"];
  const adminId = ids["admin@codekaizen.test"];
  const [logged] = await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.entityId, ravi!)).limit(1);
  if (ravi && adminId && !logged) {
    await db.insert(auditLogs).values({ actorId: adminId, action: "user.restrict", entityType: "user", entityId: ravi, summary: "Amara Okafor restricted Ravi Kumar" });
  }
}

/** Opens in 3 days (rolling) — drives the candidate "Next examination" countdown. */
async function upcomingExam(db: Db, ids: Record<string, string>, bank: (typeof questions.$inferSelect)[]) {
  const CODE = "WSEC-FINAL";
  const [exists] = await db.select({ id: exams.id }).from(exams).where(eq(exams.code, CODE)).limit(1);
  const startsAt = new Date(Date.now() + 3 * 86_400_000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 3 * 60 * 60_000);
  if (exists) {
    // Keep it in the future on every re-seed so the countdown always has something to show.
    await db.update(exams).set({ startsAt, endsAt }).where(eq(exams.id, exists.id));
    console.log(`• Exam ${CODE} already exists — window moved to 3 days from now`);
    return;
  }
  const examinerId = ids["d.reyes@codekaizen.test"]!;
  const [exam] = await db
    .insert(exams)
    .values({
      code: CODE,
      title: "Web Security — Final Examination",
      description: "Covers the full course: HTTP, sessions, injection, access control and secure design.",
      instructions: "60 minutes. One attempt. Your answers save automatically, even if your connection drops.",
      createdById: examinerId,
      status: "PUBLISHED",
      durationMinutes: 60,
      startsAt,
      endsAt,
      passPercentage: 50,
      shuffleQuestions: true,
      shuffleOptions: true,
    })
    .returning({ id: exams.id });
  await db.insert(examQuestions).values(bank.map((q, i) => ({ examId: exam!.id, questionId: q.id, position: i + 1 })));
  const cands = ["lena.fischer", "omar.haddad", "sofia.marin", "mei.tanaka", "jonas.berg", "aisha.bello"];
  await db.insert(enrollments).values(cands.map((c) => ({ examId: exam!.id, candidateId: ids[`${c}@codekaizen.test`]!, enrolledById: examinerId })));
  console.log(`✓ Exam ${CODE} opens in 3 days, ${cands.length} enrolments`);
}

async function pastExam(
  db: Db,
  ids: Record<string, string>,
  bank: (typeof questions.$inferSelect)[],
  cfg: { code: string; title: string; startsAt: number; duration: number; publish: boolean; questionFilter: (q: typeof questions.$inferSelect) => boolean; plans: Plan[] },
) {
  const [exists] = await db.select({ id: exams.id }).from(exams).where(eq(exams.code, cfg.code)).limit(1);
  if (exists) {
    console.log(`• Exam ${cfg.code} already exists`);
    return;
  }
  const examinerId = ids["d.reyes@codekaizen.test"]!;
  const qs = bank.filter(cfg.questionFilter);
  const startsAt = new Date(cfg.startsAt);
  const endsAt = new Date(cfg.startsAt + 2 * 60 * 60_000);
  const [exam] = await db
    .insert(exams)
    .values({
      code: cfg.code,
      title: cfg.title,
      description: "Seeded demo history: a past sitting with real attempts, marks and connection events.",
      instructions: "Answer every question. Negative marking applies to single-choice questions.",
      createdById: examinerId,
      status: "PUBLISHED",
      durationMinutes: cfg.duration,
      startsAt,
      endsAt,
      passPercentage: 50,
    })
    .returning({ id: exams.id });
  const examId = exam!.id;
  await db.insert(examQuestions).values(qs.map((q, i) => ({ examId, questionId: q.id, position: i + 1 })));

  const snapshot: AttemptQuestionSnapshot[] = qs.map((q, i) => ({
    questionId: q.id,
    position: i + 1,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    correctAnswer: q.correctAnswer,
    marks: Number(q.defaultMarks),
    negativeMarks: Number(q.negativeMarks),
    multiScoring: q.multiScoring,
    topic: q.topic,
    difficulty: q.difficulty,
  }));
  const maxScore = snapshot.reduce((a, q) => a + q.marks, 0);
  const rand = prng(cfg.code.length * 7919 + cfg.startsAt % 1000);

  for (const [n, plan] of cfg.plans.entries()) {
    const candidateId = ids[plan.email]!;
    const [enr] = await db.insert(enrollments).values({ examId, candidateId, enrolledById: examinerId }).returning({ id: enrollments.id });
    const started = new Date(cfg.startsAt + (5 + n * 3) * 60_000);
    const expires = new Date(started.getTime() + cfg.duration * 60_000);
    const submitted = plan.status === "AUTO_SUBMITTED" ? expires : new Date(started.getTime() + plan.minutesUsed * 60_000);
    const [attempt] = await db
      .insert(attempts)
      .values({
        examId,
        candidateId,
        enrollmentId: enr!.id,
        status: plan.status,
        questionSnapshot: snapshot,
        startedAt: started,
        expiresAt: expires,
        submittedAt: submitted,
        lastSeenAt: submitted,
      })
      .returning({ id: attempts.id });

    let total = 0;
    const rows = snapshot.map((q) => {
      const response = answerFor(q, plan.skill, rand);
      const graded = scoreQuestion(q, response);
      let marks = graded.marks;
      let gradedById: string | null = null;
      let feedback: string | null = null;
      if (q.type === "ESSAY" && marks === null && cfg.publish) {
        marks = Math.round(q.marks * Math.min(1, plan.skill + 0.1));
        gradedById = examinerId;
        feedback = marks >= q.marks * 0.7 ? "Clear argument covering fairness and auditability." : "Mentions fairness; auditability needs more detail.";
      }
      total += marks ?? 0;
      return {
        attemptId: attempt!.id,
        questionId: q.questionId,
        response,
        revision: 1 + Math.floor(rand() * 4),
        isCorrect: graded.isCorrect,
        marksAwarded: marks,
        feedback,
        gradedById,
        gradedAt: gradedById ? new Date(endsAt.getTime() + day1()) : null,
      };
    });
    await db.insert(answers).values(rows);

    const score = round2(Math.max(0, total));
    const percentage = round2(Math.min(100, (score / maxScore) * 100));
    await db.insert(results).values({
      attemptId: attempt!.id,
      examId,
      candidateId,
      score,
      maxScore,
      percentage,
      passed: percentage >= 50,
      status: cfg.publish ? "PUBLISHED" : "PROVISIONAL",
      publishedAt: cfg.publish ? new Date(endsAt.getTime() + day1()) : null,
      publishedById: cfg.publish ? examinerId : null,
      gradedById: cfg.publish ? examinerId : null,
      verificationCode: cfg.publish ? verificationCode() : null,
    });

    for (const e of plan.events ?? []) {
      await db.insert(incidents).values({
        attemptId: attempt!.id,
        examId,
        candidateId,
        type: e.type,
        severity: e.type === "SYNC_FAILED" ? "MEDIUM" : "LOW",
        details: e.details ?? null,
        occurredAt: new Date(started.getTime() + e.at * 60_000),
      });
    }
  }
  console.log(`✓ Exam ${cfg.code}: ${cfg.plans.length} attempts, results ${cfg.publish ? "published" : "awaiting grading / publication"}`);
}

const day1 = () => 86_400_000;

function answerFor(q: AttemptQuestionSnapshot, skill: number, rand: () => number): AnswerResponse | null {
  const r = rand();
  if (r > 0.95) return null; // left blank
  const right = r < skill;
  const opts = q.options?.map((o) => o.id) ?? [];
  const correct = q.correctAnswer && "optionIds" in q.correctAnswer ? q.correctAnswer.optionIds : [];
  switch (q.type) {
    case "MCQ_SINGLE":
    case "TRUE_FALSE": {
      if (right) return { optionIds: [correct[0]!] };
      const wrong = opts.filter((o) => !correct.includes(o));
      return { optionIds: [wrong[Math.floor(rand() * wrong.length)]!] };
    }
    case "MCQ_MULTI":
      return { optionIds: right ? [...correct] : correct.slice(0, Math.max(1, correct.length - 1)) };
    case "SHORT_ANSWER": {
      const accepted = q.correctAnswer && "accepted" in q.correctAnswer ? q.correctAnswer.accepted : [];
      return { text: right ? accepted[0]! : "csrf" };
    }
    case "ESSAY":
      return {
        text:
          "Freezing the questions and marking scheme at start means every candidate is graded against exactly what they saw, " +
          "even if the bank is edited later. It keeps marking fair and lets an examiner audit any result afterwards.",
      };
  }
}

main().catch((err) => {
  console.error("✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
