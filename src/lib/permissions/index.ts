import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { enrollments, exams } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";

/**
 * Central authorization rules. Every check runs on the server against DB state;
 * UI hiding is only a convenience on top of these.
 */

export const isStaff = (u: SessionUser) => u.role === "ADMIN" || u.role === "EXAMINER";

/** Role changes: admins only, never on their own account (prevents self-escalation / lock-out). */
export function assertCanChangeRole(actor: SessionUser, targetUserId: string): void {
  if (actor.role !== "ADMIN") throw ApiError.forbidden("Only administrators can change roles");
  if (actor.id === targetUserId) throw ApiError.forbidden("You cannot change your own role");
}

/** Examiners may manage only exams they created; admins manage all. */
export async function assertCanManageExam(actor: SessionUser, examId: string): Promise<void> {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "EXAMINER") throw ApiError.forbidden();
  const [exam] = await db
    .select({ id: exams.id })
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.createdById, actor.id)))
    .limit(1);
  if (!exam) throw ApiError.notFound("Exam not found");
}

/**
 * Candidate records (enrollments, attempts, results):
 * - a candidate may read only their own;
 * - an examiner only for candidates enrolled in one of their exams;
 * - an admin may read all.
 * Returns 404 rather than 403 for other candidates' data to avoid confirming that it exists.
 */
export async function assertCanAccessCandidate(actor: SessionUser, candidateId: string): Promise<void> {
  if (actor.role === "ADMIN") return;
  if (actor.role === "CANDIDATE") {
    if (actor.id !== candidateId) throw ApiError.notFound("Candidate not found");
    return;
  }
  const [link] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(exams, eq(exams.id, enrollments.examId))
    .where(and(eq(enrollments.candidateId, candidateId), eq(exams.createdById, actor.id)))
    .limit(1);
  if (!link) throw ApiError.notFound("Candidate not found");
}
