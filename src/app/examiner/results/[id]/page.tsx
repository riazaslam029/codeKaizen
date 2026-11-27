import { ArrowLeft, BarChart3, CheckCircle2, Download, Percent, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DistributionChart, PassChart } from "@/components/charts/charts";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { ExamService } from "@/services/exams/exam.service";
import { GradingService } from "@/services/grading/grading.service";
import { ResultsService } from "@/services/results/results.service";
import { PublishPanel } from "./publish-panel";

export const metadata: Metadata = { title: "Examination results" };

const GRADING: Record<string, { label: string; tone: string }> = {
  NEEDS_GRADING: { label: "Needs manual grading", tone: "SUBMITTED" },
  AUTO_GRADED: { label: "Auto-graded", tone: "GRADED" },
  GRADED_MANUAL: { label: "Graded", tone: "GRADED" },
};

export default async function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const examiner = await requireRole("EXAMINER");
  const { id } = await params;
  const [{ exam, totalMarks }, summary] = await Promise.all([ExamService.getForExaminer(examiner, id), ResultsService.examSummary(examiner, id)]);
  const check = await GradingService.publishChecklist(examiner, id);
  const { stats, rows, distribution } = summary;
  const last = rows
    .filter((r) => r.publishedAt)
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())[0];

  return (
    <>
      <Link href="/examiner/results" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All results
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{exam.code}</span>
            <StatusBadge value={exam.phase} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">{totalMarks} total marks · pass mark {exam.passPercentage}% · sandbox previews excluded</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/examiner/analytics/${id}`}>
              <BarChart3 className="size-4" aria-hidden /> Question analytics
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/api/exams/${id}/report`}>
              <Download className="size-4" aria-hidden /> Exam report (PDF)
            </a>
          </Button>
        </div>
      </div>

      <PublishPanel examId={id} check={check} lastPublished={last ? { at: new Date(last.publishedAt!).toISOString(), by: last.publishedBy } : null} />

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Trophy} title="No submitted attempts yet" description="Results appear as soon as candidates submit (or their time runs out)." />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Results" value={stats.count} hint={`${stats.published} published · ${stats.awaitingGrading} awaiting grading`} icon={Users} />
            <StatCard label="Average" value={`${stats.average}%`} hint={`Median ${stats.median}%`} icon={Percent} />
            <StatCard label="Highest" value={`${stats.highest}%`} hint={`Lowest ${stats.lowest}%`} icon={Trophy} />
            <StatCard label="Pass rate" value={`${stats.passRate}%`} hint={`${stats.passed} of ${stats.count} passed`} icon={CheckCircle2} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Score distribution (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <DistributionChart data={distribution} />
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Pass / not passed</CardTitle>
              </CardHeader>
              <CardContent>
                <PassChart passed={stats.passed} failed={stats.count - stats.passed} />
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6 overflow-hidden py-0 shadow-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Candidate</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Marks</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="hidden lg:table-cell">Grading</TableHead>
                  <TableHead>Publication</TableHead>
                  <TableHead className="pr-5 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.resultId}>
                    <TableCell className="pl-5 whitespace-normal">
                      <Link href={`/examiner/attempts/${r.attemptId}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{r.email}</span>
                    </TableCell>
                    <TableCell className="tabular hidden text-right md:table-cell">
                      {r.score}/{r.maxScore}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {r.percentage.toFixed(1)}
                      <span className="block text-xs font-normal text-muted-foreground">{r.passed ? "Pass" : "Not passed"}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className={r.gradingStatus === "NEEDS_GRADING" ? "text-sm font-medium text-[oklch(0.45_0.12_70)]" : "text-sm"}>{GRADING[r.gradingStatus]!.label}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={r.status === "PUBLISHED" ? "PUBLISHED" : r.status === "WITHHELD" ? "WITHHELD" : "PROVISIONAL"} />
                      {r.publishedAt && (
                        <span className="block text-xs text-muted-foreground">
                          <LocalTime value={r.publishedAt} mode="date" />
                          {r.publishedBy ? ` · ${r.publishedBy}` : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {r.status === "PUBLISHED" ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/results/${r.resultId}/pdf`} aria-label={`Download PDF for ${r.name}`}>
                            <Download className="size-4" aria-hidden /> PDF
                          </a>
                        </Button>
                      ) : (
                        <Button variant={r.gradingStatus === "NEEDS_GRADING" ? "default" : "ghost"} size="sm" asChild>
                          <Link href={`/examiner/attempts/${r.attemptId}`}>{r.gradingStatus === "NEEDS_GRADING" ? "Grade" : "Review"}</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
