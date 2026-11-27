import { relations } from "drizzle-orm";
import {
  announcements,
  answers,
  attempts,
  disputes,
  enrollments,
  examQuestions,
  exams,
  incidents,
  questions,
  results,
  users,
} from "./tables";

export const usersRelations = relations(users, ({ many }) => ({
  examsCreated: many(exams),
  questionsAuthored: many(questions),
  enrollments: many(enrollments),
  attempts: many(attempts),
}));

export const examsRelations = relations(exams, ({ one, many }) => ({
  createdBy: one(users, { fields: [exams.createdById], references: [users.id] }),
  examQuestions: many(examQuestions),
  enrollments: many(enrollments),
  attempts: many(attempts),
  announcements: many(announcements),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  author: one(users, { fields: [questions.authorId], references: [users.id] }),
  examQuestions: many(examQuestions),
}));

export const examQuestionsRelations = relations(examQuestions, ({ one }) => ({
  exam: one(exams, { fields: [examQuestions.examId], references: [exams.id] }),
  question: one(questions, { fields: [examQuestions.questionId], references: [questions.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  exam: one(exams, { fields: [enrollments.examId], references: [exams.id] }),
  candidate: one(users, { fields: [enrollments.candidateId], references: [users.id] }),
  attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  exam: one(exams, { fields: [attempts.examId], references: [exams.id] }),
  candidate: one(users, { fields: [attempts.candidateId], references: [users.id] }),
  enrollment: one(enrollments, { fields: [attempts.enrollmentId], references: [enrollments.id] }),
  answers: many(answers),
  result: one(results),
  incidents: many(incidents),
}));

export const answersRelations = relations(answers, ({ one }) => ({
  attempt: one(attempts, { fields: [answers.attemptId], references: [attempts.id] }),
  question: one(questions, { fields: [answers.questionId], references: [questions.id] }),
}));

export const resultsRelations = relations(results, ({ one, many }) => ({
  attempt: one(attempts, { fields: [results.attemptId], references: [attempts.id] }),
  exam: one(exams, { fields: [results.examId], references: [exams.id] }),
  candidate: one(users, { fields: [results.candidateId], references: [users.id] }),
  disputes: many(disputes),
}));

export const announcementsRelations = relations(announcements, ({ one }) => ({
  exam: one(exams, { fields: [announcements.examId], references: [exams.id] }),
  author: one(users, { fields: [announcements.authorId], references: [users.id] }),
}));

export const incidentsRelations = relations(incidents, ({ one }) => ({
  attempt: one(attempts, { fields: [incidents.attemptId], references: [attempts.id] }),
  exam: one(exams, { fields: [incidents.examId], references: [exams.id] }),
  candidate: one(users, { fields: [incidents.candidateId], references: [users.id] }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  result: one(results, { fields: [disputes.resultId], references: [results.id] }),
  candidate: one(users, { fields: [disputes.candidateId], references: [users.id] }),
  question: one(questions, { fields: [disputes.questionId], references: [questions.id] }),
}));
