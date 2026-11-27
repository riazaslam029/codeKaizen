"use client";

import { Archive, Library, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { ImportDialog } from "@/components/shared/import-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QUESTION_TYPE_LABEL, QUESTION_TYPES } from "@/lib/validations/question";
import { archiveQuestionAction } from "../actions";
import { type EditableQuestion, QuestionDialog } from "./question-dialog";

type Row = EditableQuestion & { author: string; authorId: string; usedIn: number };

const SAMPLE_CSV = `type,prompt,options,correct,accepted,marks,negative_marks,difficulty,subject,topic,multi_scoring
MCQ_SINGLE,"Which status code means the resource was created?",200 OK|201 Created|204 No Content,b,,2,0.5,EASY,Web APIs,HTTP,
MCQ_MULTI,"Select all idempotent HTTP methods.",GET|POST|PUT|DELETE,a|c|d,,3,0,MEDIUM,Web APIs,HTTP,PARTIAL
TRUE_FALSE,"JWTs are encrypted by default.",,b,,1,0,EASY,Security,Tokens,
SHORT_ANSWER,"Which SQL keyword removes duplicate rows from a result?",,,DISTINCT,2,0,MEDIUM,Databases,SQL,
ESSAY,"Explain the trade-offs of server-side session storage versus signed tokens.",,,,10,0,HARD,Security,Sessions,
`;

export function QuestionBank({ rows, currentUserId, subjects }: { rows: Row[]; currentUserId: string; subjects: string[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [difficulty, setDifficulty] = useState("ALL");
  const [subject, setSubject] = useState("ALL");
  const [editing, setEditing] = useState<EditableQuestion | null>(null);
  const [open, setOpen] = useState(false);

  const shown = useMemo(
    () =>
      rows.filter(
        (q) =>
          (type === "ALL" || q.type === type) &&
          (difficulty === "ALL" || q.difficulty === difficulty) &&
          (subject === "ALL" || q.subject === subject) &&
          `${q.prompt} ${q.topic ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [rows, query, type, difficulty, subject],
  );

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input placeholder="Search questions or topics" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" aria-label="Search questions" />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="lg:w-40" aria-label="Filter by type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="lg:w-36" aria-label="Filter by difficulty"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Any difficulty</SelectItem>
              <SelectItem value="EASY">Easy</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HARD">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="lg:w-40" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <ImportDialog
            kind="questions"
            title="Import questions"
            description={
              <>
                CSV or JSON. Columns: <code>type, prompt, options</code> (pipe-separated), <code>correct</code> (letters, e.g. <code>a|c</code>),{" "}
                <code>accepted, marks, negative_marks, difficulty, subject, topic, multi_scoring</code>. If any row is invalid nothing is imported; duplicates
                of existing questions are skipped.
              </>
            }
            sample={{ name: "questions-sample.csv", content: SAMPLE_CSV }}
          />
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4" aria-hidden /> New question
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Library} title={rows.length ? "No questions match" : "The bank is empty"} description={rows.length ? "Try different filters." : "Create questions or import a CSV/JSON file."} />
      ) : (
        <Card className="divide-y py-0 shadow-none">
          {shown.map((q) => {
            const mine = q.authorId === currentUserId;
            return (
              <div key={q.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{q.prompt}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{QUESTION_TYPE_LABEL[q.type]}</span>·<span>{q.defaultMarks} marks</span>
                    {q.negativeMarks > 0 && <span>· −{q.negativeMarks}</span>}·<StatusBadge value={q.difficulty} className="text-[11px]" />
                    {q.subject && <span>· {q.subject}{q.topic ? ` / ${q.topic}` : ""}</span>}
                    <span>· by {mine ? "you" : q.author}</span>
                    {q.usedIn > 0 && <span>· in {q.usedIn} exam(s)</span>}
                  </div>
                </div>
                {mine && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditing(q); setOpen(true); }}>
                      <Pencil className="size-4" aria-hidden /> Edit
                    </Button>
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      action={archiveQuestionAction.bind(null, q.id)}
                      disabled={q.usedIn > 0}
                      title={q.usedIn > 0 ? "Remove it from its exams first" : undefined}
                      confirm={{ title: "Archive this question?", description: "It will be hidden from the bank. Past attempts keep their copy.", confirmLabel: "Archive", destructive: true }}
                    >
                      <Archive className="size-4" aria-hidden /> Archive
                    </ActionButton>
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}
      {open && <QuestionDialog key={editing?.id ?? "new"} question={editing} open={open} onOpenChange={setOpen} />}
    </>
  );
}
