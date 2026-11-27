import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth/dal";
import { AttemptService } from "@/services/attempts/attempt.service";
import { ExamService } from "@/services/exams/exam.service";
import { ExamCard, type CandidateExam } from "../exam-card";

export const metadata: Metadata = { title: "My examinations" };

function Grid({ items, empty }: { items: CandidateExam[]; empty: string }) {
  if (!items.length) return <EmptyState icon={ClipboardList} title="Nothing here" description={empty} />;
  return <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((e) => <li key={e.id}><ExamCard e={e} /></li>)}</ul>;
}

export default async function CandidateExamsPage() {
  const candidate = await requireRole("CANDIDATE");
  await AttemptService.finalizeExpired({ candidateId: candidate.id });
  const list = await ExamService.listForCandidate(candidate.id);
  const available = list.filter((e) => e.canStart);
  const upcoming = list.filter((e) => e.phase === "SCHEDULED" && e.enrollmentStatus === "ENROLLED");
  const completed = list.filter((e) => (e.latestAttempt && !e.openAttemptId) || e.phase === "COMPLETED");
  return (
    <>
      <PageHeader title="My examinations" description="Only examinations you are enrolled in are listed. Entry is checked by the server at start time." />
      <Tabs defaultValue={available.length ? "available" : "upcoming"}>
        <TabsList>
          <TabsTrigger value="available">Available ({available.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="available" className="mt-4"><Grid items={available} empty="No examination is open for you right now." /></TabsContent>
        <TabsContent value="upcoming" className="mt-4"><Grid items={upcoming} empty="No upcoming examinations." /></TabsContent>
        <TabsContent value="completed" className="mt-4"><Grid items={completed} empty="You have not completed any examinations yet." /></TabsContent>
      </Tabs>
    </>
  );
}
