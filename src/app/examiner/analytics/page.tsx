import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/dal";
import { ExamService } from "@/services/exams/exam.service";
import { ExamPicker } from "../exam-picker";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsIndex() {
  const examiner = await requireRole("EXAMINER");
  const exams = await ExamService.listForExaminer(examiner.id);
  return (
    <>
      <PageHeader title="Question analytics" description="Per-question statistics computed from real, submitted responses (sandbox previews excluded)." />
      <ExamPicker exams={exams} hrefBase="/examiner/analytics" filter={(e) => e.phase !== "DRAFT"} emptyText="Analytics appear after candidates submit attempts." />
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
