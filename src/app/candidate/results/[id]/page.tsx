import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/shared/local-time";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireRole } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Result" };

export default async function CandidateResultPage({ params }: { params: Promise<{ id: string }> }) {
  const candidate = await requireRole("CANDIDATE");
  const { id } = await params;
  const all = await ResultsService.candidateResults(candidate.id);
  const r = all.find((x) => x.resultId === id);
  if (!r) notFound();
  let breakdown: Awaited<ReturnType<typeof ResultsService.candidateBreakdown>> = [];
  try {
    breakdown = await ResultsService.candidateBreakdown(candidate, id);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/candidate/results" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All results
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{r.examCode}</p>
          <h1 className="mt-1 text-2xl font-semibold">{r.examTitle}</h1>
        </div>
        <Button asChild><a href={`/api/results/${r.resultId}/pdf`}><Download className="size-4" aria-hidden /> Download PDF report</a></Button>
      </div>
      <Card className="mt-6 shadow-none">
        <CardContent className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <p className="tabular text-4xl font-semibold">{r.percentage.toFixed(2)}%</p>
            <p className="text-sm text-muted-foreground">{r.score} of {r.maxScore} marks · pass mark {r.passPercentage}%</p>
          </div>
          <div className="space-y-2">
            <StatusBadge value={r.passed ? "PASS" : "FAIL"} className="text-sm" />
            <Progress value={r.percentage} aria-label="Score percentage" />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden /> Verification code <span className="font-mono text-foreground">{r.verificationCode}</span> · published {r.publishedAt && <LocalTime value={r.publishedAt} />}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card className="mt-6 shadow-none">
        <CardHeader><CardTitle className="text-base">Marks by question</CardTitle></CardHeader>
        <CardContent>
          <ol className="divide-y">
            {breakdown.map((b) => (
              <li key={b.position} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm"><span className="font-medium">Q{b.position}.</span> <span className="line-clamp-2">{b.prompt}</span></p>
                  {!b.answered && <p className="text-xs text-muted-foreground">Not answered</p>}
                  {b.feedback && <p className="mt-1 rounded bg-muted px-2 py-1 text-xs">Examiner feedback: {b.feedback}</p>}
                </div>
                <span className="tabular shrink-0 text-sm font-medium">{b.awarded} / {b.marks}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
