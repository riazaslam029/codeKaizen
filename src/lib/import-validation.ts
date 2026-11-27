import { z } from "zod";
import { csvToObjects } from "./csv";
import { ApiError } from "./http";
import { type QuestionInput, questionSchema } from "./validations/question";
import { password as passwordRule } from "./validations/user";

export const MAX_IMPORT_ROWS = 200;
export const MAX_IMPORT_BYTES = 1_000_000;

/** One entry per problem: spreadsheet row (header = row 1), the column/field, and the reason. */
export type RowError = { row: number; field: string; message: string };
export type RowDuplicate = { row: number; value: string; reason: string };

/** Parses an uploaded CSV/JSON file into row objects; rejects oversized, empty or malformed files. */
export function parseImportRows(format: "csv" | "json", content: string): Record<string, unknown>[] {
  if (content.length > MAX_IMPORT_BYTES) throw ApiError.badRequest("File is larger than 1 MB");
  let rows: unknown;
  if (format === "json") {
    try {
      rows = JSON.parse(content);
    } catch {
      throw ApiError.badRequest("The file is not valid JSON");
    }
    if (!Array.isArray(rows)) throw ApiError.badRequest("JSON must be an array of objects");
    if (rows.some((r) => typeof r !== "object" || r === null || Array.isArray(r))) throw ApiError.badRequest("Every JSON item must be an object");
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

/** Row numbers are 1-based with the header as row 1, matching what a spreadsheet shows. */
export function validateCandidateRows(rows: Record<string, unknown>[], defaultPassword?: string) {
  const valid: { row: number; name: string; email: string; password: string }[] = [];
  const errors: RowError[] = [];
  const duplicates: RowDuplicate[] = [];
  const seen = new Set<string>();
  rows.forEach((raw, i) => {
    const row = i + 2;
    const r = candidateRow.safeParse(raw);
    if (!r.success) {
      for (const x of r.error.issues) errors.push({ row, field: x.path.join(".") || "row", message: x.message });
      return;
    }
    const pw = r.data.password || defaultPassword || "";
    if (pw.length < 8) {
      errors.push({ row, field: "password", message: "no password column and no default password (min 8 characters)" });
      return;
    }
    if (seen.has(r.data.email)) {
      duplicates.push({ row, value: r.data.email, reason: "repeated in file" });
      return;
    }
    seen.add(r.data.email);
    valid.push({ row, name: r.data.name, email: r.data.email, password: pw });
  });
  return { valid, errors, duplicates };
}

export const questionKey = (prompt: string) => prompt.toLowerCase().replace(/\s+/g, " ").trim();

/** Schema paths → the column names a user sees in the file. */
const FIELD: Record<string, string> = { correctOptionIds: "correct", negativeMarks: "negative_marks", multiScoring: "multi_scoring" };

const split = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" && v.trim() ? v.split("|").map((s) => s.trim()) : []);

/**
 * Questions. Columns: type, prompt, options ("a|b|c"), correct (letters, e.g. "a" or "a|c"),
 * accepted ("|"-separated short answers), marks, negative_marks, difficulty, subject, topic, multi_scoring.
 * JSON items may use arrays for options/correct/accepted.
 */
export function validateQuestionRows(rows: Record<string, unknown>[]) {
  const valid: { row: number; input: QuestionInput; key: string }[] = [];
  const errors: RowError[] = [];
  const duplicates: RowDuplicate[] = [];
  const seen = new Set<string>();
  rows.forEach((raw, i) => {
    const row = i + 2;
    const type = String(raw.type ?? "").trim().toUpperCase();
    const optionTexts = split(raw.options);
    const candidate = {
      type,
      prompt: raw.prompt,
      options:
        type === "TRUE_FALSE" && optionTexts.length === 0
          ? [{ id: "a", text: "True" }, { id: "b", text: "False" }]
          : optionTexts.map((text, k) => ({ id: String.fromCharCode(97 + k), text })),
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
      for (const x of r.error.issues) errors.push({ row, field: FIELD[String(x.path[0] ?? "")] ?? (x.path.join(".") || "row"), message: x.message });
      return;
    }
    const key = questionKey(r.data.prompt);
    if (seen.has(key)) {
      duplicates.push({ row, value: r.data.prompt.slice(0, 80), reason: "repeated in file" });
      return;
    }
    seen.add(key);
    valid.push({ row, input: r.data, key });
  });
  return { valid, errors, duplicates };
}
