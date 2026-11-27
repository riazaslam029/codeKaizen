import { ArrowLeft, BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QuestionRatesChart } from "@/components/charts/charts";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { cn } from "@/lib/utils";
import { QUESTION_TYPE_LABEL } from "@/lib/validations/question";
import { ExamService } from "@/services/exams/exam.service";
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Question analytics" };

export default async function ExamAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const examiner = await requireRole("EXAMINER");
  const { id } = await params;
  const [{ exam, paper }, data] = await Promise.all([ExamService.getForExaminer(examiner, id), ResultsService.questionAnalytics(examiner, id)]);
  const order = new Map(paper.map((p, i) => [p.id, i + 1]));
  const questions = [...data.questions].sort((a, b) => (order.get(a.questionId) ?? 99) - (order.get(b.questionId) ?? 99));
  const label = (qid: string) => `Q${order.get(qid) ?? "?"}`;
  const mostSkipped = [...questions].sort((a, b) => b.skipRate - a.skipRate).filter((q) => q.skipped > 0).slice(0, 3);
  const hardest = [...questions].filter((q) => q.attempts >= 1).sort((a, b) => a.correctRate - b.correctRate).slice(0, 3);

  return (
    <>
      <Link href="/examiner/analytics" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Analytics
      </Link>
      <div className="mb-6">
        <p className="font-mono text-sm text-muted-foreground">{exam.code}</p>
        <h1 className="mt-1 text-2xl font-semibold">{exam.title}</h1>
        <p className="text-sm text-muted-foreground">Based on {data.attempts} submitted attempt(s). Difficulty labels need at least 3 attempts.</p>
      </div>
      {data.attempts === 0 ? (
        <EmptyState icon={BarChart3} title="No responses yet" description="Statistics are computed only from real submitted attempts — nothing is estimated." />
      ) : (
        <>
          <Card className="shadow-none">
            <CardHeader><CardTitle className="text-base">Correct and skipped rate by question</CardTitle></CardHeader>
            <CardContent>
              <QuestionRatesChart data={questions.map((q) => ({ label: label(q.questionId), correct: q.correctRate, skipped: q.skipRate }))} />
            </CardContent>
          </Card>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader><CardTitle className="text-base">Most frequently skipped</CardTitle></CardHeader>
              <CardContent>
                {mostSkipped.length === 0 ? <p className="text-sm text-muted-foreground">Every question was answered by everyone.</p> : (
                  <ul className="space-y-2 text-sm">{mostSkipped.map((q) => <li key={q.questionId} className="flex justify-between gap-3"><span className="line-clamp-1"><strong>{label(q.questionId)}</strong> {q.prompt}</span><span className="tabular shrink-0">{q.skipRate}%</span></li>)}</ul>
                )}
              </CardContent>
            </Card>
            <Card className="shadow-none">
              <CardHeader><CardTitle className="text-base">Lowest correct-response rate</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">{hardest.map((q) => <li key={q.questionId} className="flex justify-between gap-3"><span className="line-clamp-1"><strong>{label(q.questionId)}</strong> {q.prompt}</span><span className="tabular shrink-0">{q.correctRate}%</span></li>)}</ul>
              </CardContent>
            </Card>
          </div>

          <h2 className="mt-8 mb-3 text-lg font-semibold">Per question</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {questions.map((q) => {
              const maxCount = Math.max(1, ...q.distribution.map((d) => d.count));
              return (
                <Card key={q.questionId} className="shadow-none">
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm"><strong>{label(q.questionId)}.</strong> <span className="line-clamp-2">{q.prompt}</span></p>
                      <span className={cn("shrink-0 rounded px-2 py-0.5 text-xs font-medium", q.difficulty === "Hard" ? "bg-destructive/10 text-destructive" : q.difficulty === "Easy" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>{q.difficulty}</span>
                    </div>
                    <dl className="grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        ["Correct", `${q.correctRate}%`],
                        ["Avg marks", `${q.averageMarksPct}%`],
                        ["Skipped", `${q.skipped}`],
                        ["Responses", `${q.answered}/${q.attempts}`],
                      ].map(([k, v]) => <div key={k} className="rounded-md bg-muted/60 p-2"><dt className="text-muted-foreground">{k}</dt><dd className="tabular mt-0.5 text-sm font-semibold">{v}</dd></div>)}
                    </dl>
                    {q.distribution.length > 0 ? (
                      <ul className="space-y-1.5" aria-label="Response distribution">
                        {q.distribution.map((d) => (
                          <li key={d.id} className="text-xs">
                            <div className="flex justify-between gap-2"><span className={cn("line-clamp-1", d.correct && "font-medium text-success")}>{d.id.toUpperCase()}. {d.text}{d.correct && " ✓"}</span><span className="tabular">{d.count}</span></div>
                            <div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className={cn("h-full rounded-full", d.correct ? "bg-success" : "bg-chart-3")} style={{ width: `${(d.count / maxCount) * 100}%` }} /></div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-muted-foreground">{QUESTION_TYPE_LABEL[q.type]} — no option distribution.</p>}
                    {q.commonWrong && <p className="text-xs text-muted-foreground">Most common incorrect choice: <span className="font-medium text-foreground">{q.commonWrong.text}</span> ({q.commonWrong.count})</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
