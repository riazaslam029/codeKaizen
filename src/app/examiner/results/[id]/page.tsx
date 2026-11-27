import { ArrowLeft, Download, Send, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DistributionChart, PassChart } from "@/components/charts/charts";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { ExamService } from "@/services/exams/exam.service";
import { ResultsService } from "@/services/results/results.service";
import { BarChart3, CheckCircle2, Percent, Users } from "lucide-react";
import { publishResultsAction } from "../../actions";

export const metadata: Metadata = { title: "Examination results" };

export default async function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const examiner = await requireRole("EXAMINER");
  const { id } = await params;
  const [{ exam, totalMarks }, summary] = await Promise.all([ExamService.getForExaminer(examiner, id), ResultsService.examSummary(examiner, id)]);
  const { stats, rows, distribution } = summary;
  const publishable = rows.filter((r) => r.status !== "PUBLISHED" && r.attemptStatus === "GRADED").length;

  return (
    <>
      <Link href="/examiner/results" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All results
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><span className="font-mono text-sm text-muted-foreground">{exam.code}</span><StatusBadge value={exam.phase} /></div>
          <h1 className="mt-1 text-2xl font-semibold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">{totalMarks} total marks · pass mark {exam.passPercentage}% · sandbox attempts excluded</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href={`/examiner/analytics/${id}`}><BarChart3 className="size-4" aria-hidden /> Question analytics</Link></Button>
          <ActionButton
            action={publishResultsAction.bind(null, id)}
            disabled={publishable === 0}
            successMessage={(d) => {
              const r = d as { published: number; awaitingGrading: number };
              return `Published ${r.published} result(s)${r.awaitingGrading ? ` · ${r.awaitingGrading} still awaiting grading` : ""}`;
            }}
            confirm={{
              title: `Publish ${publishable} result(s)?`,
              description: "Candidates will see their scores and can download a verifiable PDF. Published grades are locked. Attempts still awaiting manual grading are not published.",
              confirmLabel: "Publish results",
            }}
          >
            <Send className="size-4" aria-hidden /> Publish {publishable || ""} graded
          </ActionButton>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="No submitted attempts yet" description="Results appear as soon as candidates submit (or their time runs out)." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Results" value={stats.count} hint={`${stats.published} published · ${stats.awaitingGrading} awaiting grading`} icon={Users} />
            <StatCard label="Average" value={`${stats.average}%`} hint={`Median ${stats.median}%`} icon={Percent} />
            <StatCard label="Highest / lowest" value={`${stats.highest}%`} hint={`Lowest ${stats.lowest}%`} icon={Trophy} />
            <StatCard label="Pass rate" value={`${stats.passRate}%`} hint={`${stats.passed} of ${stats.count} passed`} icon={CheckCircle2} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Score distribution (%)</CardTitle></CardHeader><CardContent><DistributionChart data={distribution} /></CardContent></Card>
            <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Pass / not passed</CardTitle></CardHeader><CardContent><PassChart passed={stats.passed} failed={stats.count - stats.passed} /></CardContent></Card>
          </div>
          <Card className="mt-6 overflow-hidden py-0 shadow-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-5">Candidate</TableHead>
                  <TableHead className="text-right">Marks</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5 text-right"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.resultId}>
                    <TableCell className="pl-5">
                      <Link href={`/examiner/attempts/${r.attemptId}`} className="font-medium hover:underline">{r.name}</Link>
                      <span className="block text-xs text-muted-foreground">{r.email}</span>
                    </TableCell>
                    <TableCell className="tabular text-right">{r.score}/{r.maxScore}</TableCell>
                    <TableCell className="tabular text-right font-medium">{r.percentage.toFixed(1)}</TableCell>
                    <TableCell><StatusBadge value={r.passed ? "PASS" : "FAIL"} /></TableCell>
                    <TableCell>
                      {r.attemptStatus !== "GRADED" ? <span className="text-sm text-[oklch(0.5_0.13_65)]">Needs grading</span> : <StatusBadge value={r.status} />}
                      {r.publishedAt && <span className="block text-xs text-muted-foreground"><LocalTime value={r.publishedAt} mode="date" /></span>}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {r.status === "PUBLISHED" ? (
                        <Button variant="ghost" size="sm" asChild><a href={`/api/results/${r.resultId}/pdf`}><Download className="size-4" aria-hidden /> PDF</a></Button>
                      ) : (
                        <Button variant="ghost" size="sm" asChild><Link href={`/examiner/attempts/${r.attemptId}`}>Review</Link></Button>
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
