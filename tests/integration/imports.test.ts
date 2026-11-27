import { like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { questions, users } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { ImportService } from "@/services/import/import.service";
import { EnrollmentService } from "@/services/exams/exam.service";
import { createOpenExam, createWorld, destroyWorld, type World } from "../helpers/world";

let w: World;
beforeAll(async () => {
  w = await createWorld("im");
});
afterAll(async () => destroyWorld(w));

const countUsers = async () => (await db.select({ n: sql<number>`count(*)::int` }).from(users).where(like(users.email, `it-${w.run}-%`)))[0]!.n;
const e = (k: string) => `it-${w.run}-${k}@it.test`;

describe("bulk candidate import", () => {
  it("one invalid row → nothing written (all-or-nothing)", async () => {
    const before = await countUsers();
    const s = await ImportService.importCandidates(w.users.ex1, { format: "csv", content: `name,email\nGood One,${e("g1")}\nX,not-an-email\n`, defaultPassword: "Import-Pass-1" });
    expect(s).toMatchObject({ committed: false, created: 0 });
    expect(s.errors).toEqual([{ row: 3, message: expect.any(String) }]);
    expect(await countUsers()).toBe(before);
  });
  it("valid file commits and enrols; in-file duplicate skipped", async () => {
    const exam = await createOpenExam(w, { publish: false });
    const s = await ImportService.importCandidates(w.users.ex1, {
      format: "json",
      content: JSON.stringify([{ name: "Imp One", email: e("i1") }, { name: "Imp Two", email: e("i2"), password: "Own-Password-9" }, { name: "Imp Two Again", email: e("i2").toUpperCase() }]),
      defaultPassword: "Import-Pass-1",
      examId: exam,
    });
    expect(s).toMatchObject({ committed: true, created: 2, total: 3 });
    expect(s.duplicates).toHaveLength(1);
    const enrolled = await EnrollmentService.listForExam(w.users.ex1, exam);
    expect(enrolled.map((x) => x.email)).toEqual(expect.arrayContaining([e("i1"), e("i2")]));
  });
  it("re-importing reports existing accounts as duplicates and creates nothing", async () => {
    const s = await ImportService.importCandidates(w.users.ex1, { format: "csv", content: `name,email\nImp One,${e("i1")}\n`, defaultPassword: "Import-Pass-1" });
    expect(s).toMatchObject({ committed: false, created: 0, duplicates: [{ reason: "account already exists" }] });
  });
  it("cannot enrol imported candidates into another examiner's exam", async () => {
    const exam = await createOpenExam(w, { publish: false });
    await expect(ImportService.importCandidates(w.users.ex2, { format: "csv", content: `name,email\nZed Z,${e("z")}\n`, defaultPassword: "Import-Pass-1", examId: exam })).rejects.toBeInstanceOf(ApiError);
  });
  it("candidates cannot import", async () => {
    await expect(ImportService.importQuestions(w.users.c1, { format: "json", content: "[]" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("bulk question import", () => {
  it("imports valid questions and skips ones already in the bank", async () => {
    const content = JSON.stringify([
      { type: "MCQ_SINGLE", prompt: `IT ${w.run} imported Q1`, options: ["A", "B"], correct: "a", marks: 1 },
      { type: "ESSAY", prompt: `IT ${w.run} imported essay`, marks: 5 },
    ]);
    expect(await ImportService.importQuestions(w.users.ex1, { format: "json", content })).toMatchObject({ committed: true, created: 2 });
    const again = await ImportService.importQuestions(w.users.ex1, { format: "json", content });
    expect(again).toMatchObject({ committed: false, created: 0 });
    expect(again.duplicates.map((d) => d.reason)).toEqual(["already in the bank", "already in the bank"]);
    expect((await db.select().from(questions).where(like(questions.prompt, `IT ${w.run} imported%`))).length).toBe(2);
  });
  it("stores markup as plain text (rendered escaped by React)", async () => {
    const s = await ImportService.importQuestions(w.users.ex1, { format: "json", content: JSON.stringify([{ type: "ESSAY", prompt: `IT ${w.run} <img src=x onerror=alert(1)>`, marks: 1 }]) });
    expect(s.created).toBe(1);
  });
});
