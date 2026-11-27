import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/dal";
import { EnrollmentService } from "@/services/exams/exam.service";
import { ResultsService } from "@/services/results/results.service";
import { CandidateDirectory } from "./candidate-directory";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage() {
  const examiner = await requireRole("EXAMINER");
  const [list, exams] = await Promise.all([EnrollmentService.listCandidates(), ResultsService.examsForSelect(examiner)]);
  return (
    <>
      <PageHeader title="Candidates" description="Candidate accounts available for enrolment. Create one, or bulk-import a CSV/JSON file (optionally enrolling everyone into an exam)." />
      <CandidateDirectory
        candidates={list.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
        exams={exams.filter((e) => e.status !== "ARCHIVED").map((e) => ({ id: e.id, label: `${e.code} — ${e.title}` }))}
      />
    </>
  );
}
