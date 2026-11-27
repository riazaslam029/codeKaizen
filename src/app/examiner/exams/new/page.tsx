import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/dal";
import { ExamForm } from "../exam-form";

export const metadata: Metadata = { title: "New examination" };

export default async function NewExamPage() {
  await requireRole("EXAMINER");
  return (
    <>
      <PageHeader title="New examination" description="Created as a draft. Add questions and candidates, preview it in the sandbox, then publish." />
      <ExamForm />
    </>
  );
}
