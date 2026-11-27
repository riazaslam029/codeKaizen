import { BookOpenCheck } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { formatDateTime, formatDuration } from "@/lib/format";
import { ExamService } from "@/services/exams/exam.service";

export const metadata: Metadata = { title: "My exams" };

export default async function ExaminerHomePage() {
  const examiner = await requireRole("EXAMINER");
  const list = await ExamService.listForExaminer(examiner.id);

  return (
    <>
      <PageHeader title="My examinations" description="Examinations you author and supervise." />
      {list.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="No examinations yet" description="Examinations you create will appear here." />
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Examination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Starts</TableHead>
                <TableHead className="text-right">Questions</TableHead>
                <TableHead className="pr-5 text-right">Candidates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="pl-5">
                    <span className="block font-medium">{e.title}</span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {e.code} · {formatDuration(e.durationMinutes)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={e.status} />
                  </TableCell>
                  <TableCell className="tabular hidden text-sm text-muted-foreground md:table-cell">
                    {formatDateTime(e.startsAt)}
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
