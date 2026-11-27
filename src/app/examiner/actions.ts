"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import type { ActionResult } from "@/lib/action-types";
import { runAction } from "@/lib/actions";
import { authorize } from "@/lib/auth/dal";
import { assertCanManageExam } from "@/lib/permissions";
import { announcementSchema, examSchema } from "@/lib/validations/exam";
import { questionSchema } from "@/lib/validations/question";
import { createCandidateSchema } from "@/lib/validations/user";
import { audit } from "@/services/audit";
import { EnrollmentService, ExamService } from "@/services/exams/exam.service";
import { GradingService } from "@/services/grading/grading.service";
import { QuestionService } from "@/services/questions/question.service";
import { UserService } from "@/services/users/user.service";

const id = z.uuid();
const staff = () => authorize("EXAMINER", "ADMIN");

/* ── exams ── */
export async function createExamAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => ExamService.create(await staff(), examSchema.parse(input)), "Examination created");
}
export async function updateExamAction(examId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await ExamService.update(await staff(), id.parse(examId), examSchema.parse(input));
    return null;
  }, "Examination saved");
}
export async function publishExamAction(examId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await ExamService.publish(await staff(), id.parse(examId));
    return null;
  }, "Examination published");
}
export async function unpublishExamAction(examId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await ExamService.unpublish(await staff(), id.parse(examId));
    return null;
  }, "Returned to draft");
}
export async function closeExamAction(examId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await ExamService.close(await staff(), id.parse(examId));
    return null;
  }, "Examination closed");
}

export async function archiveExamAction(examId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await ExamService.archive(await staff(), id.parse(examId));
    return null;
  }, "Examination archived");
}
export async function deleteExamAction(examId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await ExamService.remove(await staff(), id.parse(examId));
    redirect("/examiner/exams");
  }, "Examination deleted");
}

/* ── paper ── */
export async function addQuestionsAction(examId: string, questionIds: string[]): Promise<ActionResult<{ added: number }>> {
  return runAction(async () => ExamService.addQuestions(await staff(), id.parse(examId), z.array(id).max(200).parse(questionIds)));
}
export async function removeQuestionAction(examId: string, questionId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await ExamService.removeQuestion(await staff(), id.parse(examId), id.parse(questionId));
    return null;
  }, "Question removed");
}
export async function moveQuestionAction(examId: string, questionId: string, dir: "up" | "down"): Promise<ActionResult<null>> {
  return runAction(async () => {
    await ExamService.moveQuestion(await staff(), id.parse(examId), id.parse(questionId), z.enum(["up", "down"]).parse(dir));
    return null;
  });
}

/* ── enrolment ── */
export async function enrollAction(examId: string, candidateIds: string[]): Promise<ActionResult<{ enrolled: number }>> {
  return runAction(async () => EnrollmentService.enroll(await staff(), id.parse(examId), z.array(id).max(500).parse(candidateIds)));
}
export async function setEnrollmentStatusAction(enrollmentId: string, status: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await EnrollmentService.setStatus(await staff(), id.parse(enrollmentId), z.enum(["ENROLLED", "WITHDRAWN", "BLOCKED"]).parse(status));
    return null;
  }, "Enrolment updated");
}
export async function createCandidateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await staff();
    const data = createCandidateSchema.parse(input);
    const u = await UserService.create(actor, { ...data, role: "CANDIDATE" });
    return { id: u.id };
  }, "Candidate created");
}

/* ── question bank ── */
export async function createQuestionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => QuestionService.create(await staff(), questionSchema.parse(input)), "Question added to the bank");
}
export async function updateQuestionAction(questionId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    await QuestionService.update(await staff(), id.parse(questionId), questionSchema.parse(input));
    return null;
  }, "Question saved");
}
export async function archiveQuestionAction(questionId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await QuestionService.archive(await staff(), id.parse(questionId));
    return null;
  }, "Question archived");
}

/* ── announcements ── */
export async function postAnnouncementAction(examId: string, input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const actor = await staff();
    const exam = id.parse(examId);
    await assertCanManageExam(actor, exam);
    const data = announcementSchema.parse(input);
    await db.insert(announcements).values({ examId: exam, authorId: actor.id, title: data.title, body: data.body, audience: "CANDIDATES" });
    await audit(actor.id, "announcement.post", `${actor.name} posted "${data.title}"`, { type: "exam", id: exam });
    return null;
  }, "Announcement sent to candidates");
}

/* ── grading & results ── */
export async function gradeAnswerAction(input: unknown): Promise<ActionResult<{ score: number; pending: number } | null>> {
  return runAction(async () => {
    const data = z
      .object({ attemptId: id, questionId: id, marks: z.coerce.number().min(-100).max(100), feedback: z.string().trim().max(2000).default("") })
      .parse(input);
    const r = await GradingService.gradeAnswer(await staff(), data);
    return r ? { score: r.score, pending: r.pending } : null;
  }, "Grade saved");
}
export async function publishResultsAction(examId: string): Promise<ActionResult<{ published: number; awaitingGrading: number }>> {
  return runAction(async () => GradingService.publishResults(await staff(), id.parse(examId)));
}
