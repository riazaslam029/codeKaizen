import { CalendarClock, Timer, UserRound } from "lucide-react";
import Link from "next/link";
import { TimeRange } from "@/components/shared/time-range";
import { StartAttemptButton } from "@/components/shared/start-attempt-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { formatDuration, serverClock } from "@/lib/format";
import type { ExamService } from "@/services/exams/exam.service";

export type CandidateExam = Awaited<ReturnType<typeof ExamService.listForCandidate>>[number];

export function ExamCard({ e }: { e: CandidateExam }) {
  const badge = e.enrollmentStatus !== "ENROLLED" ? e.enrollmentStatus : e.openAttemptId ? "IN_PROGRESS" : e.latestAttempt ? e.latestAttempt.status : e.phase;
  return (
    <Card className="h-full gap-3 shadow-none transition-shadow duration-200 hover:shadow-sm">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
          <StatusBadge value={badge} />
        </div>
        <h3 className="text-base leading-snug font-semibold">
          <Link href={`/candidate/exams/${e.id}`} className="hover:underline">{e.title}</Link>
        </h3>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Window</dt>
            <dd className="tabular"><TimeRange start={e.startsAt} end={e.endsAt} /></dd>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Duration</dt>
            <dd>{formatDuration(e.durationMinutes)} · {e.attemptsUsed}/{e.maxAttempts} attempt(s) used</dd>
          </div>
          <div className="flex items-center gap-2">
            <UserRound className="size-4 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Examiner</dt>
            <dd>{e.examiner}</dd>
          </div>
        </dl>
      </CardContent>
      {e.openAttemptId && e.latestAttempt && (
        <p className="mx-6 -mt-1 rounded-md bg-success/10 px-3 py-2 text-sm text-success" role="status">
          In progress · about {Math.max(0, Math.ceil((new Date(e.latestAttempt.expiresAt).getTime() - serverClock()) / 60_000))} min left on the server clock
        </p>
      )}
      <CardFooter className="mt-auto">
        {e.canStart ? (
          <StartAttemptButton examId={e.id} resume={!!e.openAttemptId} />
        ) : e.publishedResult ? (
          <Button variant="outline" asChild>
            <Link href={`/candidate/results/${e.publishedResult.resultId}`}>View result</Link>
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href={`/candidate/exams/${e.id}`}>Details & instructions</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
