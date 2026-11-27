import { ArrowLeft, CheckCircle2, CircleDashed, CircleMinus, Clock, Download, MinusCircle, ShieldCheck, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreGauge, TopicChart } from "@/components/charts/charts";
import { LocalTime } from "@/components/shared/local-time";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";
import { cn } from "@/lib/utils";
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Result" };

const OUTCOME = {
  correct: { icon: CheckCircle2, label: "Correct", cls: "text-success" },
  partial: { icon: CircleMinus, label: "Partly correct", cls: "text-[oklch(0.5_0.13_65)]" },
  incorrect: { icon: XCircle, label: "Incorrect", cls: "text-destructive" },
  skipped: { icon: CircleDashed, label: "Skipped", cls: "text-muted-foreground" },
} as const;

function duration(s: number | null) {
  if (s === null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${s % 60} s`;
}

export default async function CandidateResultPage({ params }: { params: Promise<{ id: string }> }) {
  const candidate = await requireRole("CANDIDATE");
  const { id } = await params;
  const r = (await ResultsService.candidateResults(candidate.id)).find((x) => x.resultId === id);
  if (!r) notFound();
  let detail: Awaited<ReturnType<typeof ResultsService.candidateBreakdown>>;
  try {
    detail = await ResultsService.candidateBreakdown(candidate, id);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  const counts = { correct: 0, partial: 0, incorrect: 0, skipped: 0 };
  for (const i of detail.items) counts[i.outcome]++;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/candidate/results" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All results
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{r.examCode}</p>
          <h1 className="mt-1 text-2xl font-semibold">{r.examTitle}</h1>
        </div>
        <Button asChild>
          <a href={`/api/results/${r.resultId}/pdf`}>
            <Download className="size-4" aria-hidden /> Download PDF report
          </a>
        </Button>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr]">
        <Card className="items-center shadow-none">
          <CardContent className="relative text-center">
            <ScoreGauge percentage={r.percentage} passed={r.passed} />
            <div className="pointer-events-none absolute inset-x-0 top-[3.9rem] text-center">
              <p className="tabular text-3xl font-semibold">{r.percentage.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {r.score} / {r.maxScore} marks
              </p>
            </div>
            <StatusBadge value={r.passed ? "PASS" : "FAIL"} className="mt-2 text-sm" />
            <p className="mt-1 text-xs text-muted-foreground">Pass mark {r.passPercentage}%</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(Object.keys(OUTCOME) as (keyof typeof OUTCOME)[]).map((k) => {
                const O = OUTCOME[k];
                return (
                  <div key={k} className="rounded-md bg-muted/60 p-3">
                    <dt className={cn("flex items-center gap-1.5 text-xs font-medium", O.cls)}>
                      <O.icon className="size-3.5" aria-hidden /> {O.label}
                    </dt>
                    <dd className="tabular mt-1 text-xl font-semibold">{counts[k]}</dd>
                  </div>
                );
              })}
            </dl>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden /> Time spent: <span className="text-foreground">{duration(detail.timeSpentSeconds)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-4" aria-hidden /> Verification <span className="font-mono text-foreground">{r.verificationCode}</span>
              </span>
              {r.publishedAt && (
                <span>
                  Published <LocalTime value={r.publishedAt} />
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Performance by topic</CardTitle>
        </CardHeader>
        <CardContent>
          <TopicChart data={detail.topics.map((t) => ({ topic: t.topic, percentage: t.percentage }))} />
          <table className="sr-only">
            <caption>Score by topic</caption>
            <tbody>
              {detail.topics.map((t) => (
                <tr key={t.topic}>
                  <th>{t.topic}</th>
                  <td>
                    {t.awarded} of {t.marks} marks ({t.percentage}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Question by question</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="divide-y">
            {detail.items.map((b) => {
              const O = OUTCOME[b.outcome];
              return (
                <li key={b.position} className="flex items-start gap-3 py-3">
                  <O.icon className={cn("mt-0.5 size-5 shrink-0", O.cls)} aria-label={O.label} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">Q{b.position}.</span> <span className="line-clamp-2">{b.prompt}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {b.topic} · {O.label}
                    </p>
                    {b.feedback && <p className="mt-1 rounded bg-muted px-2 py-1 text-xs">Examiner feedback: {b.feedback}</p>}
                  </div>
                  <span className="tabular shrink-0 text-sm font-medium">
                    {b.awarded} / {b.marks}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MinusCircle className="size-3.5" aria-hidden /> Answer keys are not shown, so the paper can be reused fairly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
