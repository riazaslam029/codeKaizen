import { Activity } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { ResultsService } from "@/services/results/results.service";

export const metadata: Metadata = { title: "Platform activity" };

export default async function ActivityPage() {
  await requireRole("ADMIN");
  const { feed } = await ResultsService.platformActivity();
  return (
    <>
      <PageHeader title="Platform activity" description="Audit trail of sign-ins, account changes, exam lifecycle, imports, grading and publication (latest 100)." />
      {feed.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Actions taken on the platform will be listed here." />
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="hidden pr-5 md:table-cell">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feed.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular pl-5 text-sm whitespace-nowrap text-muted-foreground">
                    <LocalTime value={e.createdAt} />
                  </TableCell>
                  <TableCell className="whitespace-normal">{e.summary}</TableCell>
                  <TableCell className="hidden pr-5 font-mono text-xs text-muted-foreground md:table-cell">{e.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
