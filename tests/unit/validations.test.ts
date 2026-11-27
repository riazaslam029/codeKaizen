import { describe, expect, it } from "vitest";
import { clientEventSchema, preferencesSchema, saveAnswersSchema, scratchpadSchema } from "@/lib/validations/attempt";
import { changeRoleSchema, loginSchema } from "@/lib/validations/auth";
import { examSchema } from "@/lib/validations/exam";
import { questionSchema, toQuestionColumns } from "@/lib/validations/question";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";

const iso = (h: number) => new Date(Date.UTC(2026, 5, 1, h)).toISOString();
const exam = { title: "Databases", code: "db-201", startsAt: iso(9), endsAt: iso(12), durationMinutes: 60, passPercentage: 50, maxAttempts: 1, shuffleQuestions: false, shuffleOptions: false };
const uuid = "11111111-1111-4111-8111-111111111111";

describe("login & user schemas", () => {
  it("normalises email to lower case and trims", () => expect(loginSchema.parse({ email: "  Admin@Example.COM ", password: "x" }).email).toBe("admin@example.com"));
  it.each([{ email: "nope", password: "x" }, { email: "a@b.co", password: "" }, { email: "a@b.co", password: "x".repeat(129) }, {}])("rejects %j", (v) =>
    expect(loginSchema.safeParse(v).success).toBe(false),
  );
  it("SQL-looking input is just an invalid email, not an error", () => expect(loginSchema.safeParse({ email: "' OR 1=1 --", password: "x" }).success).toBe(false));
  it("password policy: min 8", () => {
    expect(createUserSchema.safeParse({ name: "Al", email: "a@b.co", role: "ADMIN", password: "short" }).success).toBe(false);
    expect(createUserSchema.safeParse({ name: "Al", email: "a@b.co", role: "ADMIN", password: "long-enough" }).success).toBe(true);
  });
  it("roles are a closed set", () => {
    expect(changeRoleSchema.safeParse({ role: "ROOT" }).success).toBe(false);
    expect(createUserSchema.safeParse({ name: "Al", email: "a@b.co", role: "SUPERUSER", password: "long-enough" }).success).toBe(false);
  });
  it("update allows blank password (keep current) but not a weak one", () => {
    expect(updateUserSchema.safeParse({ name: "Al", email: "a@b.co", password: "" }).success).toBe(true);
    expect(updateUserSchema.safeParse({ name: "Al", email: "a@b.co", password: "abc" }).success).toBe(false);
  });
});

describe("examSchema", () => {
  it("accepts a valid exam and upper-cases the code", () => expect(examSchema.parse(exam).code).toBe("DB-201"));
  it("rejects a window that ends before it starts", () => expect(examSchema.safeParse({ ...exam, endsAt: iso(8) }).success).toBe(false));
  it("rejects a duration longer than the window", () => {
    const r = examSchema.safeParse({ ...exam, durationMinutes: 200 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["durationMinutes"]);
  });
  it.each([
    ["durationMinutes", 0],
    ["durationMinutes", 601],
    ["passPercentage", -1],
    ["passPercentage", 101],
    ["maxAttempts", 0],
    ["code", "a b"],
    ["title", "x"],
    ["startsAt", "yesterday"],
  ])("rejects %s = %j", (k, v) => expect(examSchema.safeParse({ ...exam, [k]: v }).success).toBe(false));
});

describe("questionSchema", () => {
  const mcq = { type: "MCQ_SINGLE", prompt: "Pick one please", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionIds: ["a"], marks: 2 };
  it("accepts a valid single-answer question", () => expect(questionSchema.safeParse(mcq).success).toBe(true));
  it("single answer needs exactly one correct option", () => expect(questionSchema.safeParse({ ...mcq, correctOptionIds: ["a", "b"] }).success).toBe(false));
  it("multi-select needs at least one correct option", () => expect(questionSchema.safeParse({ ...mcq, type: "MCQ_MULTI", correctOptionIds: [] }).success).toBe(false));
  it("correct answer must be one of the options", () => expect(questionSchema.safeParse({ ...mcq, correctOptionIds: ["c"] }).success).toBe(false));
  it("duplicate option texts are rejected", () => expect(questionSchema.safeParse({ ...mcq, options: [{ id: "a", text: "X" }, { id: "b", text: "x" }] }).success).toBe(false));
  it("needs at least two options", () => expect(questionSchema.safeParse({ ...mcq, options: [{ id: "a", text: "A" }] }).success).toBe(false));
  it("penalty cannot exceed the marks; marks must be positive", () => {
    expect(questionSchema.safeParse({ ...mcq, negativeMarks: 3 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mcq, marks: 0 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...mcq, marks: -2 }).success).toBe(false);
  });
  it("short answer needs accepted answers", () => expect(questionSchema.safeParse({ type: "SHORT_ANSWER", prompt: "Name it", marks: 1 }).success).toBe(false));
  it("essay needs no key", () => expect(questionSchema.safeParse({ type: "ESSAY", prompt: "Discuss this", marks: 10 }).success).toBe(true));
  it("toQuestionColumns stores a de-duplicated, sorted key and no options for written types", () => {
    const multi = questionSchema.parse({ ...mcq, type: "MCQ_MULTI", options: [...mcq.options, { id: "c", text: "C" }], correctOptionIds: ["c", "a", "c"] });
    expect(toQuestionColumns(multi).correctAnswer).toEqual({ optionIds: ["a", "c"] });
    expect(toQuestionColumns(questionSchema.parse({ type: "ESSAY", prompt: "Discuss this", marks: 10 }))).toEqual({ options: null, correctAnswer: null });
  });
});

describe("attempt payload schemas", () => {
  const ok = { answers: [{ questionId: uuid, response: { optionIds: ["a"] }, flagged: false, revision: 1 }] };
  it("accepts a valid batch", () => expect(saveAnswersSchema.safeParse(ok).success).toBe(true));
  it.each([
    ["non-uuid question id", { answers: [{ ...ok.answers[0], questionId: "1; drop table" }] }],
    ["revision 0", { answers: [{ ...ok.answers[0], revision: 0 }] }],
    ["option id outside a–h", { answers: [{ ...ok.answers[0], response: { optionIds: ["z"] } }] }],
    ["text over 20,000 chars", { answers: [{ ...ok.answers[0], response: { text: "x".repeat(20_001) } }] }],
    ["empty batch", { answers: [] }],
    ["over 200 answers", { answers: Array(201).fill(ok.answers[0]) }],
    ["bad session id", { ...ok, clientSessionId: "<script>" }],
  ])("rejects %s", (_n, v) => expect(saveAnswersSchema.safeParse(v).success).toBe(false));
  it("client events are limited to connectivity indicators", () => {
    expect(clientEventSchema.safeParse({ type: "NETWORK_LOSS", details: { offlineSeconds: 5 } }).success).toBe(true);
    expect(clientEventSchema.safeParse({ type: "AUTO_SUBMITTED" }).success).toBe(false);
  });
  it("scratchpad is bounded (max 10 pages)", () => {
    const page = { id: "p", title: "P", notes: "", strokes: [] };
    expect(scratchpadSchema.safeParse({ pages: [page] }).success).toBe(true);
    expect(scratchpadSchema.safeParse({ pages: Array(11).fill(page) }).success).toBe(false);
  });
  it("preferences are a closed set", () => {
    expect(preferencesSchema.safeParse({ fontSize: "lg", showNavigator: true, layout: "focus", theme: "dark" }).success).toBe(true);
    expect(preferencesSchema.safeParse({ fontSize: "huge", showNavigator: true, layout: "focus", theme: "dark" }).success).toBe(false);
  });
});
