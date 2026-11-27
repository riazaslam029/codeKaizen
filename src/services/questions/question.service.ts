import "server-only";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { examQuestions, questions, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";
import { type QuestionInput, toQuestionColumns } from "@/lib/validations/question";
import { audit } from "@/services/audit";

export type BankFilters = { q?: string; type?: string; difficulty?: string; subject?: string };

/** Shared question bank: every examiner can reuse any question; only the author (or an admin) may edit it. */
export class QuestionService {
  static async list(filters: BankFilters = {}) {
    const conds = [eq(questions.isArchived, false)];
    if (filters.q) conds.push(or(ilike(questions.prompt, `%${filters.q}%`), ilike(questions.topic, `%${filters.q}%`))!);
    if (filters.type) conds.push(sql`${questions.type} = ${filters.type}`);
    if (filters.difficulty) conds.push(sql`${questions.difficulty} = ${filters.difficulty}`);
    if (filters.subject) conds.push(eq(questions.subject, filters.subject));
    return db
      .select({
        id: questions.id,
        type: questions.type,
        prompt: questions.prompt,
        options: questions.options,
        correctAnswer: questions.correctAnswer,
        explanation: questions.explanation,
        subject: questions.subject,
        topic: questions.topic,
        difficulty: questions.difficulty,
        defaultMarks: questions.defaultMarks,
        negativeMarks: questions.negativeMarks,
        multiScoring: questions.multiScoring,
        authorId: questions.authorId,
        author: users.name,
        usedIn: sql<number>`(select count(*)::int from ${examQuestions} where ${examQuestions.questionId} = ${questions.id})`,
        createdAt: questions.createdAt,
      })
      .from(questions)
      .innerJoin(users, eq(users.id, questions.authorId))
      .where(and(...conds))
      .orderBy(desc(questions.createdAt))
      .limit(500);
  }

  static async subjects() {
    const rows = await db
      .selectDistinct({ subject: questions.subject })
      .from(questions)
      .where(and(eq(questions.isArchived, false), sql`${questions.subject} is not null and ${questions.subject} <> ''`))
      .orderBy(asc(questions.subject));
    return rows.map((r) => r.subject!).filter(Boolean);
  }

  static columns(input: QuestionInput) {
    return {
      type: input.type,
      prompt: input.prompt,
      ...toQuestionColumns(input),
      explanation: input.explanation || null,
      subject: input.subject || null,
      topic: input.topic || null,
      difficulty: input.difficulty,
      defaultMarks: input.marks,
      negativeMarks: input.negativeMarks,
      multiScoring: input.multiScoring,
    };
  }

  static async create(actor: SessionUser, input: QuestionInput) {
    if (actor.role !== "EXAMINER" && actor.role !== "ADMIN") throw ApiError.forbidden();
    const [row] = await db
      .insert(questions)
      .values({ ...this.columns(input), authorId: actor.id })
      .returning({ id: questions.id });
    await audit(actor.id, "question.create", `${actor.name} added a ${input.type.toLowerCase().replace("_", " ")} question`, { type: "question", id: row!.id });
    return row!;
  }

  /**
   * Edits change the bank (and future attempts) only: every started attempt keeps the frozen
   * snapshot taken when it began, so in-flight and graded attempts are never affected.
   */
  static async update(actor: SessionUser, id: string, input: QuestionInput) {
    await this.assertAuthor(actor, id);
    await db.update(questions).set(this.columns(input)).where(eq(questions.id, id));
    await audit(actor.id, "question.update", `${actor.name} edited a question`, { type: "question", id });
  }

  /** Soft delete: keeps history intact for attempts/answers that reference it. */
  static async archive(actor: SessionUser, id: string) {
    await this.assertAuthor(actor, id);
    const [used] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(examQuestions)
      .where(eq(examQuestions.questionId, id));
    if ((used?.n ?? 0) > 0) throw ApiError.conflict("Remove this question from its exams before archiving it");
    await db.update(questions).set({ isArchived: true }).where(eq(questions.id, id));
    await audit(actor.id, "question.archive", `${actor.name} archived a question`, { type: "question", id });
  }

  private static async assertAuthor(actor: SessionUser, id: string) {
    const [q] = await db.select({ authorId: questions.authorId }).from(questions).where(eq(questions.id, id)).limit(1);
    if (!q) throw ApiError.notFound("Question not found");
    if (actor.role !== "ADMIN" && q.authorId !== actor.id) throw ApiError.forbidden("Only the author can edit this question");
  }
}
