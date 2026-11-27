import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { BatchItem } from "drizzle-orm/batch";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { runBatch } from "@/db/batch";
import { enrollments, questions, users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/dal";
import { csvToObjects } from "@/lib/csv";
import { ApiError } from "@/lib/http";
import { assertCanManageExam } from "@/lib/permissions";
import { questionSchema } from "@/lib/validations/question";
import { password as passwordRule } from "@/lib/validations/user";
import { audit } from "@/services/audit";
import { QuestionService } from "@/services/questions/question.service";

export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_BYTES = 1_000_000;

export type ImportSummary = {
  total: number;
  created: number;
  duplicates: { row: number; value: string; reason: string }[];
  errors: { row: number; message: string }[];
  committed: boolean;
};

function parseRows(format: "csv" | "json", content: string): Record<string, unknown>[] {
  if (content.length > MAX_IMPORT_BYTES) throw ApiError.badRequest("File is larger than 1 MB");
  let rows: unknown;
  if (format === "json") {
    try {
      rows = JSON.parse(content);
    } catch {
      throw ApiError.badRequest("The file is not valid JSON");
    }
    if (!Array.isArray(rows)) throw ApiError.badRequest("JSON must be an array of objects");
  } else rows = csvToObjects(content);
  const list = rows as Record<string, unknown>[];
  if (list.length === 0) throw ApiError.badRequest("The file contains no rows");
  if (list.length > MAX_IMPORT_ROWS) throw ApiError.badRequest(`At most ${MAX_IMPORT_ROWS} rows per import`);
  return list;
}

const candidateRow = z.object({
  name: z.string().trim().min(2, "name is required").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("email is invalid")),
  password: z.union([z.literal(""), passwordRule]).optional(),
});

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
    const rows = parseRows(input.format, input.content);
    const summary: ImportSummary = { total: rows.length, created: 0, duplicates: [], errors: [], committed: false };

    const parsed: { row: number; name: string; email: string; password: string }[] = [];
    const seen = new Set<string>();
    rows.forEach((raw, i) => {
      const row = i + 2; // header is row 1 in CSV terms
      const r = candidateRow.safeParse(raw);
      if (!r.success) {
        summary.errors.push({ row, message: r.error.issues.map((x) => x.message).join("; ") });
        return;
      }
      const pw = r.data.password || input.defaultPassword || "";
      if (pw.length < 8) {
        summary.errors.push({ row, message: "no password column and no default password (min 8 characters)" });
        return;
      }
      if (seen.has(r.data.email)) {
        summary.duplicates.push({ row, value: r.data.email, reason: "repeated in file" });
        return;
      }
      seen.add(r.data.email);
      parsed.push({ row, name: r.data.name, email: r.data.email, password: pw });
    });

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
    const rows = parseRows(input.format, input.content);
    const summary: ImportSummary = { total: rows.length, created: 0, duplicates: [], errors: [], committed: false };
    const split = (v: unknown) =>
      Array.isArray(v) ? v.map(String) : typeof v === "string" && v.trim() ? v.split("|").map((s) => s.trim()) : [];

    const valid: { row: number; cols: ReturnType<typeof QuestionService.columns>; key: string }[] = [];
    const seen = new Set<string>();
    rows.forEach((raw, i) => {
      const row = i + 2;
      const type = String(raw.type ?? "").trim().toUpperCase();
      const optionTexts = split(raw.options);
      const candidate = {
        type,
        prompt: raw.prompt,
        options: type === "TRUE_FALSE" && optionTexts.length === 0 ? [{ id: "a", text: "True" }, { id: "b", text: "False" }] : optionTexts.map((text, k) => ({ id: String.fromCharCode(97 + k), text })),
        correctOptionIds: split(raw.correct).map((c) => c.toLowerCase()),
        accepted: split(raw.accepted),
        marks: raw.marks ?? 1,
        negativeMarks: raw.negative_marks ?? raw.negativeMarks ?? 0,
        multiScoring: String(raw.multi_scoring ?? raw.multiScoring ?? "ALL_OR_NOTHING").toUpperCase() || "ALL_OR_NOTHING",
        difficulty: String(raw.difficulty ?? "MEDIUM").toUpperCase() || "MEDIUM",
        subject: raw.subject ?? "",
        topic: raw.topic ?? "",
        explanation: raw.explanation ?? "",
      };
      const r = questionSchema.safeParse(candidate);
      if (!r.success) {
        summary.errors.push({ row, message: r.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`).join("; ") });
        return;
      }
      const key = r.data.prompt.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) {
        summary.duplicates.push({ row, value: r.data.prompt.slice(0, 80), reason: "repeated in file" });
        return;
      }
      seen.add(key);
      valid.push({ row, cols: QuestionService.columns(r.data), key });
    });

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
