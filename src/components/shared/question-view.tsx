import { CheckCircle2, Circle, Square, SquareCheck } from "lucide-react";
import type { CorrectAnswer, QuestionOption } from "@/db/schema/types";
import { cn } from "@/lib/utils";
import { QUESTION_TYPE_LABEL } from "@/lib/validations/question";

/** Read-only question rendering for examiners (shows the answer key). Never used in candidate views. */
export function QuestionKeyView({
  index,
  q,
  selected,
}: {
  index: number;
  q: {
    type: keyof typeof QUESTION_TYPE_LABEL;
    prompt: string;
    options: QuestionOption[] | null;
    correctAnswer: CorrectAnswer | null;
    marks: number;
    negativeMarks?: number;
    multiScoring?: string;
  };
  /** Candidate's selected option ids, when reviewing an attempt. */
  selected?: string[];
}) {
  const correct = new Set(q.correctAnswer && "optionIds" in q.correctAnswer ? q.correctAnswer.optionIds : []);
  const multi = q.type === "MCQ_MULTI";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">Question {index}</p>
        <p className="text-xs text-muted-foreground">
          {QUESTION_TYPE_LABEL[q.type]} · {q.marks} marks
          {q.negativeMarks ? ` · −${q.negativeMarks} if wrong` : ""}
          {multi && q.multiScoring === "PARTIAL" ? " · partial credit" : ""}
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{q.prompt}</p>
      {q.options && (
        <ul className="mt-3 space-y-1.5">
          {q.options.map((o) => {
            const isCorrect = correct.has(o.id);
            const isPicked = selected?.includes(o.id);
            const Icon = multi ? (isPicked ? SquareCheck : Square) : isPicked ? CheckCircle2 : Circle;
            return (
              <li
                key={o.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm",
                  isCorrect && "border-success/40 bg-success/8",
                  isPicked && !isCorrect && "border-destructive/40 bg-destructive/5",
                )}
              >
                <Icon className={cn("size-4 shrink-0", isPicked ? "text-foreground" : "text-muted-foreground/50")} aria-hidden />
                <span className="font-mono text-xs text-muted-foreground uppercase">{o.id}</span>
                <span className="flex-1">{o.text}</span>
                {isCorrect && <span className="text-xs font-medium text-success">Correct</span>}
                {isPicked && <span className="sr-only">(selected by candidate)</span>}
              </li>
            );
          })}
        </ul>
      )}
      {q.correctAnswer && "accepted" in q.correctAnswer && (
        <p className="mt-3 text-sm">
          <span className="text-muted-foreground">Accepted answers: </span>
          {q.correctAnswer.accepted.join(" · ")}
        </p>
      )}
      {q.type === "ESSAY" && <p className="mt-3 text-xs text-muted-foreground">Written response — graded manually.</p>}
    </div>
  );
}
