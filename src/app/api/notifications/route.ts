import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { announcements, attempts, auditLogs, enrollments, exams, incidents, users } from "@/db/schema";
import { authorize } from "@/lib/auth/dal";
import { route } from "@/lib/http";

type Note = { id: string; title: string; body: string; at: string; href: string };

const INCIDENT: Record<string, string> = {
  NETWORK_LOSS: "Connection lost",
  RECONNECTED: "Reconnected",
  SYNC_FAILED: "Answer sync failing",
  DUPLICATE_SUBMISSION: "Repeated submit",
  ATTEMPT_RESUMED: "Workspace reloaded",
  LATE_ANSWER_REJECTED: "Late answers rejected",
  AUTO_SUBMITTED: "Auto-submitted at deadline",
  ACCESS_RESTRICTED: "Access restricted",
  ACCESS_RESTORED: "Access restored",
};

/** Role-aware notification feed (latest 8): candidates → announcements; examiners → attempt events; admins → activity. */
export const GET = route(async () => {
  const user = await authorize();
  let items: Note[] = [];
  if (user.role === "CANDIDATE") {
    const rows = await db
      .select({ id: announcements.id, title: announcements.title, body: announcements.body, at: announcements.publishedAt, exam: exams.title })
      .from(announcements)
      .innerJoin(exams, eq(exams.id, announcements.examId))
      .innerJoin(enrollments, and(eq(enrollments.examId, exams.id), eq(enrollments.candidateId, user.id), eq(enrollments.status, "ENROLLED")))
      .where(inArray(announcements.audience, ["ALL", "CANDIDATES"]))
      .orderBy(desc(announcements.publishedAt))
      .limit(8);
    items = rows.map((r) => ({ id: r.id, title: r.title, body: `${r.exam}: ${r.body}`, at: r.at.toISOString(), href: "/candidate/exams" }));
  } else if (user.role === "EXAMINER") {
    const rows = await db
      .select({ id: incidents.id, type: incidents.type, at: incidents.occurredAt, examId: incidents.examId, attemptId: incidents.attemptId, exam: exams.code, candidate: users.name })
      .from(incidents)
      .innerJoin(exams, eq(exams.id, incidents.examId))
      .innerJoin(attempts, eq(attempts.id, incidents.attemptId))
      .innerJoin(users, eq(users.id, incidents.candidateId))
      .where(and(eq(exams.createdById, user.id), eq(attempts.isSandbox, false), ne(incidents.type, "ATTEMPT_RESUMED")))
      .orderBy(desc(incidents.occurredAt))
      .limit(8);
    items = rows.map((r) => ({ id: r.id, title: `${INCIDENT[r.type] ?? r.type} · ${r.exam}`, body: r.candidate, at: r.at.toISOString(), href: `/examiner/attempts/${r.attemptId}` }));
  } else {
    const rows = await db.select({ id: auditLogs.id, summary: auditLogs.summary, at: auditLogs.createdAt, action: auditLogs.action }).from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8);
    items = rows.map((r) => ({ id: r.id, title: r.summary ?? r.action, body: r.action, at: r.at.toISOString(), href: "/admin/activity" }));
  }
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
});
