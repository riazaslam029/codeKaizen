import type { AttemptQuestionSnapshot, QuestionOption } from "@/db/schema/types";
import type { QuestionType } from "@/db/schema/enums";

/** The ONLY question shape that may be sent to a candidate during an exam. */
export type CandidateQuestion = {
  questionId: string;
  position: number;
  type: QuestionType;
  prompt: string;
  options: QuestionOption[] | null;
  marks: number;
};

/**
 * Builds the candidate-safe view of an attempt's frozen questions.
 * Uses an explicit allow-list (not `delete`/spread) so newly added server-only fields
 * such as `correctAnswer` can never leak by accident.
 */
export function toCandidateQuestions(snapshot: AttemptQuestionSnapshot[]): CandidateQuestion[] {
  return [...snapshot]
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      questionId: q.questionId,
      position: q.position,
      type: q.type,
      prompt: q.prompt,
      options: q.options ? q.options.map((o) => ({ id: o.id, text: o.text })) : null,
      marks: q.marks,
    }));
}
