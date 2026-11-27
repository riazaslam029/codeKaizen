/**
 * Fixes the 100-question Web Development dataset so it matches the importer's real schema, then
 * validates every row with the SAME function the app uses (validateQuestionRows) and proves the CSV
 * and JSON outputs contain identical question data.
 *
 *   npx tsx scripts/fix-dataset.ts sample-data/original_web_exam_100_questions.csv
 *
 * Writes sample-data/web_exam_100_questions_fixed.csv and .json. Exits non-zero on any problem.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { csvToObjects } from "../src/lib/csv";
import { parseImportRows, validateQuestionRows } from "../src/lib/import-validation";

const COLUMNS = ["type", "prompt", "options", "correct", "accepted", "marks", "negative_marks", "difficulty", "subject", "topic", "multi_scoring"] as const;
const TYPE_MAP: Record<string, string> = { single: "MCQ_SINGLE", multiple: "MCQ_MULTI", multi: "MCQ_MULTI", true_false: "TRUE_FALSE", short: "SHORT_ANSWER", essay: "ESSAY" };

const input = process.argv[2] ?? "sample-data/original_web_exam_100_questions.csv";
const src = csvToObjects(readFileSync(input, "utf8"));
const problems: string[] = [];

const fixed = src.map((r, i) => {
  const row = i + 2;
  const rawType = String(r.type).trim().toLowerCase();
  const type = TYPE_MAP[rawType] ?? String(r.type).trim().toUpperCase();
  const options = String(r.options ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  const correct = String(r.correct ?? "").split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
  // 7. correct letters must point at real options
  for (const c of correct) {
    const idx = c.charCodeAt(0) - 97;
    if (c.length !== 1 || idx < 0 || idx >= options.length) problems.push(`row ${row}: correct "${c}" does not match any of ${options.length} options`);
  }
  // 8. multi-select needs at least two correct options
  if (type === "MCQ_MULTI" && correct.length < 2) problems.push(`row ${row}: multiple-select question has fewer than two correct options`);
  // 9. required fields
  for (const k of ["prompt", "marks", "difficulty", "subject", "topic"] as const) if (!String(r[k] ?? "").trim()) problems.push(`row ${row}: missing ${k}`);
  return {
    type,
    prompt: String(r.prompt).trim(),
    options,
    correct,
    accepted: String(r.accepted ?? "").split("|").map((s) => s.trim()).filter(Boolean),
    marks: Number(r.marks),
    negative_marks: Number(r.negative_marks || 0),
    difficulty: String(r.difficulty).trim().toUpperCase(),
    subject: String(r.subject).trim(),
    topic: String(r.topic).trim(),
    multi_scoring: "ALL_OR_NOTHING", // 3–5: valid enum; ALL_OR_NOTHING for single and (initially) multi-select
  };
});

const cell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csv =
  [COLUMNS.join(","), ...fixed.map((q) => COLUMNS.map((c) => cell(Array.isArray(q[c]) ? (q[c] as string[]).join("|") : String(q[c]))).join(","))].join("\n") + "\n";
const json = JSON.stringify(fixed, null, 2) + "\n";
writeFileSync("sample-data/web_exam_100_questions_fixed.csv", csv);
writeFileSync("sample-data/web_exam_100_questions_fixed.json", json);

// Validate both files exactly as the importer does.
const vCsv = validateQuestionRows(parseImportRows("csv", csv));
const vJson = validateQuestionRows(parseImportRows("json", json));
const same = JSON.stringify(vCsv.valid.map((v) => v.input)) === JSON.stringify(vJson.valid.map((v) => v.input));
const types = fixed.reduce<Record<string, number>>((a, q) => ((a[q.type] = (a[q.type] ?? 0) + 1), a), {});

console.log(
  JSON.stringify(
    {
      source: input,
      rows: fixed.length,
      types,
      multiScoring: [...new Set(fixed.map((q) => q.multi_scoring))],
      csv: { valid: vCsv.valid.length, errors: vCsv.errors.length, duplicates: vCsv.duplicates.length },
      json: { valid: vJson.valid.length, errors: vJson.errors.length, duplicates: vJson.duplicates.length },
      csvAndJsonIdentical: same,
      structuralProblems: problems,
    },
    null,
    2,
  ),
);
for (const e of [...vCsv.errors, ...vJson.errors]) console.error(`  row ${e.row}: ${e.message}`);
if (problems.length || vCsv.errors.length || vJson.errors.length || vCsv.duplicates.length || !same || fixed.length !== 100) process.exit(1);
