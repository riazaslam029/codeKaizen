import { PenLine, Send } from "lucide-react";
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
  // Exams with fully graded results that candidates cannot see yet.
  const ready = [...rest.filter((r) => r.resultStatus !== "PUBLISHED").reduce((m, r) => {
    const e = m.get(r.examId) ?? { examId: r.examId, code: r.examCode, title: r.examTitle, count: 0 };
    e.count += 1;
    return m.set(r.examId, e);
  }, new Map<string, { examId: string; code: string; title: string; count: number }>()).values()];
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
      {ready.length > 0 && (
        <section aria-labelledby="ready" className="mb-8">
          <h2 id="ready" className="mb-3 text-lg font-semibold">Ready to publish ({ready.length})</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {ready.map((e) => (
              <li key={e.examId}>
                <Card className="flex-row items-center justify-between gap-3 px-5 py-4 shadow-none">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{e.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      <span className="font-mono">{e.code}</span> · {e.count} graded result(s) not yet visible to candidates
                    </span>
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/examiner/results/${e.examId}`}>
                      <Send className="size-4" aria-hidden /> Publish
                    </Link>
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
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

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
