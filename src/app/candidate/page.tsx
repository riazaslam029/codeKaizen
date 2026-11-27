import { CalendarClock, CheckCircle2, ClipboardList, PlayCircle, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
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

  return (
    <>
      <PageHeader title={`Hello, ${candidate.name.split(" ")[0]}`} description="Your examinations at a glance. Times are shown in your local time zone." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available now" value={available.length} icon={PlayCircle} />
        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarClock} />
        <StatCard label="Completed" value={completed.length} icon={CheckCircle2} />
        <StatCard label="Published results" value={results.length} icon={Trophy} />
      </div>

      <section className="mt-8" aria-labelledby="avail">
        <h2 id="avail" className="mb-3 text-lg font-semibold">Available now</h2>
        {available.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing to sit right now" description={upcoming.length ? "Your next examination appears here when its window opens." : "When you are enrolled in an open examination it will appear here."} />
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
