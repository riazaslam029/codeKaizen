import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/dal";
import { QuestionService } from "@/services/questions/question.service";
import { QuestionBank } from "./question-bank";

export const metadata: Metadata = { title: "Question bank" };

export default async function QuestionsPage() {
  const examiner = await requireRole("EXAMINER");
  const [rows, subjects] = await Promise.all([QuestionService.list(), QuestionService.subjects()]);
  return (
    <>
      <PageHeader
        title="Question bank"
        description={`${rows.length} reusable questions shared by all examiners. Single answer, multiple select (all-or-nothing or partial credit), true/false, short answer and written response.`}
      />
      <QuestionBank rows={rows} subjects={subjects} currentUserId={examiner.id} />
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
