/**
 * End-to-end smoke test against a running server (dev data only).
 * Usage: npm run start  (in another terminal), then  BASE_URL=http://localhost:3000 npm run test:smoke
 * Reads seed passwords from .env.local; never prints them.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get("set-cookie") ?? "";
  return { res, body: await res.json(), cookie: cookie.split(";")[0]!, rawCookie: cookie };
}

const get = (path: string, cookie?: string) =>
  fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });

async function main() {
  const health = await get("/api/health");
  const hb = await health.json();
  check("GET /api/health reaches Neon", health.status === 200 && hb.database === "up", `latency ${hb.latencyMs} ms`);

  const bad = await login("admin@codekaizen.test", "wrong-password-123");
  check("wrong password → 401", bad.res.status === 401 && bad.body.error?.code === "INVALID_CREDENTIALS");
  const unknown = await login("nobody@codekaizen.test", "whatever-123");
  check("unknown email → same 401 message", unknown.res.status === 401 && unknown.body.error?.message === bad.body.error?.message);
  const invalid = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "not-an-email" }) });
  check("invalid body → 422 validation error", invalid.status === 422);

  const admin = await login("admin@codekaizen.test", process.env.SEED_ADMIN_PASSWORD!);
  check("admin login → 200 + redirect /admin", admin.res.status === 200 && admin.body.redirectTo === "/admin");
  check("session cookie is HttpOnly + SameSite=Lax", /HttpOnly/i.test(admin.rawCookie) && /SameSite=lax/i.test(admin.rawCookie));
  const examiner = await login("d.reyes@codekaizen.test", process.env.SEED_EXAMINER_PASSWORD!);
  const examiner2 = await login("p.nair@codekaizen.test", process.env.SEED_EXAMINER_PASSWORD!);
  const lena = await login("lena.fischer@codekaizen.test", process.env.SEED_CANDIDATE_PASSWORD!);
  const omar = await login("omar.haddad@codekaizen.test", process.env.SEED_CANDIDATE_PASSWORD!);
  check("examiner + candidate logins → 200", [examiner, examiner2, lena, omar].every((s) => s.res.status === 200));

  const me = await (await get("/api/auth/me", lena.cookie)).json();
  check("GET /api/auth/me returns user without password hash", me.user?.email === "lena.fischer@codekaizen.test" && !("passwordHash" in me.user));
  check("GET /api/auth/me without cookie → 401", (await get("/api/auth/me")).status === 401);
  check("tampered cookie → 401", (await get("/api/auth/me", lena.cookie.slice(0, -4) + "AAAA")).status === 401);

  check("candidate → GET /api/users → 403", (await get("/api/users", lena.cookie)).status === 403);
  check("examiner → GET /api/users → 403", (await get("/api/users", examiner.cookie)).status === 403);
  const usersRes = await get("/api/users", admin.cookie);
  const users = (await usersRes.json()).users as { id: string; email: string; role: string }[];
  check("admin → GET /api/users → 200 (6 users, no hashes)", usersRes.status === 200 && users.length >= 6 && users.every((u) => !("passwordHash" in u)));

  const id = (email: string) => users.find((u) => u.email === email)!.id;
  const patchRole = (target: string, cookie: string, role: string) =>
    fetch(`${BASE}/api/users/${target}/role`, { method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ role }) });

  check("candidate cannot promote self to ADMIN → 403", (await patchRole(id("lena.fischer@codekaizen.test"), lena.cookie, "ADMIN")).status === 403);
  check("admin cannot change own role → 403", (await patchRole(id("admin@codekaizen.test"), admin.cookie, "CANDIDATE")).status === 403);
  check("admin role change with bad enum → 422", (await patchRole(id("sofia.marin@codekaizen.test"), admin.cookie, "ROOT")).status === 422);
  const ok = await patchRole(id("sofia.marin@codekaizen.test"), admin.cookie, "CANDIDATE");
  check("admin can set another user's role → 200", ok.status === 200);

  const lenaId = id("lena.fischer@codekaizen.test");
  const own = await get(`/api/candidates/${lenaId}/enrollments`, lena.cookie);
  const ownBody = await own.json();
  check("candidate reads own enrolments → 200 (1 exam)", own.status === 200 && ownBody.enrollments.length === 1);
  check("enrolment payload has no question/answer data", !JSON.stringify(ownBody).includes("correct"));
  check("candidate reads ANOTHER candidate's enrolments → 404", (await get(`/api/candidates/${lenaId}/enrollments`, omar.cookie)).status === 404);
  check("owning examiner reads candidate enrolments → 200", (await get(`/api/candidates/${lenaId}/enrollments`, examiner.cookie)).status === 200);
  check("non-owning examiner → 404", (await get(`/api/candidates/${lenaId}/enrollments`, examiner2.cookie)).status === 404);
  check("malformed id → 422", (await get(`/api/candidates/not-a-uuid/enrollments`, admin.cookie)).status === 422);

  const loc = (r: Response) => r.headers.get("location") ?? "";
  check("anonymous /admin → redirect to /login", loc(await get("/admin")).includes("/login"));
  check("candidate /admin → redirect to /candidate", loc(await get("/admin", lena.cookie)).endsWith("/candidate"));
  const adminPage = await get("/admin/users", admin.cookie);
  const html = await adminPage.text();
  check("admin /admin/users renders seeded users from DB", adminPage.status === 200 && html.includes("Priya Nair"));
  const candPage = await (await get("/candidate", lena.cookie)).text();
  check("candidate dashboard lists enrolled exam", candPage.includes("WSEC-101"));
  const sofiaLogin = await login("sofia.marin@codekaizen.test", process.env.SEED_CANDIDATE_PASSWORD!);
  check("unenrolled candidate sees empty state", (await (await get("/candidate", sofiaLogin.cookie)).text()).includes("No examinations yet"));

  const logout = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie: lena.cookie } });
  check("logout clears cookie", logout.status === 200 && /ckz_session=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(logout.headers.get("set-cookie") ?? ""));

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("Smoke test crashed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
