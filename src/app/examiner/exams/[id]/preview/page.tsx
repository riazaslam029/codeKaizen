import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QuestionKeyView } from "@/components/shared/question-view";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { formatDuration } from "@/lib/format";
import { ExamService } from "@/services/exams/exam.service";
import { SandboxButton } from "../sandbox-button";

export const metadata: Metadata = { title: "Paper preview" };

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const examiner = await requireRole("EXAMINER");
  const { id } = await params;
  const { exam, paper, totalMarks } = await ExamService.getForExaminer(examiner, id);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/examiner/exams/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Back to examination
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-5">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{exam.code} · examiner copy with answer key</p>
          <h1 className="mt-1 text-2xl font-semibold">{exam.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {paper.length} questions · {totalMarks} marks · {formatDuration(exam.durationMinutes)} · pass mark {exam.passPercentage}%
          </p>
        </div>
        <SandboxButton examId={id} disabled={paper.length === 0} />
      </div>
      {exam.instructions && (
        <Card className="mb-6 shadow-none">
          <CardContent className="text-sm whitespace-pre-line">{exam.instructions}</CardContent>
        </Card>
      )}
      <ol className="space-y-4">
        {paper.map((q, i) => (
          <li key={q.id}>
            <Card className="shadow-none">
              <CardContent>
                <QuestionKeyView index={i + 1} q={q} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      {paper.length === 0 && <p className="text-sm text-muted-foreground">The paper has no questions yet.</p>}
    </div>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
