import { BookOpenCheck, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { TimeRange } from "@/components/shared/time-range";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { formatDuration } from "@/lib/format";
import { ExamService } from "@/services/exams/exam.service";

export const metadata: Metadata = { title: "Examinations" };

export default async function ExamsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const examiner = await requireRole("EXAMINER");
  const showArchived = (await searchParams).archived === "1";
  const all = await ExamService.listForExaminer(examiner.id);
  const archivedCount = all.filter((e) => e.phase === "ARCHIVED").length;
  const list = showArchived ? all : all.filter((e) => e.phase !== "ARCHIVED");
  const newButton = (
    <Button asChild>
      <Link href="/examiner/exams/new">
        <Plus className="size-4" aria-hidden /> New examination
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader title="Examinations" description="Draft → published → ongoing → completed. The phase follows the schedule automatically." actions={list.length ? newButton : undefined} />
      {list.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="No examinations yet" description="Create your first examination, then add questions from the bank." action={newButton} />
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Examination</TableHead>
                <TableHead className="hidden sm:table-cell">Phase</TableHead>
                <TableHead className="hidden lg:table-cell">Window</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Questions</TableHead>
                <TableHead className="hidden pr-5 text-right sm:table-cell">Candidates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((e) => (
                <TableRow key={e.id} className="relative">
                  <TableCell className="pl-5 whitespace-normal">
                    <Link href={`/examiner/exams/${e.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                      {e.title}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {e.code} · {formatDuration(e.durationMinutes)}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:hidden">
                      <StatusBadge value={e.phase} /> {e.questionCount} questions · {e.candidateCount} candidates
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge value={e.phase} />
                  </TableCell>
                  <TableCell className="tabular hidden text-sm whitespace-normal text-muted-foreground lg:table-cell">
                    <TimeRange start={e.startsAt} end={e.endsAt} />
                  </TableCell>
                  <TableCell className="tabular hidden text-right sm:table-cell">{e.questionCount}</TableCell>
                  <TableCell className="tabular hidden pr-5 text-right sm:table-cell">{e.candidateCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {archivedCount > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href={showArchived ? "/examiner/exams" : "/examiner/exams?archived=1"} className="font-medium text-primary hover:underline">
            {showArchived ? "Hide archived examinations" : `Show ${archivedCount} archived examination(s)`}
          </Link>
        </p>
      )}
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
