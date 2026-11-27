import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
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
        <Link href="/verify" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Verify another code
        </Link>
      </div>
    </main>
  );
}

async function Outcome({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const code = decodeURIComponent((await params).code).slice(0, 40);
  const r = await ResultsService.verify(code);
  const date = r ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(r.issuedAt) : "";

  const view =
    !r
      ? { icon: ShieldX, tone: "border-destructive/40", iconCls: "text-destructive", title: "Invalid", text: `No report was issued with the code ${code}. Check it for typos.` }
      : r.status === "revoked"
        ? { icon: ShieldAlert, tone: "border-warning/60", iconCls: "text-[oklch(0.5_0.13_65)]", title: "Revoked", text: "This report was issued but has since been withdrawn by the examiner. It is no longer valid." }
        : { icon: ShieldCheck, tone: "border-success/40", iconCls: "text-success", title: "Valid", text: "This code matches a result report issued by CodeKaizen Exams." };

  return (
    <Card className={`shadow-none ${view.tone}`}>
      <CardContent>
        <div className="flex items-start gap-3">
          <view.icon className={`mt-0.5 size-7 shrink-0 ${view.iconCls}`} aria-hidden />
          <div>
            <h1 className="text-lg font-semibold">{view.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{view.text}</p>
          </div>
        </div>
        {r && (
          <dl className="mt-5 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Code</dt>
            <dd className="font-mono">{r.code}</dd>
            <dt className="text-muted-foreground">Examination</dt>
            <dd>{r.examTitle}</dd>
            <dt className="text-muted-foreground">Issued</dt>
            <dd>{date}</dd>
          </dl>
        )}
        <p className="mt-5 text-xs text-muted-foreground">
          For privacy, verification never shows the candidate&apos;s name, score, contact details or answers. Compare the code and issue date with the printed report.
        </p>
      </CardContent>
    </Card>
  );
}
