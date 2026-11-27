"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gradeAnswerAction } from "../../actions";

export function GradeForm(props: {
  attemptId: string;
  questionId: string;
  max: number;
  min: number;
  current: number | null;
  feedback: string;
  manual: boolean;
  needsGrading: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState(props.current === null ? "" : String(props.current));
  const [feedback, setFeedback] = useState(props.feedback);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function save() {
    const n = Number(marks);
    if (marks === "" || Number.isNaN(n) || n < props.min || n > props.max) {
      setError(`Enter a mark between ${props.min} and ${props.max}`);
      return;
    }
    setError("");
    start(async () => {
      const r = await gradeAnswerAction({ attemptId: props.attemptId, questionId: props.questionId, marks: n, feedback });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.data && r.data.pending > 0 ? `Saved · ${r.data.pending} written answer(s) left` : "Saved · attempt fully graded");
      router.refresh();
    });
  }

  const id = `m-${props.questionId}`;
  return (
    <div className={`rounded-md border p-3 ${props.needsGrading ? "border-warning/50 bg-warning/5" : "bg-muted/30"}`}>
      <div className="grid gap-3 sm:grid-cols-[9rem_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor={id}>Marks (max {props.max})</Label>
          <Input id={id} type="number" step="0.25" min={props.min} max={props.max} value={marks} onChange={(e) => setMarks(e.target.value)} disabled={props.locked} aria-invalid={!!error} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`f-${props.questionId}`}>Feedback to candidate (optional)</Label>
          <Textarea id={`f-${props.questionId}`} rows={1} value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={props.locked} className="min-h-9" />
        </div>
        <Button onClick={save} disabled={pending || props.locked} variant={props.needsGrading ? "default" : "outline"}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {props.manual || props.needsGrading ? "Save grade" : "Override"}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : props.needsGrading ? "Needs a mark." : props.manual ? "Graded by an examiner." : "Auto-marked from the frozen marking scheme. You may override before publication."}
      </p>
    </div>
  );
}
