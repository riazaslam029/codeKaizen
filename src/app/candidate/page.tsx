import { CalendarClock, ClipboardList, Timer, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { formatDateTime, formatDuration } from "@/lib/format";
import { ExamService } from "@/services/exams/exam.service";

export const metadata: Metadata = { title: "My exams" };

export default async function CandidateHomePage() {
  const candidate = await requireRole("CANDIDATE");
  const list = await ExamService.listForCandidate(candidate.id);

  return (
    <>
      <PageHeader
        title={`Hello, ${candidate.name.split(" ")[0]}`}
        description="Examinations you are enrolled in. Times are shown in UTC."
      />
      {list.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No examinations yet"
          description="When an examiner enrols you in an examination it will appear here."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <li key={e.enrollmentId}>
              <Card className="h-full gap-3 shadow-none transition-shadow duration-200 hover:shadow-sm">
                <CardHeader className="gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
                    <StatusBadge value={e.enrollmentStatus === "ENROLLED" ? e.status : e.enrollmentStatus} />
                  </div>
                  <h2 className="text-base font-semibold leading-snug">{e.title}</h2>
                  {e.description && <p className="line-clamp-2 text-sm text-muted-foreground">{e.description}</p>}
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">Starts</dt>
                      <dd className="tabular">{formatDateTime(e.startsAt)}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Timer className="size-4 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">Duration</dt>
                      <dd>{formatDuration(e.durationMinutes)}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserRound className="size-4 text-muted-foreground" aria-hidden />
                      <dt className="sr-only">Examiner</dt>
                      <dd>{e.examiner}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
