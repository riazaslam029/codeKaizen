import { BookOpenCheck, MonitorDot, PenLine, Plus, Radio, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { ExamService } from "@/services/exams/exam.service";
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Overview" };

export default async function ExaminerOverview() {
  const examiner = await requireRole("EXAMINER");
  const [exams, overview, queue] = await Promise.all([
    ExamService.listForExaminer(examiner.id),
    ResultsService.examinerOverview(examiner),
    ResultsService.gradingQueue(examiner),
  ]);
  const pendingGrading = queue.filter((q) => q.pending > 0).length;
  const live = exams.filter((e) => e.phase === "ONGOING");
  const next = exams.filter((e) => e.phase === "SCHEDULED" || e.phase === "DRAFT").slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${examiner.name.split(" ")[0]}`}
        description="Your examinations, live attempts and grading work."
        actions={<Button asChild><Link href="/examiner/exams/new"><Plus className="size-4" aria-hidden /> New examination</Link></Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Examinations" value={overview.exams} hint={`${overview.live} open now`} icon={BookOpenCheck} />
        <StatCard label="Attempts in progress" value={overview.inProgress} icon={Radio} />
        <StatCard label="Awaiting manual grading" value={pendingGrading} hint="Attempts with written answers" icon={PenLine} />
        <StatCard label="Unpublished results" value={overview.unpublished} hint={`${overview.submitted} attempts submitted`} icon={Trophy} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Live now</CardTitle><Link href="/examiner/monitoring" className="text-sm font-medium text-primary hover:underline">Monitoring</Link></CardHeader>
          <CardContent>
            {live.length === 0 ? (
              <EmptyState icon={MonitorDot} title="No examination is running" description="Ongoing examinations appear here with a link to live monitoring." />
            ) : (
              <ul className="divide-y">
                {live.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      <span className="block text-sm font-medium">{e.title}</span>
                      <span className="block text-xs text-muted-foreground">Closes <LocalTime value={e.endsAt} /> · {e.candidateCount} enrolled</span>
                    </span>
                    <Button size="sm" asChild><Link href={`/examiner/monitoring/${e.id}`}>Monitor</Link></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Upcoming & drafts</CardTitle><Link href="/examiner/exams" className="text-sm font-medium text-primary hover:underline">All examinations</Link></CardHeader>
          <CardContent>
            {next.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y">
                {next.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/examiner/exams/${e.id}`} className="min-w-0">
                      <span className="block truncate text-sm font-medium hover:underline">{e.title}</span>
                      <span className="block text-xs text-muted-foreground"><LocalTime value={e.startsAt} /> · {e.questionCount} questions</span>
                    </Link>
                    <StatusBadge value={e.phase} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
