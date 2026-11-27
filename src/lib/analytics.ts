import type { AnswerResponse, AttemptQuestionSnapshot } from "@/db/schema/types";
import { isAnswered, round2 } from "./scoring";

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Result-level statistics, computed only from the rows passed in (never estimated). */
export function summarizeResults(rows: { percentage: number; passed: boolean; status: string; attemptStatus: string }[]) {
  const pcts = rows.map((r) => r.percentage);
  const n = rows.length;
  return {
    stats: {
      count: n,
      average: n ? round2(pcts.reduce((a, b) => a + b, 0) / n) : 0,
      median: round2(median(pcts)),
      highest: n ? Math.max(...pcts) : 0,
      lowest: n ? Math.min(...pcts) : 0,
      passRate: n ? round2((rows.filter((r) => r.passed).length / n) * 100) : 0,
      passed: rows.filter((r) => r.passed).length,
      published: rows.filter((r) => r.status === "PUBLISHED").length,
      awaitingGrading: rows.filter((r) => r.attemptStatus !== "GRADED").length,
    },
    // 10-point buckets; 100% falls in the last bucket.
    distribution: Array.from({ length: 10 }, (_, i) => ({
      range: i === 9 ? "90–100" : `${i * 10}–${i * 10 + 9}`,
      count: pcts.filter((p) => Math.min(9, Math.floor(p / 10)) === i).length,
    })),
  };
}

export type AnalyticsAnswer = { attemptId: string; questionId: string; response: AnswerResponse | null; marks: number | null };

/**
 * Per-question statistics from real finalised attempts.
 * - skipped: no non-empty answer saved
 * - correctRate (facility): share of attempts that earned the question's full marks
 * - difficulty: needs ≥3 attempts; Easy ≥70%, Moderate ≥30%, else Hard
 */
export function computeQuestionAnalytics(tries: { id: string; snapshot: AttemptQuestionSnapshot[] }[], ans: AnalyticsAnswer[]) {
  const key = (a: string, q: string) => `${a}:${q}`;
  const ansMap = new Map(ans.map((a) => [key(a.attemptId, a.questionId), a]));

  type Acc = {
    q: AttemptQuestionSnapshot;
    seen: number;
    answered: number;
    fullMarks: number;
    marksSum: number;
    optionCounts: Map<string, number>;
    wrongCounts: Map<string, number>;
  };
  const acc = new Map<string, Acc>();
  for (const t of tries) {
    for (const q of t.snapshot) {
      const e = acc.get(q.questionId) ?? { q, seen: 0, answered: 0, fullMarks: 0, marksSum: 0, optionCounts: new Map(), wrongCounts: new Map() };
      e.seen++;
      const a = ansMap.get(key(t.id, q.questionId));
      if (a && isAnswered(a.response)) {
        e.answered++;
        if (a.response && "optionIds" in a.response) {
          const correct = new Set(q.correctAnswer && "optionIds" in q.correctAnswer ? q.correctAnswer.optionIds : []);
          for (const id of a.response.optionIds) {
            e.optionCounts.set(id, (e.optionCounts.get(id) ?? 0) + 1);
            if (!correct.has(id)) e.wrongCounts.set(id, (e.wrongCounts.get(id) ?? 0) + 1);
          }
        }
      }
      const m = a?.marks ?? 0;
      e.marksSum += Math.max(0, m);
      if (m >= q.marks) e.fullMarks++;
      acc.set(q.questionId, e);
    }
  }

  return [...acc.values()].map((e) => {
    const facility = e.seen ? e.fullMarks / e.seen : 0;
    const correctIds = new Set(e.q.correctAnswer && "optionIds" in e.q.correctAnswer ? e.q.correctAnswer.optionIds : []);
    const topWrong = [...e.wrongCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      questionId: e.q.questionId,
      type: e.q.type,
      prompt: e.q.prompt,
      marks: e.q.marks,
      assignedDifficulty: e.q.difficulty ?? null,
      attempts: e.seen,
      answered: e.answered,
      skipped: e.seen - e.answered,
      skipRate: e.seen ? round2(((e.seen - e.answered) / e.seen) * 100) : 0,
      correctRate: round2(facility * 100),
      averageMarksPct: e.seen ? round2((e.marksSum / (e.seen * e.q.marks)) * 100) : 0,
      difficulty: e.seen < 3 ? "Insufficient data" : facility >= 0.7 ? "Easy" : facility >= 0.3 ? "Moderate" : "Hard",
      commonWrong: topWrong ? { text: e.q.options?.find((o) => o.id === topWrong[0])?.text ?? topWrong[0], count: topWrong[1] } : null,
      distribution: (e.q.options ?? []).map((o) => ({ id: o.id, text: o.text, count: e.optionCounts.get(o.id) ?? 0, correct: correctIds.has(o.id) })),
    };
  });
}
