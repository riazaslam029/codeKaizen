import { Download, ExternalLink, FileText } from "lucide-react";
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
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const examiner = await requireRole("EXAMINER");
  const rows = await ResultsService.publishedForExaminer(examiner);
  return (
    <>
      <PageHeader title="Reports" description="Every published result has a PDF report and a unique verification code that can be checked publicly at /verify." />
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No published reports yet" description="Publish results from an examination's Results page to generate reports." />
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Candidate</TableHead>
                <TableHead>Examination</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="hidden md:table-cell">Verification code</TableHead>
                <TableHead className="pr-5 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.resultId}>
                  <TableCell className="pl-5 font-medium">{r.candidate}<span className="block text-xs font-normal text-muted-foreground">{r.publishedAt && <LocalTime value={r.publishedAt} mode="date" />}</span></TableCell>
                  <TableCell><span className="font-mono text-xs">{r.examCode}</span></TableCell>
                  <TableCell className="tabular text-right">{r.percentage.toFixed(1)} <StatusBadge value={r.passed ? "PASS" : "FAIL"} className="ml-1" /></TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">
                    <Link href={`/verify/${r.verificationCode}`} target="_blank" className="inline-flex items-center gap-1 hover:underline">{r.verificationCode}<ExternalLink className="size-3" aria-hidden /></Link>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button variant="ghost" size="sm" asChild><a href={`/api/results/${r.resultId}/pdf`}><Download className="size-4" aria-hidden /> PDF</a></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
