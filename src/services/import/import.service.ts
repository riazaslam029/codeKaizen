import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { BatchItem } from "drizzle-orm/batch";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/batch";
import { enrollments, questions, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import { ApiError } from "@/lib/http";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  parseImportRows,
  type RowDuplicate,
  type RowError,
  validateCandidateRows,
  validateQuestionRows,
} from "@/lib/import-validation";
import { assertCanManageExam } from "@/lib/permissions";
import { audit } from "@/services/audit";
import { QuestionService } from "@/services/questions/question.service";

export type ImportSummary = {
  total: number;
  created: number;
  duplicates: RowDuplicate[];
  errors: RowError[];
  committed: boolean;
};

export { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS };

export class ImportService {
  /**
   * Candidates: validate every row first; if ANY row is invalid nothing is written.
   * Existing emails and in-file repeats are reported as duplicates and skipped.
   * All inserts (users + optional enrolments) run in one transaction.
   */
  static async importCandidates(
    actor: SessionUser,
    input: { format: "csv" | "json"; content: string; defaultPassword?: string; examId?: string },
  ): Promise<ImportSummary> {
    if (input.examId) await assertCanManageExam(actor, input.examId);
    const rows = parseImportRows(input.format, input.content);
    const checked = validateCandidateRows(rows, input.defaultPassword);
    const summary: ImportSummary = { total: rows.length, created: 0, duplicates: checked.duplicates, errors: checked.errors, committed: false };
    const parsed = checked.valid;

    if (parsed.length) {
      const existing = await db
        .select({ email: sql<string>`lower(${users.email})` })
        .from(users)
        .where(inArray(sql`lower(${users.email})`, parsed.map((p) => p.email)));
      const taken = new Set(existing.map((e) => e.email));
      for (const p of parsed.filter((x) => taken.has(x.email))) summary.duplicates.push({ row: p.row, value: p.email, reason: "account already exists" });
      parsed.splice(0, parsed.length, ...parsed.filter((x) => !taken.has(x.email)));
    }

    if (summary.errors.length || parsed.length === 0) return summary;

    // Cost 10 for bulk import keeps a 200-row file inside serverless time limits; sign-in re-hash is not required.
    const prepared = await Promise.all(
      parsed.map(async (p) => ({ ...p, id: randomUUID(), hash: await bcrypt.hash(p.password, 10) })),
    );
    const ops: BatchItem<"pg">[] = [
      db.insert(users).values(prepared.map((p) => ({ id: p.id, name: p.name, email: p.email, role: "CANDIDATE" as const, passwordHash: p.hash }))),
    ];
    if (input.examId) {
      ops.push(db.insert(enrollments).values(prepared.map((p) => ({ examId: input.examId!, candidateId: p.id, enrolledById: actor.id }))));
    }
    await runBatch(ops);
    summary.created = prepared.length;
    summary.committed = true;
    await audit(actor.id, "import.candidates", `${actor.name} imported ${prepared.length} candidate(s)`);
    return summary;
  }

  /**
   * Questions. CSV columns: type, prompt, options (a|b|c), correct (letters, e.g. "a" or "a|c"),
   * accepted (short answers, "|"-separated), marks, negative_marks, difficulty, subject, topic, multi_scoring.
   * JSON: an array of the same fields, where options/correct/accepted may be arrays.
   */
  static async importQuestions(actor: SessionUser, input: { format: "csv" | "json"; content: string }): Promise<ImportSummary> {
    if (actor.role !== "EXAMINER" && actor.role !== "ADMIN") throw ApiError.forbidden();
    const rows = parseImportRows(input.format, input.content);
    const checked = validateQuestionRows(rows);
    const summary: ImportSummary = { total: rows.length, created: 0, duplicates: checked.duplicates, errors: checked.errors, committed: false };
    const valid = checked.valid.map((v) => ({ row: v.row, key: v.key, cols: QuestionService.columns(v.input) }));

    if (valid.length) {
      const existing = await db
        .select({ key: sql<string>`lower(regexp_replace(${questions.prompt}, '\\s+', ' ', 'g'))` })
        .from(questions)
        .where(eq(questions.isArchived, false));
      const have = new Set(existing.map((e) => e.key));
      for (const v of valid.filter((x) => have.has(x.key))) summary.duplicates.push({ row: v.row, value: v.cols.prompt.slice(0, 80), reason: "already in the bank" });
      valid.splice(0, valid.length, ...valid.filter((x) => !have.has(x.key)));
    }

    if (summary.errors.length || valid.length === 0) return summary;
    await runBatch([db.insert(questions).values(valid.map((v) => ({ ...v.cols, authorId: actor.id })))]);
    summary.created = valid.length;
    summary.committed = true;
    await audit(actor.id, "import.questions", `${actor.name} imported ${valid.length} question(s)`);
    return summary;
  }
}
