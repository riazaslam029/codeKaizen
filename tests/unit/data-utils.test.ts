import { describe, expect, it } from "vitest";
import type { AttemptQuestionSnapshot } from "@/db/schema/types";
import { computeQuestionAnalytics, median, summarizeResults } from "@/lib/analytics";
import { csvToObjects, parseCsv } from "@/lib/csv";
import { ApiError } from "@/lib/http";
import { MAX_IMPORT_ROWS, parseImportRows, validateCandidateRows, validateQuestionRows } from "@/lib/import-validation";
import { maskName } from "@/lib/privacy";
import { shuffle, verificationCode } from "@/lib/random";
import { toCandidateQuestions } from "@/services/exams/candidate-view";

describe("CSV parser", () => {
  it("handles quotes, escaped quotes, commas and newlines inside fields, CRLF and BOM", () => {
    const csv = '﻿name,note\r\n"Smith, Jane","She said ""hi""\nthen left"\r\nBob,plain\r\n\r\n';
    expect(parseCsv(csv)).toEqual([
      ["name", "note"],
      ["Smith, Jane", 'She said "hi"\nthen left'],
      ["Bob", "plain"],
    ]);
  });
  it("csvToObjects normalises headers and fills missing cells", () => {
    expect(csvToObjects("Full Name,Email\nA B,a@b.co\nC\n")).toEqual([
      { full_name: "A B", email: "a@b.co" },
      { full_name: "C", email: "" },
    ]);
  });
  it("empty input → no rows", () => expect(csvToObjects("")).toEqual([]));
});

describe("import validation", () => {
  it("rejects malformed JSON, non-arrays, non-object items, empty and oversized files", () => {
    expect(() => parseImportRows("json", "{bad")).toThrow(ApiError);
    expect(() => parseImportRows("json", '{"a":1}')).toThrow(/array/);
    expect(() => parseImportRows("json", "[1,2]")).toThrow(/object/);
    expect(() => parseImportRows("csv", "name,email\n")).toThrow(/no rows/);
    expect(() => parseImportRows("json", JSON.stringify(Array(MAX_IMPORT_ROWS + 1).fill({})))).toThrow(/At most/);
    expect(() => parseImportRows("csv", "x".repeat(1_000_001))).toThrow(/1 MB/);
  });
  it("candidates: row-level errors, in-file duplicates, password fallback", () => {
    const rows = parseImportRows("csv", "name,email,password\nAna Lee,ANA@x.test,\nBad,not-an-email,\nAna Again,ana@x.test,\nBo Yu,bo@x.test,short\n");
    const r = validateCandidateRows(rows, "Default-Pass-1");
    expect(r.valid.map((v) => v.email)).toEqual(["ana@x.test"]);
    expect(r.valid[0]!.password).toBe("Default-Pass-1");
    expect(r.duplicates).toEqual([{ row: 4, value: "ana@x.test", reason: "repeated in file" }]);
    expect(r.errors.map((e) => e.row)).toEqual([3, 5]);
  });
  it("candidates without any password are errors, not silent defaults", () => {
    expect(validateCandidateRows([{ name: "Ana Lee", email: "a@x.test" }]).errors[0]!.message).toMatch(/password/);
  });
  it("questions: CSV letters → option ids, TRUE_FALSE defaults, duplicates and errors", () => {
    const rows = parseImportRows(
      "csv",
      [
        "type,prompt,options,correct,accepted,marks",
        "MCQ_MULTI,Pick the primes,2|3|4,a|b,,2",
        "TRUE_FALSE,The sky is green,,b,,1",
        "mcq_single,Pick the primes,x|y,a,,1",
        "SHORT_ANSWER,Capital of France,,,Paris,1",
        "MCQ_SINGLE,Missing key here,a|b,,,1",
      ].join("\n"),
    );
    const r = validateQuestionRows(rows);
    expect(r.valid.map((v) => v.input.type)).toEqual(["MCQ_MULTI", "TRUE_FALSE", "SHORT_ANSWER"]);
    expect(r.valid[0]!.input.correctOptionIds).toEqual(["a", "b"]);
    expect(r.valid[1]!.input.options.map((o) => o.text)).toEqual(["True", "False"]);
    expect(r.duplicates[0]).toMatchObject({ row: 4, reason: "repeated in file" });
    expect(r.errors[0]!.row).toBe(6);
  });
});

