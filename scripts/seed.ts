/**
 * DEVELOPMENT-ONLY seed. Idempotent: safe to run repeatedly.
 * Usage: npm run db:seed
 *
 * Refuses to run in production. Passwords come from SEED_*_PASSWORD env vars and are bcrypt-hashed.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { eq, sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { enrollments, examQuestions, exams, questions, users } from "../src/db/schema";
import type { CorrectAnswer, QuestionOption } from "../src/db/schema/types";
import type { QuestionType, UserRole } from "../src/db/schema/enums";
import { hashPassword } from "../src/lib/auth/password";

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  console.error("✗ Refusing to seed: this script is for development databases only.");
  process.exit(1);
}

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

const PEOPLE: { email: string; name: string; role: UserRole }[] = [
  { email: "admin@codekaizen.test", name: "Amara Okafor", role: "ADMIN" },
  { email: "d.reyes@codekaizen.test", name: "Daniel Reyes", role: "EXAMINER" },
  { email: "p.nair@codekaizen.test", name: "Priya Nair", role: "EXAMINER" },
  { email: "lena.fischer@codekaizen.test", name: "Lena Fischer", role: "CANDIDATE" },
  { email: "omar.haddad@codekaizen.test", name: "Omar Haddad", role: "CANDIDATE" },
  { email: "sofia.marin@codekaizen.test", name: "Sofia Marin", role: "CANDIDATE" },
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
      await db.update(users).set({ name: p.name, role: p.role, passwordHash, isActive: true }).where(eq(users.id, existing.id));
      ids[p.email] = existing.id;
    } else {
      const [row] = await db.insert(users).values({ ...p, passwordHash }).returning({ id: users.id });
      ids[p.email] = row!.id;
    }
  }
  console.log(`✓ ${PEOPLE.length} users ready`);

  // ── sample exam (skipped if it already exists) ──
  const EXAM_CODE = "WSEC-101";
  const [existingExam] = await db.select({ id: exams.id }).from(exams).where(eq(exams.code, EXAM_CODE)).limit(1);
  if (existingExam) {
    console.log(`• Exam ${EXAM_CODE} already exists — skipping questions and enrolments`);
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
}

main().catch((err) => {
  console.error("✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
