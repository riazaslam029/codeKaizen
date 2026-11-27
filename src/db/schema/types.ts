import type { MultiScoring, QuestionType } from "./enums";

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
  multiScoring: MultiScoring;
};

export type WorkspacePreferences = {
  fontSize: "sm" | "md" | "lg" | "xl";
  showNavigator: boolean;
  layout: "split" | "focus";
  theme: "light" | "dark" | "contrast";
};

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  fontSize: "md",
  showNavigator: true,
  layout: "split",
  theme: "light",
};

export type ScratchStroke = { points: [number, number][]; width: number; erase?: boolean };
export type ScratchPage = { id: string; title: string; notes: string; strokes: ScratchStroke[] };
export type ScratchpadData = { pages: ScratchPage[] };
