import { PenLine } from "lucide-react";
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

export const metadata: Metadata = { title: "Grading" };

export default async function GradingPage() {
  const examiner = await requireRole("EXAMINER");
  const queue = await ResultsService.gradingQueue(examiner);
  const needs = queue.filter((q) => q.pending > 0);
  const rest = queue.filter((q) => q.pending === 0);
  const table = (rows: typeof queue) => (
    <Card className="overflow-hidden py-0 shadow-none">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="pl-5">Candidate</TableHead>
            <TableHead>Examination</TableHead>
            <TableHead className="hidden md:table-cell">Submitted</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="pr-5 text-right"><span className="sr-only">Action</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.attemptId}>
              <TableCell className="pl-5 font-medium">{r.candidate}</TableCell>
              <TableCell><span className="font-mono text-xs">{r.examCode}</span></TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{r.submittedAt && <LocalTime value={r.submittedAt} />}</TableCell>
              <TableCell>{r.pending > 0 ? <span className="text-sm">{r.pending} written to mark</span> : <StatusBadge value={r.resultStatus ?? r.status} />}</TableCell>
              <TableCell className="pr-5 text-right">
                <Button size="sm" variant={r.pending ? "default" : "outline"} asChild><Link href={`/examiner/attempts/${r.attemptId}`}>{r.pending ? "Grade" : "Review"}</Link></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
  return (
    <>
      <PageHeader title="Grading" description="Choice and short-answer questions are marked automatically from each attempt's frozen marking scheme. Written responses need your mark; you may also correct any mark before publication." />
      <h2 className="mb-3 text-lg font-semibold">Needs grading ({needs.length})</h2>
      {needs.length === 0 ? <EmptyState icon={PenLine} title="All caught up" description="No written answers are waiting for a mark." /> : table(needs)}
      {rest.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold">Graded ({rest.length})</h2>
          {table(rest)}
        </>
      )}
    </>
  );
}
