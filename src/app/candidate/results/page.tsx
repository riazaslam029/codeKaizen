import { Download, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Results" };

export default async function CandidateResultsPage() {
  const candidate = await requireRole("CANDIDATE");
  const rows = await ResultsService.candidateResults(candidate.id);
  return (
    <>
      <PageHeader title="Results" description="Your published results. Each has a downloadable PDF with a verification code anyone can check." />
      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="No published results yet" description="Results appear here once your examiner has graded and published them." />
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Examination</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="hidden md:table-cell">Published</TableHead>
                <TableHead className="pr-5 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.resultId}>
                  <TableCell className="pl-5">
                    <Link href={`/candidate/results/${r.resultId}`} className="font-medium hover:underline">{r.examTitle}</Link>
                    <span className="block font-mono text-xs text-muted-foreground">{r.examCode}</span>
                  </TableCell>
                  <TableCell className="tabular text-right">
                    <span className="font-medium">{r.percentage.toFixed(1)}%</span>
                    <span className="block text-xs text-muted-foreground">{r.score}/{r.maxScore}</span>
                  </TableCell>
                  <TableCell><StatusBadge value={r.passed ? "PASS" : "FAIL"} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{r.publishedAt && <LocalTime value={r.publishedAt} mode="date" />}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/api/results/${r.resultId}/pdf`}><Download className="size-4" aria-hidden /> PDF</a>
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
