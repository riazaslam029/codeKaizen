"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createExamAction, updateExamAction } from "../actions";

export type ExamFormValues = {
  title: string;
  code: string;
  description: string | null;
  instructions: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  passPercentage: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
};

/** ISO → value for <input type="datetime-local"> in the examiner's own time zone. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ExamForm({ examId, initial, totalMarks, locked }: { examId?: string; initial?: ExamFormValues; totalMarks?: number; locked?: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [shuffleQuestions, setShuffleQuestions] = useState(initial?.shuffleQuestions ?? false);
  const [shuffleOptions, setShuffleOptions] = useState(initial?.shuffleOptions ?? false);

  const defaults = (() => {
    if (initial) return { starts: toLocalInput(initial.startsAt), ends: toLocalInput(initial.endsAt) };
    const s = new Date(Date.now() + 60 * 60_000);
    s.setMinutes(0, 0, 0);
    return { starts: toLocalInput(s.toISOString()), ends: toLocalInput(new Date(s.getTime() + 3 * 3600_000).toISOString()) };
  })();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const toIso = (v: string) => (v ? new Date(v).toISOString() : "");
    const payload = { ...fd, startsAt: toIso(fd.startsAt!), endsAt: toIso(fd.endsAt!), shuffleQuestions, shuffleOptions };
    start(async () => {
      const r = examId ? await updateExamAction(examId, payload) : await createExamAction(payload);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setErrors({});
      toast.success(r.message);
      if (!examId && r.data && "id" in (r.data as object)) router.push(`/examiner/exams/${(r.data as { id: string }).id}`);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>What candidates see before they start.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field id="title" label="Title" error={errors.title}>
            <Input id="title" name="title" defaultValue={initial?.title} required aria-invalid={!!errors.title} />
          </Field>
          <Field id="code" label="Code" error={errors.code} hint="Unique, e.g. WSEC-101">
            <Input id="code" name="code" defaultValue={initial?.code} className="font-mono uppercase" required aria-invalid={!!errors.code} />
          </Field>
          <Field id="description" label="Description" error={errors.description} className="md:col-span-2">
            <Textarea id="description" name="description" rows={2} defaultValue={initial?.description ?? ""} />
          </Field>
          <Field id="instructions" label="Instructions" error={errors.instructions} className="md:col-span-2" hint="Shown on the start screen and inside the workspace.">
            <Textarea id="instructions" name="instructions" rows={4} defaultValue={initial?.instructions ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Schedule & availability</CardTitle>
          <CardDescription>
            Candidates may start only inside the window. Each attempt ends at start + duration or when the window closes, whichever is first — enforced by the server.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="startsAt" label="Opens" error={errors.startsAt}>
            <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={defaults.starts} required disabled={locked} />
          </Field>
          <Field id="endsAt" label="Closes" error={errors.endsAt}>
            <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={defaults.ends} required disabled={locked} />
          </Field>
          <Field id="durationMinutes" label="Duration (minutes)" error={errors.durationMinutes}>
            <Input id="durationMinutes" name="durationMinutes" type="number" min={1} max={600} defaultValue={initial?.durationMinutes ?? 60} required disabled={locked} />
          </Field>
          <Field id="maxAttempts" label="Attempts allowed" error={errors.maxAttempts}>
            <Input id="maxAttempts" name="maxAttempts" type="number" min={1} max={10} defaultValue={initial?.maxAttempts ?? 1} required />
          </Field>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Marking & delivery</CardTitle>
          <CardDescription>
            Total marks are the sum of the paper&apos;s question marks{typeof totalMarks === "number" ? ` (currently ${totalMarks})` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <Field id="passPercentage" label="Pass mark (%)" error={errors.passPercentage}>
            <Input id="passPercentage" name="passPercentage" type="number" min={0} max={100} defaultValue={initial?.passPercentage ?? 50} required />
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3">
            <span>
              <span className="block text-sm font-medium">Shuffle question order</span>
              <span className="block text-xs text-muted-foreground">Different order per candidate</span>
            </span>
            <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} disabled={locked} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3">
            <span>
              <span className="block text-sm font-medium">Shuffle answer options</span>
              <span className="block text-xs text-muted-foreground">Choice questions only</span>
            </span>
            <Switch checked={shuffleOptions} onCheckedChange={setShuffleOptions} disabled={locked} />
          </label>
        </CardContent>
      </Card>

      {locked && <p className="text-sm text-muted-foreground">Schedule and delivery settings are locked because candidates have already started.</p>}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {examId ? "Save changes" : "Create examination"}
        </Button>
      </div>
    </form>
  );
}
