import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { route } from "@/lib/http";
import { ExamService } from "@/services/exams/exam.service";
import { renderExamReportPdf } from "@/services/reports/pdf";
import { ResultsService } from "@/services/results/results.service";

const STATUS: Record<string, string> = { NEEDS_GRADING: "Needs grading", AUTO_GRADED: "Auto-graded", GRADED_MANUAL: "Graded" };

/** Examination-level PDF: exam owner or admin only (candidates get 403, other examiners 404). */
export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await authorize("EXAMINER", "ADMIN");
  const id = z.uuid().parse((await ctx.params).id);
  const { exam, paper, totalMarks } = await ExamService.getForExaminer(actor, id);
  const [summary, qa] = await Promise.all([ResultsService.examSummary(actor, id), ResultsService.questionAnalytics(actor, id)]);
  const order = new Map(paper.map((p, i) => [p.id, i + 1]));
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(d);
  const bytes = await renderExamReportPdf({
    examCode: exam.code,
    examTitle: exam.title,
    window: `${fmt(exam.startsAt)} - ${fmt(exam.endsAt)} UTC`,
    totalMarks,
    passPercentage: exam.passPercentage,
    generatedBy: actor.name,
    stats: summary.stats,
    distribution: summary.distribution,
    rows: summary.rows.map((r) => ({
      name: r.name,
      score: r.score,
      maxScore: r.maxScore,
      percentage: r.percentage,
      passed: r.passed,
      status: `${STATUS[r.gradingStatus]}${r.status === "PUBLISHED" ? ", published" : r.status === "WITHHELD" ? ", withdrawn" : ""}`,
    })),
    questions: [...qa.questions]
      .sort((a, b) => (order.get(a.questionId) ?? 99) - (order.get(b.questionId) ?? 99))
      .map((q) => ({ label: `Q${order.get(q.questionId) ?? "?"}`, prompt: q.prompt, correctRate: q.correctRate, skipRate: q.skipRate, difficulty: q.difficulty })),
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="exam-report-${exam.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