describe("analytics", () => {
  it("median", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("summarizeResults: stats and buckets (100% lands in 90–100)", () => {
    const rows = [100, 95, 50, 49.99, 0].map((p) => ({ percentage: p, passed: p >= 50, status: p > 90 ? "PUBLISHED" : "PROVISIONAL", attemptStatus: p === 0 ? "SUBMITTED" : "GRADED" }));
    const { stats, distribution } = summarizeResults(rows);
    expect(stats).toMatchObject({ count: 5, highest: 100, lowest: 0, median: 50, passed: 3, passRate: 60, published: 2, awaitingGrading: 1 });
    expect(distribution[9]!.count).toBe(2);
    expect(distribution[4]!.count).toBe(1);
    expect(distribution[5]!.count).toBe(1);
    expect(distribution.reduce((s, b) => s + b.count, 0)).toBe(5);
  });
  it("summarizeResults on no rows does not divide by zero", () => expect(summarizeResults([]).stats.average).toBe(0));

  it("computeQuestionAnalytics: skipped, correct rate, distribution and most common wrong answer", () => {
    const q: AttemptQuestionSnapshot = {
      questionId: "q1", position: 1, type: "MCQ_SINGLE", prompt: "?", marks: 2, negativeMarks: 0, multiScoring: "ALL_OR_NOTHING",
      options: [{ id: "a", text: "Right" }, { id: "b", text: "Wrong" }, { id: "c", text: "Other" }], correctAnswer: { optionIds: ["a"] },
    };
    const tries = ["t1", "t2", "t3", "t4"].map((id) => ({ id, snapshot: [q] }));
    const ans = [
      { attemptId: "t1", questionId: "q1", response: { optionIds: ["a"] }, marks: 2 },
      { attemptId: "t2", questionId: "q1", response: { optionIds: ["b"] }, marks: 0 },
      { attemptId: "t3", questionId: "q1", response: { optionIds: ["b"] }, marks: 0 },
      // t4 skipped entirely
    ];
    const [s] = computeQuestionAnalytics(tries, ans);
    expect(s).toMatchObject({ attempts: 4, answered: 3, skipped: 1, skipRate: 25, correctRate: 25, averageMarksPct: 25, difficulty: "Hard" });
    expect(s!.commonWrong).toEqual({ text: "Wrong", count: 2 });
    expect(s!.distribution.map((d) => d.count)).toEqual([1, 2, 0]);
  });
  it("needs at least 3 attempts before labelling difficulty", () => {
    const q = { questionId: "q", position: 1, type: "ESSAY", prompt: "?", marks: 5, negativeMarks: 0, multiScoring: "ALL_OR_NOTHING", options: null, correctAnswer: null } as AttemptQuestionSnapshot;
    expect(computeQuestionAnalytics([{ id: "t", snapshot: [q] }], [])[0]!.difficulty).toBe("Insufficient data");
  });
});

describe("randomisation and verification ids", () => {
  it("shuffle returns a permutation and never mutates the input", () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    const out = shuffle(input);
    expect(input).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });
  it("shuffle actually varies order (not identity every time)", () => {
    const input = Array.from({ length: 10 }, (_, i) => i);
    const orders = new Set(Array.from({ length: 20 }, () => shuffle(input).join(",")));
    expect(orders.size).toBeGreaterThan(1);
  });
  it("verification codes are well-formed, avoid ambiguous characters and do not collide", () => {
    const codes = Array.from({ length: 2000 }, verificationCode);
    for (const c of codes) expect(c).toMatch(/^CKZ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("maskName shows first name + initials only", () => {
    expect(maskName("Lena Fischer")).toBe("Lena F.");
    expect(maskName("  Omar  Abdel  Haddad ")).toBe("Omar A. H.");
    expect(maskName("Cher")).toBe("Cher");
  });
});

describe("candidate-safe question view", () => {
  it("strips answer keys and extra fields and orders by position", () => {
    const snap = [
      { questionId: "2", position: 2, type: "ESSAY", prompt: "B", options: null, correctAnswer: null, marks: 5, negativeMarks: 0, multiScoring: "ALL_OR_NOTHING" },
      { questionId: "1", position: 1, type: "MCQ_SINGLE", prompt: "A", options: [{ id: "a", text: "x", secret: 1 } as never], correctAnswer: { optionIds: ["a"] }, marks: 1, negativeMarks: 1, multiScoring: "ALL_OR_NOTHING" },
    ] as AttemptQuestionSnapshot[];
    const out = toCandidateQuestions(snap);
    expect(out.map((q) => q.questionId)).toEqual(["1", "2"]);
    expect(JSON.stringify(out)).not.toMatch(/correctAnswer|negativeMarks|multiScoring|secret/);
    expect(out[0]!.options).toEqual([{ id: "a", text: "x" }]);
  });
});
