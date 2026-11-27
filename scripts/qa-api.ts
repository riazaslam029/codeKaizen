/**
 * API-level QA against a running server backed by the DEV branch (looks up demo ids in the dev DB).
 *   QA_BASE_URL=http://localhost:3300 QA_PASSWORD=<seed password> npx tsx scripts/qa-api.ts
 * Prints a markdown table (Area | Test | Expected | Actual | Result). Never prints cookies or passwords.
 * Side effect on dev only: one Practice Paper attempt for sofia.marin is started and submitted.
 */
import { assertNotProduction, loadDbEnv } from "./db-env";

loadDbEnv();
assertNotProduction("run API QA");

import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { attempts, exams, results, users } from "../src/db/schema";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3300";
const PASSWORD = process.env.QA_PASSWORD;
if (!PASSWORD) {
  console.error("QA_PASSWORD is required");
  process.exit(1);
}

type Row = { area: string; test: string; expected: string; actual: string; pass: boolean };
const rows: Row[] = [];
const check = (area: string, test: string, expected: string, actual: string, pass: boolean) => rows.push({ area, test, expected, actual, pass });

async function login(email: string) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return { status: r.status, cookie, body: await r.json().catch(() => null) };
}
const req = (cookie: string | null, path: string, init: RequestInit = {}) =>
  fetch(`${BASE}${path}`, { redirect: "manual", ...init, headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json", ...(init.headers ?? {}) } });

async function main() {
  const db = createDb();
  const code = (c: string) => db.select({ id: exams.id }).from(exams).where(eq(exams.code, c)).limit(1).then((r) => r[0]!.id);
  const userId = (e: string) => db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, e)).limit(1).then((r) => r[0]!.id);
  const [mid, practice] = await Promise.all([code("WSEC-MID"), code("WSEC-PRACTICE")]);
  const resultOf = async (email: string) =>
    (await db.select({ id: results.id, code: results.verificationCode }).from(results).where(and(eq(results.examId, mid), eq(results.candidateId, await userId(email)))).limit(1))[0]!;
  const lenaResult = await resultOf("lena.fischer@codekaizen.test");
  const omarResult = await resultOf("omar.haddad@codekaizen.test");

  const admin = await login("admin@codekaizen.test");
  const examiner = await login("d.reyes@codekaizen.test");
  const otherExaminer = await login("p.nair@codekaizen.test");
  const lena = await login("lena.fischer@codekaizen.test");
  const sofia = await login("sofia.marin@codekaizen.test");
  const jonas = await login("jonas.berg@codekaizen.test");
  check("A Auth", "Login as each seeded role", "200 ×6", [admin, examiner, otherExaminer, lena, sofia, jonas].map((x) => x.status).join(","), [admin, examiner, otherExaminer, lena, sofia, jonas].every((x) => x.status === 200));

  /* ── A: permissions ── */
  const s = async (cookie: string | null, path: string, init?: RequestInit) => (await req(cookie, path, init)).status;
  check("A Permissions", "Anonymous GET /api/users", "401", String(await s(null, "/api/users")), (await s(null, "/api/users")) === 401);
  check("A Permissions", "Anonymous GET /api/auth/me", "401", String(await s(null, "/api/auth/me")), (await s(null, "/api/auth/me")) === 401);
  const anonAdmin = await req(null, "/admin");
  check("A Permissions", "Anonymous GET /admin page", "redirect to /login", `${anonAdmin.status} → ${anonAdmin.headers.get("location") ?? "-"}`, anonAdmin.status >= 300 && anonAdmin.status < 400 && (anonAdmin.headers.get("location") ?? "").includes("/login"));
  check("A Permissions", "Candidate GET /api/users (admin only)", "403", String(await s(lena.cookie, "/api/users")), (await s(lena.cookie, "/api/users")) === 403);
  check("A Permissions", "Examiner GET /api/users (admin only)", "403", String(await s(examiner.cookie, "/api/users")), (await s(examiner.cookie, "/api/users")) === 403);
  const usersRes = await req(admin.cookie, "/api/users");
  const usersText = await usersRes.text();
  check("A Permissions", "Admin GET /api/users; no password hashes", "200, no passwordHash", `${usersRes.status}, hash field present: ${/password/i.test(usersText)}`, usersRes.status === 200 && !/password/i.test(usersText));
  const candImport = await s(lena.cookie, "/api/import/questions", { method: "POST", body: JSON.stringify({ format: "csv", content: "x" }) });
  check("A Permissions", "Candidate POST /api/import/questions", "403", String(candImport), candImport === 403);
  const candReport = await s(lena.cookie, `/api/exams/${mid}/report`);
  check("A Permissions", "Candidate GET examiner exam report PDF", "403", String(candReport), candReport === 403);
  const otherReport = await s(otherExaminer.cookie, `/api/exams/${mid}/report`);
  check("A Permissions", "Other examiner GET exam report (not owner)", "403 or 404", String(otherReport), otherReport === 403 || otherReport === 404);
  const ownReport = await req(examiner.cookie, `/api/exams/${mid}/report`);
  check("A Permissions", "Owner examiner GET exam report", "200 application/pdf", `${ownReport.status} ${ownReport.headers.get("content-type")}`, ownReport.status === 200 && (ownReport.headers.get("content-type") ?? "").includes("pdf"));
  const ownPdf = await req(lena.cookie, `/api/results/${lenaResult.id}/pdf`);
  check("A Permissions", "Candidate GET own published result PDF", "200 application/pdf", `${ownPdf.status} ${ownPdf.headers.get("content-type")}`, ownPdf.status === 200 && (ownPdf.headers.get("content-type") ?? "").includes("pdf"));
  const foreignPdf = await s(lena.cookie, `/api/results/${omarResult.id}/pdf`);
  check("A Permissions", "Candidate GET another candidate's result PDF", "404", String(foreignPdf), foreignPdf === 404);
  const candExaminerPage = await req(lena.cookie, "/examiner");
  check("A Permissions", "Candidate opens /examiner page", "redirect away (no examiner UI)", `${candExaminerPage.status} → ${candExaminerPage.headers.get("location") ?? "-"}`, candExaminerPage.status >= 300 && candExaminerPage.status < 400);
  const notEnrolled = await req(jonas.cookie, "/api/attempts", { method: "POST", body: JSON.stringify({ examId: practice }) });
  check("A Permissions", "Non-enrolled candidate starts an exam", "403 or 404", String(notEnrolled.status), notEnrolled.status === 403 || notEnrolled.status === 404);
  const restricted = await login("ravi.kumar@codekaizen.test");
  check("A Auth", "Restricted account, correct password", "403 ACCOUNT_RESTRICTED", `${restricted.status} ${restricted.body?.error?.code}`, restricted.status === 403 && restricted.body?.error?.code === "ACCOUNT_RESTRICTED");

  /* ── C: validation & auth hygiene ── */
  const emptyLogin = await s(null, "/api/auth/login", { method: "POST", body: "{}" });
  check("C Validation", "Login with empty body", "422 VALIDATION_ERROR (field details)", String(emptyLogin), emptyLogin === 422);
  const malformed = await s(null, "/api/auth/login", { method: "POST", body: "{not json" });
  check("C Validation", "Login with malformed JSON", "400", String(malformed), malformed === 400);
  const wrong = await req(null, "/api/auth/login", { method: "POST", body: JSON.stringify({ email: "lena.fischer@codekaizen.test", password: "definitely-wrong-1" }) });
  const unknown = await req(null, "/api/auth/login", { method: "POST", body: JSON.stringify({ email: "nobody-here@codekaizen.test", password: "definitely-wrong-1" }) });
  const [wb, ub] = [await wrong.json(), await unknown.json()];
  check("C Security", "Wrong password vs unknown email (no enumeration)", "both 401, same message", `${wrong.status}/${unknown.status}, same=${wb.error?.message === ub.error?.message}`, wrong.status === 401 && unknown.status === 401 && wb.error?.message === ub.error?.message);
  const badImport = await s(examiner.cookie, "/api/import/questions", { method: "POST", body: JSON.stringify({ format: "xml", content: "" }) });
  check("C Validation", "Import with invalid format / empty content", "422", String(badImport), badImport === 422);
  const badId = await s(lena.cookie, "/api/attempts/not-a-uuid");
  check("C Validation", "Attempt id that is not a UUID", "422", String(badId), badId === 422);

  /* ── C/D: attempt engine on a real attempt ── */
  const start = await req(sofia.cookie, "/api/attempts", { method: "POST", body: JSON.stringify({ examId: practice }) });
  const started = await start.json();
  const attemptId: string | undefined = started.attemptId ?? started.attempt?.id ?? started.id;
  check("E Exam", "Candidate starts or resumes Practice Paper", "201 or 200 with attempt id", `${start.status} ${attemptId ? "id ok" : JSON.stringify(started).slice(0, 80)}`, (start.status === 201 || start.status === 200) && !!attemptId);
  if (attemptId) {
    const stateRes = await req(sofia.cookie, `/api/attempts/${attemptId}`);
    const stateText = await stateRes.text();
    const state = JSON.parse(stateText);
    check("C Security", "Attempt payload has no answer keys", "no correctAnswer / accepted", `correctAnswer:${stateText.includes("correctAnswer")} accepted:${stateText.includes("accepted")}`, !stateText.includes("correctAnswer") && !stateText.includes("\"accepted\""));
    const durationMs = Date.parse(state.attempt.expiresAt) - Date.parse(state.attempt.startedAt);
    check("C Timing", "Deadline = start + 20 min (server)", "1,200,000 ms", `${durationMs} ms`, durationMs === 20 * 60_000);
    const skew = Math.abs(Date.parse(state.serverNow) - Date.now());
    check("C Timing", "Server returns serverNow for clock sync", "present, within 60 s of local", `${skew} ms`, skew < 60_000);
    const foreign = await s(lena.cookie, `/api/attempts/${attemptId}`);
    check("A Permissions", "Candidate reads another candidate's attempt", "404", String(foreign), foreign === 404);

    const q = state.questions.find((x: { type: string }) => x.type === "MCQ_SINGLE");
    const save = (rev: number, opt: string) =>
      req(sofia.cookie, `/api/attempts/${attemptId}/answers`, { method: "PUT", body: JSON.stringify({ answers: [{ questionId: q.questionId, response: { optionIds: [opt] }, flagged: false, revision: rev }] }) });
    const base = (state.answers[q.questionId]?.revision ?? 0) + 10;
    const s1 = await save(base + 2, "a");
    const s2 = await save(base + 1, "b"); // older revision arrives late
    const after = await (await req(sofia.cookie, `/api/attempts/${attemptId}`)).json();
    const stored = after.answers[q.questionId];
    check("C Idempotency", "Out-of-order save (older revision after newer)", "newer answer kept", `${s1.status}/${s2.status}, stored=${stored?.response?.optionIds?.[0]} rev=${stored?.revision}`, s1.status === 200 && stored?.response?.optionIds?.[0] === "a" && stored?.revision === base + 2);
    const garbage = await s(sofia.cookie, `/api/attempts/${attemptId}/answers`, { method: "PUT", body: JSON.stringify({ answers: [{ questionId: "x", response: { optionIds: ["zz"] }, revision: 0 }] }) });
    check("C Validation", "Save answers with invalid payload", "422", String(garbage), garbage === 422);

    const [r1, r2, r3] = await Promise.all([1, 2, 3].map(() => req(sofia.cookie, `/api/attempts/${attemptId}/submit`, { method: "POST" })));
    const bodies = await Promise.all([r1!, r2!, r3!].map((r) => r.json()));
    const rowsForAttempt = await db.select({ n: sql<number>`count(*)::int` }).from(results).where(eq(results.attemptId, attemptId));
    const [att] = await db.select({ status: attempts.status }).from(attempts).where(eq(attempts.id, attemptId));
    check("C Duplicates", "3 concurrent submits of one attempt", "all 200, 1 result row, SUBMITTED", `${[r1, r2, r3].map((r) => r!.status).join(",")} · rows=${rowsForAttempt[0]!.n} · ${att!.status} · already=${bodies.filter((b) => b.alreadySubmitted).length}`, [r1, r2, r3].every((r) => r!.status === 200) && rowsForAttempt[0]!.n === 1 && att!.status === "SUBMITTED");
    const late = await save(base + 5, "c");
    check("C Integrity", "Save after submission", "409 (rejected)", String(late.status), late.status === 409);
  }

  /* ── verification ── */
  const v = await req(null, `/api/verify/${lenaResult.code}`);
  const vText = await v.text();
  check("B Verify", "Public verify of a valid code", "200 valid, no name/email/score", `${v.status} · name:${vText.includes("Lena")} email:${vText.includes("@")} score:${/"score"|percentage/.test(vText)}`, v.status === 200 && !vText.includes("Lena") && !vText.includes("@") && !/"score"|percentage/.test(vText));
  const inv = await s(null, "/api/verify/NOT-A-REAL-CODE-123");
  check("B Verify", "Public verify of an unknown code", "404 invalid", String(inv), inv === 404);

  /* ── headers ── */
  const home = await req(null, "/login");
  const h = (k: string) => home.headers.get(k) ?? "absent";
  check("C Security", "Security headers on /login", "XFO DENY, nosniff, referrer policy, CSP frame-ancestors", `XFO=${h("x-frame-options")} · nosniff=${h("x-content-type-options")} · referrer=${h("referrer-policy")} · CSP=${h("content-security-policy") === "absent" ? "absent" : "set"}`, h("x-frame-options") === "DENY" && h("x-content-type-options") === "nosniff" && h("content-security-policy").includes("frame-ancestors"));
  const cookieFlags = (await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "lena.fischer@codekaizen.test", password: PASSWORD }) })).headers.getSetCookie?.()[0] ?? "";
  check("C Security", "Session cookie flags", "HttpOnly + SameSite", cookieFlags.replace(/=[^;]+/, "=<redacted>").split(";").slice(1).join(";").trim(), /httponly/i.test(cookieFlags) && /samesite/i.test(cookieFlags));

  console.log("| Area | Test | Expected | Actual | Result |\n| --- | --- | --- | --- | --- |");
  for (const r of rows) console.log(`| ${r.area} | ${r.test} | ${r.expected} | ${r.actual.replace(/\|/g, "/")} | ${r.pass ? "Pass" : "**Fail**"} |`);
  console.log(`\n${rows.filter((r) => r.pass).length}/${rows.length} passed`);
}

main().catch((e) => {
  console.error("QA failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
