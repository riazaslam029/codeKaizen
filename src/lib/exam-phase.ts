import type { ExamStatus } from "@/db/schema/enums";

/**
 * The lifecycle shown to users is derived from the stored status plus the clock, so no
 * background job is needed to move an exam from "scheduled" to "ongoing" to "completed".
 */
export type ExamPhase = "DRAFT" | "SCHEDULED" | "ONGOING" | "COMPLETED" | "ARCHIVED";

export function examPhase(
  exam: { status: ExamStatus; startsAt: Date | string; endsAt: Date | string },
  now: Date = new Date(),
): ExamPhase {
  if (exam.status === "DRAFT") return "DRAFT";
  if (exam.status === "ARCHIVED") return "ARCHIVED";
  if (exam.status === "CLOSED") return "COMPLETED";
  const start = new Date(exam.startsAt).getTime();
  const end = new Date(exam.endsAt).getTime();
  const t = now.getTime();
  if (t < start) return "SCHEDULED";
  if (t <= end) return "ONGOING";
  return "COMPLETED";
}

export const PHASE_LABEL: Record<ExamPhase, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Published",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};
