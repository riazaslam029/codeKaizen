import { z } from "zod";
import { authorize } from "@/lib/auth/dal";
import { route } from "@/lib/http";
import { renderResultPdf } from "@/services/reports/pdf";
import { ResultsService } from "@/services/results/results.service";

/** Downloadable PDF for a PUBLISHED result. Candidate (own), exam owner or admin only. */
export const GET = route(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await authorize();
  const id = z.uuid().parse((await ctx.params).id);
  const r = await ResultsService.forReport(actor, id);
  const origin = new URL(req.url).origin;
  const bytes = await renderResultPdf({
    verificationCode: r.verificationCode!,
    verifyUrl: `${origin}/verify/${r.verificationCode}`,
    candidateName: r.candidateName,
    candidateEmail: r.candidateEmail,
    examCode: r.examCode,
    examTitle: r.examTitle,
    score: r.score,
    maxScore: r.maxScore,
    percentage: r.percentage,
    passPercentage: r.passPercentage,
    passed: r.passed,
    submittedAt: r.submittedAt,
    publishedAt: r.publishedAt!,
  });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="result-${r.examCode}-${r.verificationCode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
