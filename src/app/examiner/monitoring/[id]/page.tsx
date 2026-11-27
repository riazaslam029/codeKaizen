import { ArrowLeft, Info, MonitorDot } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/shared/auto-refresh";
import { EmptyState } from "@/components/shared/empty-state";
import { LocalTime } from "@/components/shared/local-time";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { serverClock } from "@/lib/format";
import { AttemptService } from "@/services/attempts/attempt.service";
import { EnrollmentService, ExamService } from "@/services/exams/exam.service";
import { CheckCircle2, Clock, Radio, Users } from "lucide-react";
import { SplitIncidents } from "./incident-list";

export const metadata: Metadata = { title: "Live monitoring" };

export default async function MonitorExamPage({ params }: { params: Promise<{ id: string }> }) {
  const examiner = await requireRole("EXAMINER");
  const { id } = await params;
  const [{ exam }, rows, enrolled, incidents] = await Promise.all([
    ExamService.getForExaminer(examiner, id),
    AttemptService.monitor(examiner, id),
    EnrollmentService.listForExam(examiner, id),
    AttemptService.incidentsFor(examiner, { examId: id }),
  ]);
  const now = serverClock();
  const started = new Set(rows.map((r) => r.candidateId));
  const notStarted = enrolled.filter((e) => e.status === "ENROLLED" && !started.has(e.candidateId));
  const live = rows.filter((r) => r.status === "IN_PROGRESS");
  const names = new Map(rows.map((r) => [r.id, r.candidateName]));

  return (
    <>
      <Link href="/examiner/monitoring" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Monitoring
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><span className="font-mono text-sm text-muted-foreground">{exam.code}</span><StatusBadge value={exam.phase} /></div>
          <h1 className="mt-1 text-2xl font-semibold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">Window closes <LocalTime value={exam.endsAt} /></p>
        </div>
        <AutoRefresh seconds={15} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Enrolled" value={enrolled.filter((e) => e.status === "ENROLLED").length} hint="Active enrolments" icon={Users} />
        <StatCard label="In progress" value={live.length} hint="Answering right now" icon={Radio} tone="success" />
        <StatCard label="Submitted" value={rows.length - live.length} hint="Including auto-submitted" icon={CheckCircle2} tone="info" />
        <StatCard label="Not started" value={notStarted.length} hint="Enrolled, no attempt yet" icon={Clock} tone="neutral" />
      </div>

      <Card className="mt-6 overflow-hidden py-0 shadow-none">
        {rows.length === 0 ? (
          <div className="p-6"><EmptyState icon={MonitorDot} title="No attempts yet" description="Attempts appear here the moment a candidate starts." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Candidate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-40">Progress</TableHead>
                <TableHead className="hidden md:table-cell">Time left</TableHead>
                <TableHead className="hidden lg:table-cell">Last seen</TableHead>
                <TableHead className="pr-5 text-right">Indicators</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const pct = r.total ? Math.round((r.answered / r.total) * 100) : 0;
                const leftMin = Math.max(0, Math.round((new Date(r.expiresAt).getTime() - now) / 60000));
                const stale = r.status === "IN_PROGRESS" && r.lastSeenAt && now - new Date(r.lastSeenAt).getTime() > 60_000;
                return (
                  <TableRow key={r.id} className="relative">
                    <TableCell className="pl-5">
                      <Link href={`/examiner/attempts/${r.id}`} className="font-medium after:absolute after:inset-0 hover:underline">{r.candidateName}</Link>
                      <span className="block text-xs text-muted-foreground">{r.candidateEmail}</span>
                    </TableCell>
                    <TableCell><StatusBadge value={r.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 w-24" aria-label={`${pct}% answered`} />
                        <span className="tabular text-xs text-muted-foreground">{r.answered}/{r.total}{r.flagged ? ` · ⚑${r.flagged}` : ""}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular hidden text-sm md:table-cell">{r.status === "IN_PROGRESS" ? `${leftMin} min` : r.submittedAt ? <LocalTime value={r.submittedAt} mode="time" /> : "—"}</TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {r.lastSeenAt ? <span className={stale ? "text-warning-text" : "text-muted-foreground"}><LocalTime value={r.lastSeenAt} mode="time" />{stale && " · no contact >1 min"}</span> : "—"}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      {r.incidentCount === 0 ? <span className="text-xs text-muted-foreground">None</span> : (
                        <span className="text-sm">{r.incidentCount}{r.attentionCount > 0 && <StatusBadge value="MEDIUM" className="ml-2" />}</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {notStarted.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Not started: {notStarted.map((n) => n.name).join(", ")}</p>
      )}

      <Card className="mt-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Event history</CardTitle>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Everything the server recorded during this examination, split into failure-resilience events and integrity indicators.
          </p>
        </CardHeader>
        <CardContent>
          <SplitIncidents items={incidents.map((i) => ({ ...i, occurredAt: i.occurredAt.toISOString(), candidate: names.get(i.attemptId) ?? "Candidate" }))} />
        </CardContent>
      </Card>
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
