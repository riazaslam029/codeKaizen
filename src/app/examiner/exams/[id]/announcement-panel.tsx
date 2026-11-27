"use client";

import { Loader2, Megaphone, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shared/field";
import { LocalTime } from "@/components/shared/local-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { postAnnouncementAction } from "../../actions";

/** Announcements appear inside candidates' workspaces within ~20 seconds (polled with the attempt state). */
export function AnnouncementPanel({ examId, items }: { examId: string; items: { id: string; title: string; body: string; publishedAt: string }[] }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    start(async () => {
      const r = await postAnnouncementAction(examId, fd);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      setErrors({});
      form.current?.reset();
      toast.success(r.message);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form ref={form} onSubmit={submit} className="space-y-3" noValidate>
        <Field id="a-title" label="Title" error={errors.title}>
          <Input id="a-title" name="title" placeholder="e.g. Correction to question 4" />
        </Field>
        <Field id="a-body" label="Message" error={errors.body}>
          <Textarea id="a-body" name="body" rows={4} placeholder="Shown to every candidate in this examination, including during an attempt." />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Send announcement
        </Button>
      </form>
      <div>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Megaphone className="size-4" aria-hidden /> No announcements yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className="rounded-md border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{a.title}</p>
                  <LocalTime value={a.publishedAt} className="text-xs text-muted-foreground" />
                </div>
                <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
