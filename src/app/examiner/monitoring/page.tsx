import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/dal";
import { ExamService } from "@/services/exams/exam.service";
import { ExamPicker } from "../exam-picker";

export const metadata: Metadata = { title: "Monitoring" };

export default async function MonitoringIndex() {
  const examiner = await requireRole("EXAMINER");
  const exams = await ExamService.listForExaminer(examiner.id);
  const order = { ONGOING: 0, SCHEDULED: 1, COMPLETED: 2, DRAFT: 3, ARCHIVED: 4 } as const;
  return (
    <>
      <PageHeader title="Monitoring" description="Live attempt status, progress and connectivity indicators per examination. Ongoing examinations are listed first." />
      <ExamPicker
        exams={[...exams].sort((a, b) => order[a.phase] - order[b.phase])}
        hrefBase="/examiner/monitoring"
        filter={(e) => e.phase !== "DRAFT"}
        emptyText="Publish an examination to monitor it."
      />
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
