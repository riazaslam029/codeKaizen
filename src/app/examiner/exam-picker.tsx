import { BookOpenCheck } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import type { ExamService } from "@/services/exams/exam.service";

type Exam = Awaited<ReturnType<typeof ExamService.listForExaminer>>[number];

/** List of the examiner's exams linking to a per-exam page (monitoring, results, analytics). */
export function ExamPicker({ exams, hrefBase, filter, emptyText }: { exams: Exam[]; hrefBase: string; filter?: (e: Exam) => boolean; emptyText: string }) {
  const list = filter ? exams.filter(filter) : exams;
  if (!list.length) return <EmptyState icon={BookOpenCheck} title="No examinations here yet" description={emptyText} />;
  return (
    <Card className="divide-y py-0 shadow-none">
      {list.map((e) => (
        <Link key={e.id} href={`${hrefBase}/${e.id}`} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/50">
          <span className="min-w-0">
            <span className="block truncate font-medium">{e.title}</span>
            <span className="block font-mono text-xs text-muted-foreground">{e.code} · <LocalTime value={e.startsAt} mode="date" /> · {e.candidateCount} enrolled</span>
          </span>
          <StatusBadge value={e.phase} />
        </Link>
      ))}
    </Card>
  );
}
