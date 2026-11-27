import { z } from "zod";
import type { CorrectAnswer, QuestionOption } from "@/db/schema/types";

export const QUESTION_TYPES = ["MCQ_SINGLE", "MCQ_MULTI", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY"] as const;
export const QUESTION_TYPE_LABEL: Record<(typeof QUESTION_TYPES)[number], string> = {
  MCQ_SINGLE: "Single answer",
  MCQ_MULTI: "Multiple select",
  TRUE_FALSE: "True / False",
  SHORT_ANSWER: "Short answer",
  ESSAY: "Written response",
};

const optionId = z.string().regex(/^[a-h]$/);

export const questionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(5, "Question text is too short").max(4000),
    options: z.array(z.object({ id: optionId, text: z.string().trim().min(1, "Option text is required").max(500) })).default([]),
    correctOptionIds: z.array(optionId).default([]),
    accepted: z.array(z.string().trim().min(1).max(200)).default([]),
    marks: z.coerce.number().min(0.25, "At least 0.25 marks").max(100),
    negativeMarks: z.coerce.number().min(0).max(100).default(0),
    multiScoring: z.enum(["ALL_OR_NOTHING", "PARTIAL"]).default("ALL_OR_NOTHING"),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
    subject: z.string().trim().max(80).optional().default(""),
    topic: z.string().trim().max(80).optional().default(""),
    explanation: z.string().trim().max(2000).optional().default(""),
  })
  .superRefine((q, ctx) => {
    const isChoice = q.type === "MCQ_SINGLE" || q.type === "MCQ_MULTI" || q.type === "TRUE_FALSE";
    if (q.negativeMarks > q.marks) ctx.addIssue({ code: "custom", path: ["negativeMarks"], message: "Penalty cannot exceed the marks" });
    if (isChoice) {
      if (q.options.length < 2) ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least two options" });
      if (q.options.length > 8) ctx.addIssue({ code: "custom", path: ["options"], message: "At most eight options" });
      const ids = new Set(q.options.map((o) => o.id));
      const texts = new Set(q.options.map((o) => o.text.toLowerCase()));
      if (ids.size !== q.options.length || texts.size !== q.options.length)
        ctx.addIssue({ code: "custom", path: ["options"], message: "Options must be unique" });
      if (q.correctOptionIds.some((id) => !ids.has(id)))
        ctx.addIssue({ code: "custom", path: ["correctOptionIds"], message: "Correct answer must be one of the options" });
      if (q.type === "MCQ_MULTI" ? q.correctOptionIds.length < 1 : q.correctOptionIds.length !== 1)
        ctx.addIssue({
          code: "custom",
          path: ["correctOptionIds"],
          message: q.type === "MCQ_MULTI" ? "Mark at least one correct option" : "Mark exactly one correct option",
        });
    }
    if (q.type === "SHORT_ANSWER" && q.accepted.length === 0)
      ctx.addIssue({ code: "custom", path: ["accepted"], message: "Add at least one accepted answer" });
  });

export type QuestionInput = z.infer<typeof questionSchema>;

/** Converts validated form input into the stored columns. */
export function toQuestionColumns(q: QuestionInput): {
  options: QuestionOption[] | null;
  correctAnswer: CorrectAnswer | null;
} {
  switch (q.type) {
    case "MCQ_SINGLE":
    case "MCQ_MULTI":
    case "TRUE_FALSE":
      return { options: q.options, correctAnswer: { optionIds: [...new Set(q.correctOptionIds)].sort() } };
    case "SHORT_ANSWER":
      return { options: null, correctAnswer: { accepted: q.accepted } };
    case "ESSAY":
      return { options: null, correctAnswer: null };
  }
}
