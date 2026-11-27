import type { QuestionType } from "./enums";

export type QuestionOption = { id: string; text: string };

/**
 * Marking key.
 * - MCQ_SINGLE / TRUE_FALSE: `{ optionIds: [id] }`
 * - MCQ_MULTI: `{ optionIds: [...] }` (all must match)
 * - SHORT_ANSWER: `{ accepted: [...] }` (case-insensitive, trimmed)
 */
export type CorrectAnswer = { optionIds: string[] } | { accepted: string[] };

/** What a candidate submits for a question. */
export type AnswerResponse = { optionIds: string[] } | { text: string };

/** Question + marking scheme frozen into an attempt when it starts. Server-only. */
export type AttemptQuestionSnapshot = {
  questionId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  correctAnswer: CorrectAnswer | null;
  marks: number;
  negativeMarks: number;
};
