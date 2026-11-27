import { describe, expect, it } from "vitest";
import type { AttemptQuestionSnapshot } from "@/db/schema/types";
import { isAnswered, isAutoGraded, round2, scoreQuestion } from "@/lib/scoring";

const base = { questionId: "q", position: 1, prompt: "?", marks: 4, negativeMarks: 1, multiScoring: "ALL_OR_NOTHING" as const };
const opts = [
  { id: "a", text: "A" },
  { id: "b", text: "B" },
  { id: "c", text: "C" },
  { id: "d", text: "D" },
];
const single: AttemptQuestionSnapshot = { ...base, type: "MCQ_SINGLE", options: opts, correctAnswer: { optionIds: ["b"] } };
const multi: AttemptQuestionSnapshot = { ...base, type: "MCQ_MULTI", options: opts, correctAnswer: { optionIds: ["a", "c"] } };
const partial: AttemptQuestionSnapshot = { ...multi, multiScoring: "PARTIAL" };
const short: AttemptQuestionSnapshot = { ...base, type: "SHORT_ANSWER", options: null, correctAnswer: { accepted: ["Cross-Site Scripting", "xss"] } };
const essay: AttemptQuestionSnapshot = { ...base, type: "ESSAY", options: null, correctAnswer: null, negativeMarks: 0 };

describe("isAnswered", () => {
  it.each([
    [null, false],
    [undefined, false],
    [{ optionIds: [] }, false],
    [{ optionIds: ["a"] }, true],
    [{ text: "   \n " }, false],
    [{ text: "x" }, true],
  ])("%j → %s", (r, expected) => expect(isAnswered(r as never)).toBe(expected));
});

describe("scoreQuestion — single answer", () => {
  it("awards full marks for the correct option", () => expect(scoreQuestion(single, { optionIds: ["b"] })).toEqual({ isCorrect: true, marks: 4 }));
  it("applies the negative mark for a wrong option", () => expect(scoreQuestion(single, { optionIds: ["a"] })).toEqual({ isCorrect: false, marks: -1 }));
  it("gives 0 (no penalty) when unanswered", () => expect(scoreQuestion(single, null)).toEqual({ isCorrect: false, marks: 0 }));
  it("treats two picks on a single-answer question as wrong", () => expect(scoreQuestion(single, { optionIds: ["b", "a"] }).isCorrect).toBe(false));
});

describe("scoreQuestion — multiple select, all-or-nothing", () => {
  it("full marks only for the exact set (order-independent)", () => expect(scoreQuestion(multi, { optionIds: ["c", "a"] })).toEqual({ isCorrect: true, marks: 4 }));
  it("subset earns nothing and is penalised", () => expect(scoreQuestion(multi, { optionIds: ["a"] })).toEqual({ isCorrect: false, marks: -1 }));
  it("superset earns nothing", () => expect(scoreQuestion(multi, { optionIds: ["a", "b", "c"] }).marks).toBe(-1));
});

describe("scoreQuestion — multiple select, partial credit", () => {
  it("exact set = full marks", () => expect(scoreQuestion(partial, { optionIds: ["a", "c"] })).toEqual({ isCorrect: true, marks: 4 }));
  it("one of two correct = half", () => expect(scoreQuestion(partial, { optionIds: ["a"] }).marks).toBe(2));
  it("a wrong pick cancels a right pick", () => expect(scoreQuestion(partial, { optionIds: ["a", "b"] }).marks).toBe(0));
  it("never goes below zero", () => expect(scoreQuestion(partial, { optionIds: ["b", "d"] }).marks).toBe(0));
  it("rounds to two decimals for thirds", () => {
    const three: AttemptQuestionSnapshot = { ...partial, marks: 1, correctAnswer: { optionIds: ["a", "b", "c"] } };
    expect(scoreQuestion(three, { optionIds: ["a"] }).marks).toBe(0.33);
  });
});

describe("scoreQuestion — short answer and essay", () => {
  it("matches case- and whitespace-insensitively", () => expect(scoreQuestion(short, { text: "  cross-site   SCRIPTING " }).isCorrect).toBe(true));
  it("accepts any listed alternative", () => expect(scoreQuestion(short, { text: "XSS" }).marks).toBe(4));
  it("penalises a wrong short answer", () => expect(scoreQuestion(short, { text: "CSRF" }).marks).toBe(-1));
  it("blank essay scores 0 automatically", () => expect(scoreQuestion(essay, { text: "" })).toEqual({ isCorrect: null, marks: 0 }));
  it("written essay needs manual grading (marks = null)", () => expect(scoreQuestion(essay, { text: "My answer" })).toEqual({ isCorrect: null, marks: null }));
});

describe("helpers", () => {
  it("round2", () => {
    expect(round2(1.005 + 0.0001)).toBe(1.01);
    expect(round2(2 / 3)).toBe(0.67);
  });
  it("isAutoGraded", () => {
    expect(isAutoGraded("ESSAY")).toBe(false);
    expect(isAutoGraded("MCQ_MULTI")).toBe(true);
  });
});
