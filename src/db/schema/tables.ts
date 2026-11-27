import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  announcementAudience,
  attemptStatus,
  difficulty,
  disputeStatus,
  enrollmentStatus,
  examStatus,
  incidentSeverity,
  incidentType,
  multiScoring,
  questionType,
  resultStatus,
  userRole,
} from "./enums";
import type {
  AnswerResponse,
  AttemptQuestionSnapshot,
  CorrectAnswer,
  QuestionOption,
  ScratchpadData,
  WorkspacePreferences,
} from "./types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const marks = (name: string) => numeric(name, { precision: 7, scale: 2, mode: "number" });

/* ───────────────────────── users ───────────────────────── */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("CANDIDATE"),
    isActive: boolean("is_active").notNull().default(true),
    /** Bumped on restriction or role change: every session token carrying an older version stops working. */
    sessionVersion: integer("session_version").notNull().default(0),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Case-insensitive uniqueness: emails are always stored lower-cased by the app, and the index enforces it.
    uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`),
    index("users_role_idx").on(t.role),
  ],
);

/* ───────────────────────── exams ───────────────────────── */
export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    instructions: text("instructions"),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: examStatus("status").notNull().default("DRAFT"),
    durationMinutes: integer("duration_minutes").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    passPercentage: integer("pass_percentage").notNull().default(50),
    maxAttempts: integer("max_attempts").notNull().default(1),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
    shuffleOptions: boolean("shuffle_options").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("exams_created_by_idx").on(t.createdById),
    index("exams_status_starts_idx").on(t.status, t.startsAt),
    check("exams_duration_positive", sql`${t.durationMinutes} > 0`),
    check("exams_window_valid", sql`${t.endsAt} > ${t.startsAt}`),
    check("exams_pass_pct_range", sql`${t.passPercentage} between 0 and 100`),
    check("exams_max_attempts_positive", sql`${t.maxAttempts} >= 1`),
  ],
);

/* ──────────────────────── questions (bank) ──────────────────────── */
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    type: questionType("type").notNull(),
    prompt: text("prompt").notNull(),
    /** Choice options for MCQ / TRUE_FALSE. Null for free-text types. */
    options: jsonb("options").$type<QuestionOption[]>(),
    /** Marking key. NEVER sent to candidates. Null for ESSAY (manually graded). */
    correctAnswer: jsonb("correct_answer").$type<CorrectAnswer>(),
    explanation: text("explanation"),
    subject: varchar("subject", { length: 80 }),
    topic: varchar("topic", { length: 80 }),
    /** How MCQ_MULTI is marked: exact match, or proportional credit with penalties for wrong picks. */
    multiScoring: multiScoring("multi_scoring").notNull().default("ALL_OR_NOTHING"),
    difficulty: difficulty("difficulty").notNull().default("MEDIUM"),
    defaultMarks: marks("default_marks").notNull().default(1),
    negativeMarks: marks("negative_marks").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("questions_author_idx").on(t.authorId),
    index("questions_subject_idx").on(t.subject),
    check("questions_marks_positive", sql`${t.defaultMarks} > 0`),
    check("questions_negative_nonneg", sql`${t.negativeMarks} >= 0`),
  ],
);

/* ─────────────────── exam_questions (exam ↔ question) ─────────────────── */
export const examQuestions = pgTable(
  "exam_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    /** Overrides question.defaultMarks for this exam when set. */
    marks: marks("marks"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("exam_questions_exam_question_uq").on(t.examId, t.questionId),
    uniqueIndex("exam_questions_exam_position_uq").on(t.examId, t.position),
    index("exam_questions_question_idx").on(t.questionId),
    check("exam_questions_position_positive", sql`${t.position} >= 1`),
  ],
);

/* ───────────────────────── enrollments ───────────────────────── */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: enrollmentStatus("status").notNull().default("ENROLLED"),
    enrolledById: uuid("enrolled_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("enrollments_exam_candidate_uq").on(t.examId, t.candidateId),
    index("enrollments_candidate_idx").on(t.candidateId),
  ],
);

/* ───────────────────────── attempts ───────────────────────── */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "restrict" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Null only for sandbox (examiner preview) attempts. */
    enrollmentId: uuid("enrollment_id").references(() => enrollments.id, { onDelete: "restrict" }),
    /** Examiner preview attempt: excluded from results, statistics and analytics. */
    isSandbox: boolean("is_sandbox").notNull().default(false),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: attemptStatus("status").notNull().default("IN_PROGRESS"),
    /**
     * Frozen copy of the questions + marking scheme assigned at start time.
     * Later edits to the question bank never change an attempt that already exists.
     * Contains correct answers — server-side only.
     */
    questionSnapshot: jsonb("question_snapshot").$type<AttemptQuestionSnapshot[]>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** Last time the server heard from the candidate's browser (save, poll or event). */
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    /** Random id of the browser tab that last loaded the attempt; a change means a refresh/recovery. */
    clientSessionId: varchar("client_session_id", { length: 64 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("attempts_exam_candidate_number_uq").on(t.examId, t.candidateId, t.attemptNumber),
    // At most one open attempt per candidate per exam — blocks double-start races at the DB level.
    uniqueIndex("attempts_one_open_uq")
      .on(t.examId, t.candidateId)
      .where(sql`${t.status} = 'IN_PROGRESS'`),
    index("attempts_candidate_idx").on(t.candidateId),
    index("attempts_exam_status_idx").on(t.examId, t.status),
    check("attempts_expiry_after_start", sql`${t.expiresAt} > ${t.startedAt}`),
  ],
);

/* ───────────────────────── answers ───────────────────────── */
export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    response: jsonb("response").$type<AnswerResponse>(),
    isFlagged: boolean("is_flagged").notNull().default(false),
    /** Client-side save counter; a save is applied only if its revision is newer (idempotent retries). */
    revision: integer("revision").notNull().default(0),
    isCorrect: boolean("is_correct"),
    marksAwarded: marks("marks_awarded"),
    feedback: text("feedback"),
    gradedById: uuid("graded_by_id").references(() => users.id, { onDelete: "set null" }),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("answers_attempt_question_uq").on(t.attemptId, t.questionId)],
);

/* ───────────────────────── results ───────────────────────── */
export const results = pgTable(
  "results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .unique()
      .references(() => attempts.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "restrict" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    score: marks("score").notNull(),
    maxScore: marks("max_score").notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2, mode: "number" }).notNull(),
    passed: boolean("passed").notNull(),
    status: resultStatus("status").notNull().default("PROVISIONAL"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Public, unguessable id printed on the PDF report; assigned at publication. */
    verificationCode: varchar("verification_code", { length: 24 }).unique(),
    /** Who last published (or withdrew) this result. */
    publishedById: uuid("published_by_id").references(() => users.id, { onDelete: "set null" }),
    gradedById: uuid("graded_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("results_exam_idx").on(t.examId),
    index("results_candidate_idx").on(t.candidateId),
    check("results_max_score_positive", sql`${t.maxScore} > 0`),
    check("results_percentage_range", sql`${t.percentage} between 0 and 100`),
  ],
);

/* ───────────────────────── announcements ───────────────────────── */
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null = platform-wide announcement. */
    examId: uuid("exam_id").references(() => exams.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    audience: announcementAudience("audience").notNull().default("ALL"),
    isPinned: boolean("is_pinned").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("announcements_exam_idx").on(t.examId), index("announcements_published_idx").on(t.publishedAt)],
);

/* ───────────────────────── incidents (proctoring) ───────────────────────── */
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: incidentType("type").notNull(),
    severity: incidentSeverity("severity").notNull().default("LOW"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedById: uuid("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    ...timestamps,
  },
  (t) => [
    index("incidents_attempt_idx").on(t.attemptId),
    index("incidents_exam_severity_idx").on(t.examId, t.severity),
    index("incidents_candidate_idx").on(t.candidateId),
  ],
);

/* ───────────────────────── disputes ───────────────────────── */
export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resultId: uuid("result_id")
      .notNull()
      .references(() => results.id, { onDelete: "cascade" }),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Optional: the specific question being disputed. */
    questionId: uuid("question_id").references(() => questions.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    status: disputeStatus("status").notNull().default("OPEN"),
    resolution: text("resolution"),
    resolvedById: uuid("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("disputes_result_idx").on(t.resultId),
    index("disputes_candidate_idx").on(t.candidateId),
    index("disputes_status_idx").on(t.status),
  ],
);

/* ───────────────────────── workspace preferences ───────────────────────── */
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferences: jsonb("preferences").$type<WorkspacePreferences>().notNull(),
  ...timestamps,
});

/* ───────────────────────── scratchpads (separate from answers) ───────────────────────── */
export const scratchpads = pgTable("scratchpads", {
  attemptId: uuid("attempt_id")
    .primaryKey()
    .references(() => attempts.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<ScratchpadData>().notNull(),
  ...timestamps,
});

/* ───────────────────────── audit log (platform activity) ───────────────────────── */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    entityType: varchar("entity_type", { length: 32 }),
    entityId: uuid("entity_id"),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_actor_idx").on(t.actorId)],
);
