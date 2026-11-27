import type { AnswerResponse, AttemptQuestionSnapshot } from "@/db/schema/types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function isAnswered(response: AnswerResponse | null | undefined): boolean {
  if (!response) return false;
  if ("optionIds" in response) return response.optionIds.length > 0;
  return response.text.trim().length > 0;
}

export const isAutoGraded = (type: AttemptQuestionSnapshot["type"]) => type !== "ESSAY";

/**
 * Marks one response against the frozen marking scheme in the attempt snapshot.
 * Returns marks = null when the question needs manual grading (non-empty essay).
 *
 * - MCQ_SINGLE / TRUE_FALSE: full marks if correct, minus negativeMarks if wrong, 0 if blank.
 * - MCQ_MULTI ALL_OR_NOTHING: full marks only for the exact set; otherwise minus negativeMarks.
 * - MCQ_MULTI PARTIAL: +marks/k per correct pick, −marks/k per wrong pick (k = #correct), floored at 0.
 * - SHORT_ANSWER: case/space-insensitive match against accepted answers.
 * - ESSAY: blank = 0, otherwise manual.
 */
export function scoreQuestion(
  q: AttemptQuestionSnapshot,
  response: AnswerResponse | null | undefined,
): { isCorrect: boolean | null; marks: number | null } {
  if (!isAnswered(response)) return { isCorrect: q.type === "ESSAY" ? null : false, marks: 0 };

  if (q.type === "ESSAY") return { isCorrect: null, marks: null };

  if (q.type === "SHORT_ANSWER") {
    const text = response && "text" in response ? norm(response.text) : "";
    const accepted = q.correctAnswer && "accepted" in q.correctAnswer ? q.correctAnswer.accepted.map(norm) : [];
    const ok = accepted.includes(text);
    return { isCorrect: ok, marks: ok ? q.marks : -q.negativeMarks };
  }

  const picked = new Set(response && "optionIds" in response ? response.optionIds : []);
  const correct = new Set(q.correctAnswer && "optionIds" in q.correctAnswer ? q.correctAnswer.optionIds : []);
  const exact = picked.size === correct.size && [...picked].every((id) => correct.has(id));

  if (q.type === "MCQ_MULTI" && q.multiScoring === "PARTIAL") {
    const per = q.marks / Math.max(correct.size, 1);
    let m = 0;
    for (const id of picked) m += correct.has(id) ? per : -per;
    return { isCorrect: exact, marks: round2(Math.max(0, m)) };
  }

  return { isCorrect: exact, marks: exact ? q.marks : -q.negativeMarks };
}

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
