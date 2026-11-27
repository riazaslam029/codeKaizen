import { eq } from "drizzle-orm";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/shared/local-time";
import { StartAttemptButton } from "@/components/shared/start-attempt-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { exams } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { formatDuration } from "@/lib/format";
import { ExamService } from "@/services/exams/exam.service";

export const metadata: Metadata = { title: "Examination" };

export default async function CandidateExamPage({ params }: { params: Promise<{ id: string }> }) {
  const candidate = await requireRole("CANDIDATE");
  const { id } = await params;
  // Only exams the candidate is enrolled in are returned — others 404.
  const e = (await ExamService.listForCandidate(candidate.id)).find((x) => x.id === id);
  if (!e) notFound();
  const [extra] = await db.select({ instructions: exams.instructions, description: exams.description, passPercentage: exams.passPercentage }).from(exams).where(eq(exams.id, id)).limit(1);

  const checks = [
    { ok: e.enrollmentStatus === "ENROLLED", text: e.enrollmentStatus === "ENROLLED" ? "You are enrolled" : `Enrolment is ${e.enrollmentStatus.toLowerCase()}` },
    { ok: e.phase === "ONGOING", text: e.phase === "ONGOING" ? "The examination window is open" : e.phase === "SCHEDULED" ? "The window has not opened yet" : "The window has closed" },
    { ok: !!e.openAttemptId || e.attemptsUsed < e.maxAttempts, text: e.openAttemptId ? "You have an attempt in progress" : `${e.maxAttempts - e.attemptsUsed} of ${e.maxAttempts} attempt(s) remaining` },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/candidate/exams" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> My examinations
      </Link>
      <div className="mb-6">
        <div className="flex items-center gap-2"><span className="font-mono text-sm text-muted-foreground">{e.code}</span><StatusBadge value={e.phase} /></div>
        <h1 className="mt-1 text-2xl font-semibold">{e.title}</h1>
        {extra?.description && <p className="mt-2 text-muted-foreground">{extra.description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Opens", <LocalTime key="o" value={e.startsAt} />],
          ["Closes", <LocalTime key="c" value={e.endsAt} />],
          ["Duration", formatDuration(e.durationMinutes)],
        ].map(([k, v]) => (
          <Card key={String(k)} className="gap-1 py-4 shadow-none"><CardContent className="px-4"><p className="text-xs text-muted-foreground">{k}</p><p className="tabular mt-1 font-medium">{v}</p></CardContent></Card>
        ))}
      </div>
      <Card className="mt-6 shadow-none">
        <CardHeader><CardTitle className="text-base">Instructions</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {extra?.instructions && <p className="whitespace-pre-line">{extra.instructions}</p>}
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>The timer is kept by the server. It keeps running if you lose connection or close the tab, and reconnecting does not add time.</li>
            <li>Answers save automatically. If you go offline they are kept on this device and synced when you reconnect.</li>
            <li>When time runs out your attempt is submitted automatically with every answer the server received.</li>
            <li>Pass mark: {extra?.passPercentage ?? 50}%. Results appear after your examiner publishes them.</li>
          </ul>
        </CardContent>
      </Card>
      <Card className="mt-6 shadow-none">
        <CardHeader><CardTitle className="text-base">Eligibility</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.text} className="flex items-center gap-2 text-sm">
                {c.ok ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <XCircle className="size-4 text-destructive" aria-hidden />}
                {c.text}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            {e.canStart ? (
              <StartAttemptButton examId={e.id} resume={!!e.openAttemptId} size="lg" />
            ) : e.publishedResult ? (
              <Link href={`/candidate/results/${e.publishedResult.resultId}`} className="text-sm font-medium text-primary hover:underline">View your published result →</Link>
            ) : (
              <p className="text-sm text-muted-foreground">You cannot start this examination right now.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
