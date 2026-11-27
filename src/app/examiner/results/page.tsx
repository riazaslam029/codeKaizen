import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/dal";
import { ExamService } from "@/services/exams/exam.service";
import { ExamPicker } from "../exam-picker";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsIndex() {
  const examiner = await requireRole("EXAMINER");
  const exams = await ExamService.listForExaminer(examiner.id);
  return (
    <>
      <PageHeader title="Results" description="Review scores, finish grading and publish. Nothing is released to candidates until you publish." />
      <ExamPicker exams={exams} hrefBase="/examiner/results" filter={(e) => e.phase !== "DRAFT"} emptyText="Results appear once an examination has been published and attempted." />
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
