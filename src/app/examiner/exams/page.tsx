import { BookOpenCheck, Plus } from "lucide-react";
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
import { formatDuration } from "@/lib/format";
import { ExamService } from "@/services/exams/exam.service";

export const metadata: Metadata = { title: "Examinations" };

export default async function ExamsPage() {
  const examiner = await requireRole("EXAMINER");
  const list = await ExamService.listForExaminer(examiner.id);
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
                <TableHead>Phase</TableHead>
                <TableHead className="hidden md:table-cell">Window</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="pr-5 text-right">Candidates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((e) => (
                <TableRow key={e.id} className="relative">
                  <TableCell className="pl-5">
                    <Link href={`/examiner/exams/${e.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                      {e.title}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {e.code} · {formatDuration(e.durationMinutes)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={e.phase} />
                  </TableCell>
                  <TableCell className="tabular hidden text-sm text-muted-foreground md:table-cell">
                    <LocalTime value={e.startsAt} /> → <LocalTime value={e.endsAt} mode="time" />
                  </TableCell>
                  <TableCell className="tabular text-right">{e.questionCount}</TableCell>
                  <TableCell className="tabular pr-5 text-right">{e.candidateCount}</TableCell>
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
