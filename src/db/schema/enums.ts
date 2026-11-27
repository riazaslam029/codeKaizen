import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["ADMIN", "EXAMINER", "CANDIDATE"]);

export const examStatus = pgEnum("exam_status", ["DRAFT", "PUBLISHED", "ACTIVE", "CLOSED", "ARCHIVED"]);

export const questionType = pgEnum("question_type", [
  "MCQ_SINGLE",
  "MCQ_MULTI",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "ESSAY",
]);

export const difficulty = pgEnum("difficulty", ["EASY", "MEDIUM", "HARD"]);

export const enrollmentStatus = pgEnum("enrollment_status", ["ENROLLED", "WITHDRAWN", "BLOCKED"]);

export const attemptStatus = pgEnum("attempt_status", [
  "IN_PROGRESS",
  "SUBMITTED",
  "AUTO_SUBMITTED",
  "GRADED",
  "INVALIDATED",
]);

export const resultStatus = pgEnum("result_status", ["PROVISIONAL", "PUBLISHED", "WITHHELD"]);

export const announcementAudience = pgEnum("announcement_audience", ["ALL", "EXAMINERS", "CANDIDATES"]);

export const incidentType = pgEnum("incident_type", [
  "TAB_SWITCH",
  "FULLSCREEN_EXIT",
  "COPY_PASTE",
  "MULTIPLE_SESSIONS",
  "NETWORK_LOSS",
  "OTHER",
]);

export const incidentSeverity = pgEnum("incident_severity", ["LOW", "MEDIUM", "HIGH"]);

export const disputeStatus = pgEnum("dispute_status", ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"]);

export type UserRole = (typeof userRole.enumValues)[number];
export type QuestionType = (typeof questionType.enumValues)[number];
export type ExamStatus = (typeof examStatus.enumValues)[number];
export type AttemptStatus = (typeof attemptStatus.enumValues)[number];
