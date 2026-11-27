/**
 * End-to-end examination workflow test against a RUNNING server + the dev Neon database.
 *
 *   npm run build && npm run start          (terminal 1)
 *   BASE_URL=http://localhost:3000 npm run test:e2e   (terminal 2)
 *
 * Creates an isolated fixture exam (code E2E-…), exercises the real HTTP API and services, asserts
 * security and resilience rules, then deletes everything it created. Prints PASS/FAIL per check.
 * Runs with --conditions=react-server so server-only service modules can be imported directly.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, inArray, like, sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import * as t from "../src/db/schema";
import type { CorrectAnswer } from "../src/db/schema/types";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = createDb();
let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
}
const api = (path: string, cookie: string, init: RequestInit = {}) =>
  fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", cookie, ...(init.headers ?? {}) } });

async function cleanup() {
  const old = await db.select({ id: t.exams.id }).from(t.exams).where(like(t.exams.code, "E2E-%"));
  const ids = old.map((o) => o.id);
  if (ids.length) {
    const att = await db.select({ id: t.attempts.id }).from(t.attempts).where(inArray(t.attempts.examId, ids));
    const aids = att.map((a) => a.id);
    if (aids.length) {
      await db.delete(t.incidents).where(inArray(t.incidents.attemptId, aids));
      await db.delete(t.disputes).where(sql`${t.disputes.resultId} in (select id from results where attempt_id = any(${sql.raw(`array[${aids.map((a) => `'${a}'::uuid`).join(",")}]`)}))`);
      await db.delete(t.results).where(inArray(t.results.attemptId, aids));
      await db.delete(t.attempts).where(inArray(t.attempts.id, aids)); // answers + scratchpads cascade
    }
    await db.delete(t.announcements).where(inArray(t.announcements.examId, ids));
    await db.delete(t.exams).where(inArray(t.exams.id, ids)); // exam_questions + enrollments cascade
  }
  await db.delete(t.users).where(like(t.users.email, "e2e-%@import.test"));
  await db.delete(t.questions).where(like(t.questions.prompt, "E2E import question%"));
}

async function main() {
  const { GradingService } = await import("../src/services/grading/grading.service");
  const { ResultsService } = await import("../src/services/results/results.service");
  const { UserService } = await import("../src/services/users/user.service");

  await cleanup();
  const P = { a: process.env.SEED_ADMIN_PASSWORD!, e: process.env.SEED_EXAMINER_PASSWORD!, c: process.env.SEED_CANDIDATE_PASSWORD! };
  const byEmail = async (email: string) => (await db.select().from(t.users).where(eq(t.users.email, email)).limit(1))[0]!;
  const examiner = await byEmail("d.reyes@codekaizen.test");
  const lena = await byEmail("lena.fischer@codekaizen.test");
  const omar = await byEmail("omar.haddad@codekaizen.test");
  const sofia = await byEmail("sofia.marin@codekaizen.test");

  /* ── fixture: an exam that is open right now ── */
  const bank = await db.select().from(t.questions).where(and(eq(t.questions.authorId, examiner.id), eq(t.questions.isArchived, false))).limit(11);
  const now = Date.now();
  const [exam] = await db
    .insert(t.exams)
    .values({ code: `E2E-${now.toString(36).toUpperCase()}`, title: "E2E fixture", createdById: examiner.id, status: "PUBLISHED", durationMinutes: 30, startsAt: new Date(now - 5 * 60_000), endsAt: new Date(now + 60 * 60_000), passPercentage: 50, shuffleQuestions: true, shuffleOptions: true })
    .returning();
  await db.insert(t.examQuestions).values(bank.map((q, i) => ({ examId: exam!.id, questionId: q.id, position: i + 1 })));
  await db.insert(t.enrollments).values([lena, omar].map((u) => ({ examId: exam!.id, candidateId: u.id, enrolledById: examiner.id })));
  console.log(`fixture exam ${exam!.code} with ${bank.length} questions`);

  const [cL, cO, cS, cE] = await Promise.all([
    login(lena.email, P.c),
    login(omar.email, P.c),
    login(sofia.email, P.c),
    login(examiner.email, P.e),
  ]);

  /* ── start / eligibility ── */
  const s1 = await api("/api/attempts", cL, { method: "POST", body: JSON.stringify({ examId: exam!.id }) });
  const { attemptId } = await s1.json();
  check("enrolled candidate starts attempt → 201", s1.status === 201 && !!attemptId);
  const s2 = await api("/api/attempts", cL, { method: "POST", body: JSON.stringify({ examId: exam!.id }) });
  const s2b = await s2.json();
  check("second start resumes the same attempt (no duplicate)", s2.status === 200 && s2b.attemptId === attemptId && s2b.resumed);
  check("unenrolled candidate cannot start → 404", (await api("/api/attempts", cS, { method: "POST", body: JSON.stringify({ examId: exam!.id }) })).status === 404);

  /* ── state is candidate-safe ── */
  const st = await (await api(`/api/attempts/${attemptId}`, cL, { headers: { "x-client-session": "sessionAAAA1" } })).json();
  const raw = JSON.stringify(st);
  check("state has all questions", st.questions.length === bank.length);
  const allowedQ = new Set(["questionId", "position", "type", "prompt", "options", "marks"]);
  const qKeysOk = (st.questions as Record<string, unknown>[]).every(
    (q) => Object.keys(q).every((k) => allowedQ.has(k)) && ((q.options as Record<string, unknown>[] | null) ?? []).every((o) => Object.keys(o).every((k) => k === "id" || k === "text")),
  );
  check("NO answer keys in candidate payload (allow-listed fields only)", qKeysOk && !/"(correctAnswer|accepted|explanation|negativeMarks)":/.test(raw));
  check("server time + server deadline provided", !!st.serverNow && Date.parse(st.attempt.expiresAt) - Date.parse(st.attempt.startedAt) === 30 * 60_000);

  /* ── answers: correct responses built from the frozen snapshot ── */
  const [att] = await db.select().from(t.attempts).where(eq(t.attempts.id, attemptId)).limit(1);
  const snapshot = att!.questionSnapshot;
  const correctResp = (c: CorrectAnswer | null, type: string) =>
    type === "ESSAY" ? { text: "Freezing questions guarantees fairness and auditability." } : c && "optionIds" in c ? { optionIds: c.optionIds } : { text: (c as { accepted: string[] }).accepted[0]! };
  const answersBody = snapshot.map((q) => ({ questionId: q.questionId, response: correctResp(q.correctAnswer, q.type), flagged: false, revision: 2 }));
  const save = await api(`/api/attempts/${attemptId}/answers`, cL, { method: "PUT", body: JSON.stringify({ clientSessionId: "sessionAAAA1", answers: answersBody }) });
  const saveBody = await save.json();
  check("batch save → 200 with server revisions", save.ok && Object.values(saveBody.revisions).every((r) => r === 2));

  const mcq = snapshot.find((q) => q.type === "MCQ_SINGLE")!;
  const wrongOpt = mcq.options!.find((o) => !(mcq.correctAnswer as { optionIds: string[] }).optionIds.includes(o.id))!.id;
  await api(`/api/attempts/${attemptId}/answers`, cL, { method: "PUT", body: JSON.stringify({ answers: [{ questionId: mcq.questionId, response: { optionIds: [wrongOpt] }, flagged: true, revision: 1 }] }) });
  const [kept] = await db.select().from(t.answers).where(and(eq(t.answers.attemptId, attemptId), eq(t.answers.questionId, mcq.questionId)));
  check("stale (lower-revision) retry does NOT overwrite newer answer", kept!.revision === 2 && JSON.stringify(kept!.response) === JSON.stringify(correctResp(mcq.correctAnswer, mcq.type)));

  const bad = await api(`/api/attempts/${attemptId}/answers`, cL, { method: "PUT", body: JSON.stringify({ answers: [{ questionId: mcq.questionId, response: { optionIds: ["h"] }, flagged: false, revision: 9 }] }) });
  check("unknown option id → 400", bad.status === 400);

  /* ── isolation ── */
  check("other candidate cannot read attempt → 404", (await api(`/api/attempts/${attemptId}`, cO)).status === 404);
  check("other candidate cannot write answers → 404", (await api(`/api/attempts/${attemptId}/answers`, cO, { method: "PUT", body: JSON.stringify({ answers: answersBody.slice(0, 1) }) })).status === 404);

  /* ── resilience indicators ── */
  for (let i = 0; i < 3; i++) await api(`/api/attempts/${attemptId}/events`, cL, { method: "POST", body: JSON.stringify({ type: "NETWORK_LOSS", details: { offlineSeconds: 12 } }) });
  await api(`/api/attempts/${attemptId}/events`, cL, { method: "POST", body: JSON.stringify({ type: "RECONNECTED", details: { offlineSeconds: 12 } }) });
  await api(`/api/attempts/${attemptId}`, cL, { headers: { "x-client-session": "sessionBBBB2" } }); // simulated refresh in a new tab
  const inc = await db.select().from(t.incidents).where(eq(t.incidents.attemptId, attemptId));
  check("repeated connectivity loss escalates to MEDIUM", inc.some((i) => i.type === "NETWORK_LOSS" && i.severity === "MEDIUM"));
  check("reconnection recorded", inc.some((i) => i.type === "RECONNECTED"));
  check("refresh/recovery recorded as ATTEMPT_RESUMED", inc.some((i) => i.type === "ATTEMPT_RESUMED"));
  const [after] = await db.select({ expiresAt: t.attempts.expiresAt }).from(t.attempts).where(eq(t.attempts.id, attemptId));
  check("reconnect/refresh adds NO time", after!.expiresAt.getTime() === att!.expiresAt.getTime());

  /* ── scratchpad ── */
  const pad = { pages: [{ id: "p1", title: "Page 1", notes: "rough work", strokes: [{ points: [[0.1, 0.1], [0.5, 0.5]] as [number, number][], width: 2.5 }] }] };
  const padPut = await api(`/api/attempts/${attemptId}/scratchpad`, cL, { method: "PUT", body: JSON.stringify(pad) });
  const padGet = await (await api(`/api/attempts/${attemptId}/scratchpad`, cL)).json();
  check("scratchpad saves separately and round-trips", padPut.ok && padGet.data?.pages?.[0]?.notes === "rough work");

  /* ── submit (idempotent) ── */
  const sub1 = await (await api(`/api/attempts/${attemptId}/submit`, cL, { method: "POST" })).json();
  const sub2 = await (await api(`/api/attempts/${attemptId}/submit`, cL, { method: "POST" })).json();
  check("submit → SUBMITTED (written answer awaits grading)", sub1.status === "SUBMITTED" && sub1.alreadySubmitted === false);
  check("duplicate submit is idempotent", sub2.alreadySubmitted === true);
  check("duplicate submit logged", (await db.select().from(t.incidents).where(and(eq(t.incidents.attemptId, attemptId), eq(t.incidents.type, "DUPLICATE_SUBMISSION")))).length >= 1);
  check("answers after submit rejected → 409", (await api(`/api/attempts/${attemptId}/answers`, cL, { method: "PUT", body: JSON.stringify({ answers: answersBody.slice(0, 1).map((a) => ({ ...a, revision: 50 })) }) })).status === 409);

  /* ── deadline: Omar's attempt expires, late answers rejected, auto-finalised ── */
  const { attemptId: oId } = await (await api("/api/attempts", cO, { method: "POST", body: JSON.stringify({ examId: exam!.id }) })).json();
  await api(`/api/attempts/${oId}/answers`, cO, { method: "PUT", body: JSON.stringify({ answers: [{ questionId: mcq.questionId, response: { optionIds: [wrongOpt] }, flagged: false, revision: 1 }] }) });
  await db.update(t.attempts).set({ startedAt: new Date(Date.now() - 31 * 60_000), expiresAt: new Date(Date.now() - 60_000) }).where(eq(t.attempts.id, oId));
  const late = await api(`/api/attempts/${oId}/answers`, cO, { method: "PUT", body: JSON.stringify({ answers: [{ questionId: mcq.questionId, response: null, flagged: false, revision: 2 }] }) });
  const lateBody = await late.json();
  const [oAtt] = await db.select().from(t.attempts).where(eq(t.attempts.id, oId));
  check("answer after server deadline → 409 DEADLINE_PASSED", late.status === 409 && lateBody.error?.code === "DEADLINE_PASSED");
  check("attempt auto-finalised at deadline", oAtt!.status === "AUTO_SUBMITTED" || oAtt!.status === "GRADED");
  const [oRes] = await db.select().from(t.results).where(eq(t.results.attemptId, oId));
  check("auto-finalised attempt graded from snapshot (wrong MCQ penalised, floor 0)", !!oRes && oRes.score === 0);

  /* ── sandbox isolation ── */
  const sb = await (await api("/api/attempts", cE, { method: "POST", body: JSON.stringify({ examId: exam!.id }) })).json();
  await api(`/api/attempts/${sb.attemptId}/submit`, cE, { method: "POST" });
  const [sbAtt] = await db.select().from(t.attempts).where(eq(t.attempts.id, sb.attemptId));
  const sbRes = await db.select().from(t.results).where(eq(t.results.attemptId, sb.attemptId));
  check("examiner start = sandbox attempt", sbAtt!.isSandbox === true);
  check("sandbox produces NO result row", sbRes.length === 0);

  /* ── grading + publication ── */
  const actor = { id: examiner.id, email: examiner.email, name: examiner.name, role: "EXAMINER" as const };
  const essay = snapshot.find((q) => q.type === "ESSAY")!;
  const [preRes] = await db.select().from(t.results).where(eq(t.results.attemptId, attemptId));
  const autoMax = snapshot.filter((q) => q.type !== "ESSAY").reduce((s, q) => s + q.marks, 0);
  check("auto-marking: every auto question correct", preRes!.score === autoMax, `${preRes!.score}/${autoMax}`);
  let overMax = false;
  try {
    await GradingService.gradeAnswer(actor, { attemptId, questionId: essay.questionId, marks: essay.marks + 1, feedback: "" });
  } catch {
    overMax = true;
  }
  check("manual mark above maximum rejected", overMax);
  const g = await GradingService.gradeAnswer(actor, { attemptId, questionId: essay.questionId, marks: 7, feedback: "Clear reasoning." });
  check("manual grade completes grading", g?.pending === 0 && g?.score === autoMax + 7);
  const total = snapshot.reduce((s, q) => s + q.marks, 0);
  check("percentage computed exactly", Math.abs((g?.percentage ?? 0) - Math.round(((autoMax + 7) / total) * 10000) / 100) < 0.01);

  const pub = await GradingService.publishResults(actor, exam!.id);
  check("publication publishes graded results", pub.published === 2, JSON.stringify(pub));
  const [published] = await db.select().from(t.results).where(eq(t.results.attemptId, attemptId));
  check("verification code issued", /^CKZ-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(published!.verificationCode ?? ""));
  let locked = false;
  try {
    await GradingService.gradeAnswer(actor, { attemptId, questionId: essay.questionId, marks: 1, feedback: "" });
  } catch {
    locked = true;
  }
  check("grades locked after publication", locked);

  /* ── reports + verification ── */
  const pdf = await api(`/api/results/${published!.id}/pdf`, cL);
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  check("candidate downloads own PDF", pdf.ok && pdf.headers.get("content-type") === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-");
  check("other candidate cannot download it → 404", (await api(`/api/results/${published!.id}/pdf`, cO)).status === 404);
  const ver = await (await fetch(`${BASE}/api/verify/${published!.verificationCode}`)).json();
  check("public verification succeeds", ver.valid === true && ver.examCode === exam!.code);
  check("verification exposes no email or ids", !JSON.stringify(ver).includes("@") && !JSON.stringify(ver).includes(lena.id) && ver.candidate === "Lena F.");
  check("unknown code → not verified", (await fetch(`${BASE}/api/verify/CKZ-AAAA-BBBB-CCCC`)).status === 404);

  /* ── analytics from real data ── */
  const qa = await ResultsService.questionAnalytics(actor, exam!.id);
  check("analytics count only real attempts (sandbox excluded)", qa.attempts === 2);
  const mcqStats = qa.questions.find((q) => q.questionId === mcq.questionId)!;
  check("analytics: correct rate + common wrong answer", mcqStats.correctRate === 50 && mcqStats.commonWrong?.count === 1);

  /* ── bulk import ── */
  const stamp = Date.now();
  const badCsv = `name,email\nE2E One,e2e-1-${stamp}@import.test\nX,not-an-email\n`;
  const imp1 = await (await api("/api/import/candidates", cE, { method: "POST", body: JSON.stringify({ format: "csv", content: badCsv, defaultPassword: "Import-Pass-1" }) })).json();
  check("import with an invalid row writes nothing", imp1.committed === false && imp1.errors.length === 1);
  const goodCsv = `name,email\nE2E One,e2e-1-${stamp}@import.test\nE2E Two,e2e-2-${stamp}@import.test\nE2E Two again,e2e-2-${stamp}@import.test\n`;
  const imp2 = await (await api("/api/import/candidates", cE, { method: "POST", body: JSON.stringify({ format: "csv", content: goodCsv, defaultPassword: "Import-Pass-1", examId: exam!.id }) })).json();
  check("valid import commits, in-file duplicate skipped", imp2.committed && imp2.created === 2 && imp2.duplicates.length === 1);
  const imp3 = await (await api("/api/import/candidates", cE, { method: "POST", body: JSON.stringify({ format: "csv", content: goodCsv, defaultPassword: "Import-Pass-1" }) })).json();
  check("re-import detects existing accounts", imp3.created === 0 && imp3.duplicates.length === 3);
  const qJson = JSON.stringify([{ type: "MCQ_SINGLE", prompt: `E2E import question ${stamp}`, options: ["A", "B"], correct: "a", marks: 1 }]);
  const impQ = await (await api("/api/import/questions", cE, { method: "POST", body: JSON.stringify({ format: "json", content: qJson }) })).json();
  check("question JSON import", impQ.committed && impQ.created === 1);
  check("candidate cannot import → 403", (await api("/api/import/candidates", cL, { method: "POST", body: JSON.stringify({ format: "csv", content: goodCsv }) })).status === 403);

  /* ── admin: deactivation takes effect immediately ── */
  const admin = await byEmail("admin@codekaizen.test");
  const aActor = { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" as const };
  await UserService.setActive(aActor, sofia.id, false);
  check("deactivated user's existing session stops working", (await api("/api/auth/me", cS)).status === 401);
  const blocked = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: sofia.email, password: P.c }) });
  check("deactivated user cannot sign in", blocked.status === 401);
  await UserService.setActive(aActor, sofia.id, true);

  /* ── preferences persist ── */
  const prefs = { fontSize: "lg", showNavigator: false, layout: "focus", theme: "dark" };
  await api("/api/preferences", cL, { method: "PUT", body: JSON.stringify(prefs) });
  const got = await (await api("/api/preferences", cL)).json();
  check("workspace preferences persist server-side", JSON.stringify(got.preferences) === JSON.stringify(prefs));
  await api("/api/preferences", cL, { method: "PUT", body: JSON.stringify({ fontSize: "md", showNavigator: true, layout: "split", theme: "light" }) });

  await cleanup();
  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error("E2E crashed:", e);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
