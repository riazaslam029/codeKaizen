import { Download, Hourglass, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { AttemptService } from "@/services/attempts/attempt.service";
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Results" };

export default async function CandidateResultsPage() {
  const candidate = await requireRole("CANDIDATE");
  await AttemptService.finalizeExpired({ candidateId: candidate.id });
  const [rows, awaiting] = await Promise.all([ResultsService.candidateResults(candidate.id), ResultsService.candidateAwaiting(candidate.id)]);
  return (
    <>
      <PageHeader title="Results" description="Your published results. Each has a downloadable PDF with a verification code anyone can check." />

      {awaiting.length > 0 && (
        <section aria-labelledby="awaiting" className="mb-6">
          <h2 id="awaiting" className="sr-only">
            Awaiting publication
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {awaiting.map((a) => (
              <li key={a.attemptId}>
                <Card className="gap-0 py-0 shadow-none">
                  <CardContent className="flex items-start gap-3 p-4">
                    <span className="rounded-full bg-accent p-2 text-accent-foreground">
                      <Hourglass className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{a.examTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        Results not published yet. Submitted {a.submittedAt ? <LocalTime value={a.submittedAt} /> : "—"}; your examiner will publish them after grading.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length === 0 ? (
        awaiting.length === 0 && (
          <EmptyState
            icon={Trophy}
            title="No results yet"
            description="Results appear here once you have sat an examination and your examiner has published the marks."
            action={
              <Button variant="outline" asChild>
                <Link href="/candidate/exams">My examinations</Link>
              </Button>
            }
          />
        )
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Examination</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="hidden sm:table-cell">Outcome</TableHead>
                <TableHead className="hidden md:table-cell">Published</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.resultId}>
                  <TableCell className="pl-5 whitespace-normal">
                    <Link href={`/candidate/results/${r.resultId}`} className="font-medium hover:underline">
                      {r.examTitle}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">{r.examCode}</span>
                  </TableCell>
                  <TableCell className="tabular text-right">
                    <span className="font-medium">{r.percentage.toFixed(1)}%</span>
                    <span className="block text-xs text-muted-foreground">
                      {r.score}/{r.maxScore}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge value={r.passed ? "PASS" : "FAIL"} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{r.publishedAt && <LocalTime value={r.publishedAt} mode="date" />}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/api/results/${r.resultId}/pdf`} aria-label={`Download PDF for ${r.examTitle}`}>
                        <Download className="size-4" aria-hidden /> PDF
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
