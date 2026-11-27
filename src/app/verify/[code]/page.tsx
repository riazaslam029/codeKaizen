import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Brand } from "@/components/layout/brand";
import { Card, CardContent } from "@/components/ui/card";
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Verification result", robots: { index: false } };

export default function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md">
        <Brand className="mb-8" />
        <Suspense fallback={<p className="text-sm text-muted-foreground">Checking…</p>}>
          <Outcome params={params} />
        </Suspense>
        <Link href="/verify" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">Verify another code</Link>
      </div>
    </main>
  );
}

async function Outcome({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const code = decodeURIComponent((await params).code);
  const r = await ResultsService.verify(code);
  if (!r) {
    return (
      <Card className="border-destructive/40 shadow-none">
        <CardContent className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-6 shrink-0 text-destructive" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">Not verified</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              No published report matches <span className="font-mono">{code.slice(0, 24)}</span>. Check the code for typos, or contact the issuing institution.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(r.publishedAt);
  return (
    <Card className="border-success/40 shadow-none">
      <CardContent>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">Genuine report</h1>
            <p className="mt-1 text-sm text-muted-foreground">This code matches a result published on CodeKaizen Exams.</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Code</dt><dd className="font-mono">{r.code}</dd>
          <dt className="text-muted-foreground">Candidate</dt><dd>{r.candidate}</dd>
          <dt className="text-muted-foreground">Examination</dt><dd>{r.examTitle} ({r.examCode})</dd>
          <dt className="text-muted-foreground">Outcome</dt><dd>{r.outcome} · {r.percentage.toFixed(2)}%</dd>
          <dt className="text-muted-foreground">Published</dt><dd>{date}</dd>
        </dl>
        <p className="mt-5 text-xs text-muted-foreground">Only the minimum details needed to confirm authenticity are shown. Contact details, answers and identifiers are never disclosed.</p>
      </CardContent>
    </Card>
  );
}
