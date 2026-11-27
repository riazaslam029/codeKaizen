import { CalendarClock, CheckCircle2, ClipboardList, PlayCircle, ShieldCheck, TrendingUp, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PerformanceTrendChart } from "@/components/charts/charts";
import { Countdown } from "@/components/shared/countdown";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { requireRole } from "@/lib/auth/dal";
import { AttemptService } from "@/services/attempts/attempt.service";
import { ExamService } from "@/services/exams/exam.service";
import { ResultsService } from "@/services/results/results.service";
import { ExamCard } from "./exam-card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CandidateDashboard() {
  const candidate = await requireRole("CANDIDATE");
  await AttemptService.finalizeExpired({ candidateId: candidate.id });
  const [list, results] = await Promise.all([ExamService.listForCandidate(candidate.id), ResultsService.candidateResults(candidate.id)]);
  const available = list.filter((e) => e.canStart);
  const upcoming = list.filter((e) => e.phase === "SCHEDULED" && e.enrollmentStatus === "ENROLLED");
  const completed = list.filter((e) => e.latestAttempt && !e.openAttemptId);
  const next = upcoming[0];
  const trend = [...results]
    .sort((a, b) => +new Date(a.publishedAt ?? 0) - +new Date(b.publishedAt ?? 0))
    .map((r) => ({ label: r.examCode, percentage: Math.round(Number(r.percentage)), pass: r.passPercentage }));
  const passed = results.filter((r) => r.passed).length;

  return (
    <>
      <PageHeader
        title={`Hello, ${candidate.name.split(" ")[0]}`}
        description="Your examinations at a glance. Times are shown in your local time zone."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-sm font-medium text-success">
            <ShieldCheck className="size-4" aria-hidden /> Account active
          </span>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Available now" value={available.length} hint={available.length ? "Ready to start or resume" : "Nothing open right now"} icon={PlayCircle} tone="success" />
        <StatCard label="Upcoming" value={upcoming.length} hint={next ? `Next: ${next.code}` : "None scheduled"} icon={CalendarClock} tone="info" />
        <StatCard label="Completed" value={completed.length} hint="Submitted attempts" icon={CheckCircle2} tone="neutral" />
        <StatCard label="Published results" value={results.length} hint={results.length ? `${passed} passed` : "Appear once released"} icon={Trophy} tone="warning" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Next examination</CardTitle>
          </CardHeader>
          <CardContent>
            {next ? (
              <div>
                <p className="font-mono text-xs text-muted-foreground">{next.code}</p>
                <p className="mt-1 font-semibold">{next.title}</p>
                <p className="mt-4 text-xs tracking-wide text-muted-foreground uppercase">Opens in</p>
                <Countdown to={next.startsAt} className="tabular mt-1 block text-3xl font-semibold tracking-tight text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">
                  <LocalTime value={next.startsAt} />
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href={`/candidate/exams/${next.id}`}>Read the instructions</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming examinations. {available.length ? "You have an examination open now — see below." : "Your examiner will enrol you when one is scheduled."}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-muted-foreground" aria-hidden /> Performance trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length === 0 ? (
              <p className="text-sm text-muted-foreground">Your scores will be charted here once results are published.</p>
            ) : (
              <PerformanceTrendChart data={trend} />
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-8" aria-labelledby="avail">
        <h2 id="avail" className="mb-3 text-lg font-semibold">Available now</h2>
        {available.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nothing to sit right now"
            description={upcoming.length ? "Your next examination appears here when its window opens." : "When you are enrolled in an open examination it will appear here."}
            action={<Button asChild variant="outline"><Link href="/candidate/exams">Open My examinations</Link></Button>}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{available.map((e) => <li key={e.id}><ExamCard e={e} /></li>)}</ul>
        )}
      </section>

      {upcoming.length > 0 && (
        <section className="mt-8" aria-labelledby="up">
          <h2 id="up" className="mb-3 text-lg font-semibold">Upcoming</h2>
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{upcoming.map((e) => <li key={e.id}><ExamCard e={e} /></li>)}</ul>
        </section>
      )}

      <p className="mt-8 text-sm text-muted-foreground">
        See every examination, including completed ones, in <Link href="/candidate/exams" className="font-medium text-primary hover:underline">My examinations</Link>.
      </p>
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
