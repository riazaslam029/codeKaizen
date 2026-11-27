"use client";

import { ArrowDown, ArrowUp, Library, Loader2, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QUESTION_TYPE_LABEL } from "@/lib/validations/question";
import { addQuestionsAction, moveQuestionAction, removeQuestionAction } from "../../actions";

type PaperQ = { id: string; position: number; type: keyof typeof QUESTION_TYPE_LABEL; prompt: string; marks: number; difficulty: string; topic: string | null };
type BankQ = { id: string; type: keyof typeof QUESTION_TYPE_LABEL; prompt: string; marks: number; difficulty: string; subject: string | null };

export function PaperManager({ examId, paper, bank, editable }: { examId: string; paper: PaperQ[]; bank: BankQ[]; editable: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const inPaper = useMemo(() => new Set(paper.map((p) => p.id)), [paper]);
  const available = bank.filter((q) => !inPaper.has(q.id) && (q.prompt.toLowerCase().includes(query.toLowerCase()) || (q.subject ?? "").toLowerCase().includes(query.toLowerCase())));
  const total = paper.reduce((s, q) => s + q.marks, 0);

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) {
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {paper.length} questions · <span className="tabular font-medium text-foreground">{total}</span> total marks
          {!editable && " · locked after publication (attempts keep a frozen copy)"}
        </p>
        {editable && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> Add from bank
          </Button>
        )}
      </div>

      {paper.length === 0 ? (
        <EmptyState
          icon={Library}
          title="The paper is empty"
          description="Add questions from the shared bank. You can create new ones in the question bank first."
          action={
            <Button variant="outline" asChild>
              <Link href="/examiner/questions">Open question bank</Link>
            </Button>
          }
        />
      ) : (
        <Card className="divide-y py-0 shadow-none">
          {paper.map((q, i) => (
            <div key={q.id} className="flex items-start gap-4 p-4">
              <span className="tabular mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm">{q.prompt}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{QUESTION_TYPE_LABEL[q.type]}</span>·<span>{q.marks} marks</span>·<StatusBadge value={q.difficulty} className="text-[11px]" />
                  {q.topic && <span>· {q.topic}</span>}
                </div>
              </div>
              {editable && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" aria-label="Move up" disabled={pending || i === 0} onClick={() => run(() => moveQuestionAction(examId, q.id, "up"))}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Move down" disabled={pending || i === paper.length - 1} onClick={() => run(() => moveQuestionAction(examId, q.id, "down"))}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Remove from paper" disabled={pending} onClick={() => run(() => removeQuestionAction(examId, q.id))}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add questions from the bank</DialogTitle>
            <DialogDescription>{available.length} questions available. Selected questions are appended in this order.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input placeholder="Search text or subject" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" aria-label="Search the bank" />
          </div>
          <ScrollArea className="h-80 rounded-md border">
            <ul className="divide-y">
              {available.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nothing to add.</li>}
              {available.map((q) => (
                <li key={q.id}>
                  <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/50">
                    <Checkbox
                      checked={picked.has(q.id)}
                      onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); if (v) n.add(q.id); else n.delete(q.id); return n; })}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm">{q.prompt}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {QUESTION_TYPE_LABEL[q.type]} · {q.marks} marks · {q.difficulty.toLowerCase()}
                        {q.subject ? ` · ${q.subject}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={picked.size === 0 || pending}
              onClick={() =>
                run(
                  async () => {
                    const r = await addQuestionsAction(examId, [...picked]);
                    return r.ok ? { ok: true, message: `${r.data.added} question(s) added` } : r;
                  },
                  () => {
                    setPicked(new Set());
                    setOpen(false);
                  },
                )
              }
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Add {picked.size || ""} selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
