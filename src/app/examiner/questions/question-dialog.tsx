"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CorrectAnswer, QuestionOption } from "@/db/schema/types";
import { QUESTION_TYPE_LABEL, QUESTION_TYPES } from "@/lib/validations/question";
import { createQuestionAction, updateQuestionAction } from "../actions";

type QType = (typeof QUESTION_TYPES)[number];
export type EditableQuestion = {
  id: string;
  type: QType;
  prompt: string;
  options: QuestionOption[] | null;
  correctAnswer: CorrectAnswer | null;
  explanation: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  defaultMarks: number;
  negativeMarks: number;
  multiScoring: "ALL_OR_NOTHING" | "PARTIAL";
};

const LETTERS = "abcdefgh";
const relabel = (opts: QuestionOption[]) => opts.map((o, i) => ({ ...o, id: LETTERS[i]! }));

export function QuestionDialog({ question, open, onOpenChange }: { question: EditableQuestion | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [type, setType] = useState<QType>(question?.type ?? "MCQ_SINGLE");
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [options, setOptions] = useState<QuestionOption[]>(question?.options ?? [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }]);
  const [correct, setCorrect] = useState<string[]>(question?.correctAnswer && "optionIds" in question.correctAnswer ? question.correctAnswer.optionIds : []);
  const [accepted, setAccepted] = useState(question?.correctAnswer && "accepted" in question.correctAnswer ? question.correctAnswer.accepted.join("\n") : "");
  const [marks, setMarks] = useState(String(question?.defaultMarks ?? 1));
  const [negative, setNegative] = useState(String(question?.negativeMarks ?? 0));
  const [multiScoring, setMultiScoring] = useState(question?.multiScoring ?? "ALL_OR_NOTHING");
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? "MEDIUM");
  const [subject, setSubject] = useState(question?.subject ?? "");
  const [topic, setTopic] = useState(question?.topic ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");

  const isChoice = type === "MCQ_SINGLE" || type === "MCQ_MULTI" || type === "TRUE_FALSE";

  function changeType(t: QType) {
    setType(t);
    setCorrect([]);
    if (t === "TRUE_FALSE") setOptions([{ id: "a", text: "True" }, { id: "b", text: "False" }]);
    else if ((t === "MCQ_SINGLE" || t === "MCQ_MULTI") && type === "TRUE_FALSE") setOptions([{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }, { id: "d", text: "" }]);
  }

  function save() {
    const payload = {
      type,
      prompt,
      options: isChoice ? options : [],
      correctOptionIds: isChoice ? correct : [],
      accepted: type === "SHORT_ANSWER" ? accepted.split("\n").map((s) => s.trim()).filter(Boolean) : [],
      marks,
      negativeMarks: type === "ESSAY" ? 0 : negative,
      multiScoring,
      difficulty,
      subject,
      topic,
      explanation,
    };
    start(async () => {
      const r = question ? await updateQuestionAction(question.id, payload) : await createQuestionAction(payload);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? { _: r.error });
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? "Edit question" : "New question"}</DialogTitle>
          <DialogDescription>Changes apply to future attempts only — started attempts keep their frozen copy.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="q-type" label="Type" className="sm:col-span-2">
            <Select value={type} onValueChange={(v) => changeType(v as QType)}>
              <SelectTrigger id="q-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="q-diff" label="Difficulty">
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
              <SelectTrigger id="q-diff" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="q-prompt" label="Question" error={errors.prompt} className="sm:col-span-3">
            <Textarea id="q-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-invalid={!!errors.prompt} />
          </Field>

          {isChoice && (
            <fieldset className="space-y-2 sm:col-span-3">
              <legend className="mb-1 text-sm font-medium">
                Options — mark the correct {type === "MCQ_MULTI" ? "answers" : "answer"}
              </legend>
              {type === "MCQ_MULTI" ? (
                options.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={correct.includes(o.id)}
                      onCheckedChange={(v) => setCorrect((c) => (v ? [...c, o.id] : c.filter((x) => x !== o.id)))}
                      aria-label={`Option ${o.id.toUpperCase()} is correct`}
                    />
                    <OptionInput o={o} i={i} options={options} setOptions={setOptions} setCorrect={setCorrect} fixed={false} />
                  </div>
                ))
              ) : (
                <RadioGroup value={correct[0] ?? ""} onValueChange={(v) => setCorrect([v])}>
                  {options.map((o, i) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <RadioGroupItem value={o.id} aria-label={`Option ${o.id.toUpperCase()} is correct`} />
                      <OptionInput o={o} i={i} options={options} setOptions={setOptions} setCorrect={setCorrect} fixed={type === "TRUE_FALSE"} />
                    </div>
                  ))}
                </RadioGroup>
              )}
              {type !== "TRUE_FALSE" && options.length < 8 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setOptions(relabel([...options, { id: "z", text: "" }]))}>
                  <Plus className="size-4" aria-hidden /> Add option
                </Button>
              )}
              {(errors.options || errors.correctOptionIds) && <p className="text-sm text-destructive">{errors.options ?? errors.correctOptionIds}</p>}
            </fieldset>
          )}

          {type === "SHORT_ANSWER" && (
            <Field id="q-accepted" label="Accepted answers (one per line)" error={errors.accepted} hint="Matched case- and space-insensitively." className="sm:col-span-3">
              <Textarea id="q-accepted" rows={3} value={accepted} onChange={(e) => setAccepted(e.target.value)} />
            </Field>
          )}

          <Field id="q-marks" label="Marks" error={errors.marks}>
            <Input id="q-marks" type="number" step="0.25" min={0.25} value={marks} onChange={(e) => setMarks(e.target.value)} />
          </Field>
          {type !== "ESSAY" && (
            <Field id="q-neg" label="Penalty if wrong" error={errors.negativeMarks} hint="0 = no negative marking">
              <Input id="q-neg" type="number" step="0.25" min={0} value={negative} onChange={(e) => setNegative(e.target.value)} />
            </Field>
          )}
          {type === "MCQ_MULTI" && (
            <Field id="q-scheme" label="Multi-select marking">
              <Select value={multiScoring} onValueChange={(v) => setMultiScoring(v as typeof multiScoring)}>
                <SelectTrigger id="q-scheme" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_OR_NOTHING">All or nothing</SelectItem>
                  <SelectItem value="PARTIAL">Partial credit</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field id="q-subject" label="Category / subject">
            <Input id="q-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Web Security" />
          </Field>
          <Field id="q-topic" label="Topic">
            <Input id="q-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Sessions" />
          </Field>
          <Field id="q-expl" label="Examiner notes / explanation" className="sm:col-span-3" hint="Never shown to candidates.">
            <Textarea id="q-expl" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </Field>
        </div>
        {errors._ && <p className="text-sm text-destructive">{errors._}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {question ? "Save question" : "Add to bank"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionInput({
  o,
  i,
  options,
  setOptions,
  setCorrect,
  fixed,
}: {
  o: QuestionOption;
  i: number;
  options: QuestionOption[];
  setOptions: (o: QuestionOption[]) => void;
  setCorrect: (fn: (c: string[]) => string[]) => void;
  fixed: boolean;
}) {
  return (
    <>
      <span className="w-4 font-mono text-xs text-muted-foreground uppercase">{o.id}</span>
      <Input
        value={o.text}
        readOnly={fixed}
        onChange={(e) => setOptions(options.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
        aria-label={`Option ${o.id.toUpperCase()} text`}
        className="flex-1"
      />
      {!fixed && options.length > 2 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove option ${o.id.toUpperCase()}`}
          onClick={() => {
            setOptions(relabel(options.filter((_, k) => k !== i)));
            setCorrect(() => []);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </>
  );
}
