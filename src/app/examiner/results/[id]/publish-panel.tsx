"use client";

import { AlertTriangle, CheckCircle2, CircleDot, Loader2, Send, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { publishResultsAction, unpublishResultsAction } from "../../actions";

type Checklist = { inProgress: number; needsGrading: number; readyToPublish: number; published: number; withdrawn: number; total: number };

/** Publication controls with a pre-publish checklist. The server enforces the same rules. */
export function PublishPanel({ examId, check, lastPublished }: { examId: string; check: Checklist; lastPublished: { at: string; by: string | null } | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<"publish" | "withdraw" | null>(null);
  const [override, setOverride] = useState(false);
  const willPublish = check.readyToPublish + (override ? check.needsGrading : 0);

  const items = [
    { ok: check.needsGrading === 0, text: check.needsGrading === 0 ? "All written answers are graded" : `${check.needsGrading} attempt(s) still have written answers to grade` },
    { ok: check.inProgress === 0, text: check.inProgress === 0 ? "No attempts in progress" : `${check.inProgress} attempt(s) still in progress (publish them later)` },
    { ok: check.readyToPublish > 0, text: `${check.readyToPublish} graded result(s) ready to publish` },
  ];

  function run(kind: "publish" | "withdraw") {
    start(async () => {
      const r = kind === "publish" ? await publishResultsAction(examId, override) : await unpublishResultsAction(examId);
      setOpen(null);
      if (!r.ok) return void toast.error(r.error);
      if (kind === "publish") {
        const d = r.data as { published: number; overridden: number };
        toast.success(`Published ${d.published} result(s)${d.overridden ? ` (${d.overridden} with ungraded written answers)` : ""}`);
      } else toast.success(`Withdrew ${(r.data as { withdrawn: number }).withdrawn} result(s); their verification codes now show “revoked”.`);
      setOverride(false);
      router.refresh();
    });
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Publication</CardTitle>
        <span className="text-sm text-muted-foreground">
          {check.published} of {check.total} published{check.withdrawn ? ` · ${check.withdrawn} withdrawn` : ""}
          {lastPublished && (
            <>
              {" "}· last change {new Date(lastPublished.at).toLocaleString()}
              {lastPublished.by ? ` by ${lastPublished.by}` : ""}
            </>
          )}
        </span>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm" aria-label="Pre-publish checklist">
          {items.map((i) => (
            <li key={i.text} className="flex items-center gap-2">
              {i.ok ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <CircleDot className="size-4 text-[oklch(0.5_0.13_65)]" aria-hidden />}
              {i.text}
            </li>
          ))}
        </ul>
        {check.needsGrading > 0 && (
          <label className="mt-3 flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
            <Checkbox checked={override} onCheckedChange={(v) => setOverride(!!v)} className="mt-0.5" />
            <span>
              <span className="font-medium">Override:</span> also publish the {check.needsGrading} attempt(s) with ungraded written answers. Those answers count as 0 marks. This is recorded in the audit trail.
            </span>
          </label>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setOpen("publish")} disabled={willPublish === 0 || pending}>
            <Send className="size-4" aria-hidden /> Publish results{willPublish ? ` (${willPublish})` : ""}
          </Button>
          {check.published > 0 && (
            <Button variant="outline" onClick={() => setOpen("withdraw")} disabled={pending}>
              <Undo2 className="size-4" aria-hidden /> Unpublish / withdraw
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{open === "withdraw" ? `Withdraw ${check.published} published result(s)?` : `Publish ${willPublish} result(s)?`}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {open === "withdraw" ? (
                  <p>Candidates will no longer see these results, and their report verification codes will show “revoked”. You can correct grades and publish again.</p>
                ) : (
                  <>
                    <p>
                      {willPublish} candidate(s) will see their score and can download a verifiable PDF. Published grades are locked until withdrawn.
                    </p>
                    {override && (
                      <p className="flex items-start gap-2 text-[oklch(0.45_0.12_70)]">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Includes {check.needsGrading} attempt(s) whose written answers are not graded.
                      </p>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button onClick={() => run(open!)} disabled={pending} variant={open === "withdraw" ? "destructive" : "default"}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {open === "withdraw" ? "Withdraw results" : "Publish results"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
