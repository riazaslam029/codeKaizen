import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { LocalTime } from "@/components/shared/local-time";
import { QuestionKeyView } from "@/components/shared/question-view";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { exams, results, users } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { isAnswered } from "@/lib/scoring";
import { AttemptService } from "@/services/attempts/attempt.service";
import { IncidentList } from "../../monitoring/[id]/incident-list";
import { GradeForm } from "./grade-form";

export const metadata: Metadata = { title: "Attempt" };

export default async function AttemptReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const examiner = await requireRole("EXAMINER");
  const { id } = await params;
  const { attempt, questions } = await AttemptService.detailForExaminer(examiner, id);
  const [[candidate], [exam], [result], incidents] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, attempt.candidateId)).limit(1),
    db.select({ title: exams.title, code: exams.code }).from(exams).where(eq(exams.id, attempt.examId)).limit(1),
    db.select().from(results).where(eq(results.attemptId, attempt.id)).limit(1),
    AttemptService.incidentsFor(examiner, { examId: attempt.examId, attemptId: attempt.id }),
  ]);
  const locked = result?.status === "PUBLISHED";
  const finished = attempt.status !== "IN_PROGRESS";
  const pending = questions.filter(({ q, answer }) => q.type === "ESSAY" && isAnswered(answer?.response) && answer?.marksAwarded == null).length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/examiner/monitoring/${attempt.examId}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {exam?.code} monitoring
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{exam?.code} · attempt {attempt.attemptNumber}</p>
          <h1 className="mt-1 text-2xl font-semibold">{candidate?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {candidate?.email} · started <LocalTime value={attempt.startedAt} /> · deadline <LocalTime value={attempt.expiresAt} />
            {attempt.submittedAt && <> · submitted <LocalTime value={attempt.submittedAt} mode="time" /></>}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge value={attempt.status} />
          {result && (
            <p className="tabular mt-2 text-2xl font-semibold">
              {result.score} / {result.maxScore} <span className="text-base font-normal text-muted-foreground">({result.percentage.toFixed(1)}%)</span>
            </p>
          )}
          {result && <StatusBadge value={result.status} className="mt-1" />}
        </div>
      </div>

      {finished && pending > 0 && !locked && (
        <p className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">{pending} written answer(s) need a mark before this result can be published.</p>
      )}
      {locked && <p className="mb-4 rounded-md border bg-muted p-3 text-sm">Results are published — grades are locked.</p>}

      <ol className="space-y-4">
        {questions.map(({ q, answer }) => {
          const resp = answer?.response;
          return (
            <li key={q.questionId}>
              <Card className="shadow-none">
                <CardContent className="space-y-4">
                  <QuestionKeyView index={q.position} q={q} selected={resp && "optionIds" in resp ? resp.optionIds : undefined} />
                  {resp && "text" in resp && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Candidate&apos;s answer</p>
                      <p className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-line">{resp.text || <em className="text-muted-foreground">Empty</em>}</p>
                    </div>
                  )}
                  {!isAnswered(resp) && <p className="text-sm text-muted-foreground">Not answered{answer?.isFlagged ? " · was marked for review" : ""}</p>}
                  {finished && (
                    <GradeForm
                      attemptId={attempt.id}
                      questionId={q.questionId}
                      max={q.marks}
                      min={q.type === "ESSAY" ? 0 : -q.negativeMarks}
                      current={answer?.marksAwarded ?? null}
                      feedback={answer?.feedback ?? ""}
                      manual={!!answer?.gradedById}
                      needsGrading={q.type === "ESSAY" && isAnswered(resp) && answer?.marksAwarded == null}
                      locked={locked}
                    />
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      <Card className="mt-6 shadow-none">
        <CardHeader><CardTitle className="text-base">Indicators for this attempt</CardTitle></CardHeader>
        <CardContent><IncidentList items={incidents.map((i) => ({ ...i, occurredAt: i.occurredAt.toISOString() }))} showCandidate={false} /></CardContent>
      </Card>
    </div>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
