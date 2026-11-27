import { expect, request as pwRequest, test, type APIRequestContext } from "@playwright/test";
import { BASE_URL } from "../../playwright.config";
import { E2E_PASSWORD, world } from "../e2e/fixtures";

const w = world;

/**
 * Each session gets its OWN request context (own cookie jar), so a test can never accidentally
 * reuse another user's cookie. Requests authenticate purely through that jar.
 */
const contexts: APIRequestContext[] = [];
async function as(email?: string) {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  contexts.push(ctx);
  let raw = "";
  if (email) {
    const res = await ctx.post("/api/auth/login", { data: { email, password: E2E_PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
    raw = res.headers()["set-cookie"] ?? "";
  }
  return { ctx, raw, cookie: raw.split(";")[0]! };
}
test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.dispose()));
});

const FAKE = "00000000-0000-4000-8000-000000000000";

test.describe("authentication", () => {
  test("session cookie is HttpOnly, Secure (production build), SameSite=Lax, path=/", async () => {
    const { raw } = await as(w.users.cand1.email);
    expect(raw).toMatch(/ckz_session=/);
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/Secure/i);
    expect(raw).toMatch(/SameSite=lax/i);
    expect(raw).toMatch(/Path=\//i);
  });

  test("unknown user and wrong password are indistinguishable", async () => {
    const { ctx } = await as();
    const a = await ctx.post("/api/auth/login", { data: { email: w.users.cand1.email, password: "nope-nope" } });
    const b = await ctx.post("/api/auth/login", { data: { email: `ghost-${w.run}@e2e.test`, password: "nope-nope" } });
    expect(a.status()).toBe(401);
    expect(await a.json()).toEqual(await b.json());
  });

  test("malformed / injection payloads are rejected with 4xx, never 500", async () => {
    const { ctx } = await as();
    const payloads: unknown[] = [{ email: "' OR '1'='1", password: "x" }, { email: { $ne: null }, password: "x" }, { email: "a@b.co" }];
    for (const data of payloads) {
      const res = await ctx.post("/api/auth/login", { data });
      expect(res.status(), JSON.stringify(data)).toBeGreaterThanOrEqual(400);
      expect(res.status(), JSON.stringify(data)).toBeLessThan(500);
    }
    const notJson = await ctx.post("/api/auth/login", { data: Buffer.from("{not json"), headers: { "content-type": "application/json" } });
    expect(notJson.status()).toBe(400);
  });

  test("forged, tampered and missing cookies are refused", async () => {
    const { cookie } = await as(w.users.cand1.email);
    const [name, token] = cookie.split("=") as [string, string];
    const [h, p, sig] = token.split(".") as [string, string, string];
    const flipped = sig.slice(0, 10) + (sig[10] === "A" ? "B" : "A") + sig.slice(11);
    const forgedPayload = Buffer.from(JSON.stringify({ role: "ADMIN", sub: w.users.cand1.id, iss: "codekaizen", aud: "codekaizen-web", exp: 9999999999 })).toString("base64url");
    const { ctx: anon } = await as();
    const cases: (string | undefined)[] = [undefined, `${name}=${h}.${p}.${flipped}`, `${name}=${h}.${forgedPayload}.${sig}`, `${name}=eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4Iiwicm9sZSI6IkFETUlOIn0.`];
    for (const c of cases) {
      const res = await anon.get("/api/auth/me", { headers: c ? { cookie: c } : {} });
      expect(res.status(), c ? "tampered cookie" : "no cookie").toBe(401);
    }
  });
});

test.describe("authorisation and data isolation", () => {
  test("role checks on admin APIs; no password hashes ever returned", async () => {
    const cand = await as(w.users.cand1.email);
    const exam = await as(w.users.examiner.email);
    const admin = await as(w.users.admin.email);
    expect((await cand.ctx.get("/api/users")).status()).toBe(403);
    expect((await exam.ctx.get("/api/users")).status()).toBe(403);
    const list = await admin.ctx.get("/api/users");
    expect(list.status()).toBe(200);
    expect(JSON.stringify(await list.json())).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
  });

  test("no privilege escalation via the role API", async () => {
    const cand = await as(w.users.cand1.email);
    const admin = await as(w.users.admin.email);
    const patch = (ctx: APIRequestContext, id: string, role: string) => ctx.patch(`/api/users/${id}/role`, { data: { role } });
    expect((await patch(cand.ctx, w.users.cand1.id, "ADMIN")).status()).toBe(403);
    expect((await patch(admin.ctx, w.users.admin.id, "CANDIDATE")).status()).toBe(403);
    expect((await patch(admin.ctx, w.users.cand2.id, "GOD")).status()).toBe(422);
    expect((await patch(admin.ctx, "not-a-uuid", "ADMIN")).status()).toBe(422);
    const me = await (await cand.ctx.get("/api/auth/me")).json();
    expect(me.user.role).toBe("CANDIDATE");
  });

  test("IDOR: candidates and unrelated examiners cannot read a candidate's records", async () => {
    const c1 = await as(w.users.cand1.email);
    const ex2 = await as(w.users.examiner2.email);
    expect((await c1.ctx.get(`/api/candidates/${w.users.cand2.id}/enrollments`)).status()).toBe(404);
    expect((await c1.ctx.get(`/api/candidates/${w.users.cand1.id}/enrollments`)).status()).toBe(200);
    expect((await ex2.ctx.get(`/api/candidates/${w.users.cand1.id}/enrollments`)).status()).toBe(404);
  });

  test("attempt, result and report endpoints: unknown ids 404, malformed ids 422", async () => {
    const { ctx } = await as(w.users.cand1.email);
    expect((await ctx.get(`/api/attempts/${FAKE}`)).status()).toBe(404);
    expect((await ctx.put(`/api/attempts/${FAKE}/answers`, { data: { answers: [{ questionId: FAKE, response: null, flagged: false, revision: 1 }] } })).status()).toBe(404);
    expect((await ctx.post(`/api/attempts/${FAKE}/submit`)).status()).toBe(404);
    expect((await ctx.get(`/api/results/${FAKE}/pdf`)).status()).toBe(404);
    expect((await ctx.get("/api/attempts/not-a-uuid")).status()).toBe(422);
  });

  test("signed-out requests to protected APIs are 401", async () => {
    const { ctx } = await as();
    for (const path of ["/api/users", `/api/attempts/${FAKE}`, `/api/results/${FAKE}/pdf`, "/api/preferences"]) {
      expect((await ctx.get(path)).status(), path).toBe(401);
    }
    expect((await ctx.post("/api/import/candidates", { data: { format: "csv", content: "x" } })).status()).toBe(401);
  });

  test("candidates cannot use staff-only APIs; the client cannot choose sandbox mode", async () => {
    const { ctx } = await as(w.users.cand1.email);
    expect((await ctx.post("/api/import/questions", { data: { format: "json", content: "[]" } })).status()).toBe(403);
    expect((await ctx.post("/api/attempts", { data: { examId: FAKE, sandbox: true } })).status()).toBe(404);
  });

  test("public verification exposes no personal data and resists injection", async () => {
    const { ctx } = await as();
    for (const code of ["CKZ-AAAA-BBBB-CCCC", "' OR 1=1 --", "<script>alert(1)</script>"]) {
      const res = await ctx.get(`/api/verify/${encodeURIComponent(code)}`);
      expect(res.status()).toBe(404);
      expect(await res.json()).toEqual({ valid: false, status: "invalid" });
    }
  });
});

test.describe("XSS", () => {
  test("markup in user content renders as text and never executes", async ({ page }) => {
    const { ctx } = await as(w.users.examiner.email);
    const payload = `E2E ${w.run} <img src=x onerror="window.__xss=1"> <script>window.__xss=2</script>`;
    const res = await ctx.post("/api/import/questions", { data: { format: "json", content: JSON.stringify([{ type: "ESSAY", prompt: payload, marks: 1 }]) } });
    expect((await res.json()).created).toBe(1);
    await page.request.post("/api/auth/login", { data: { email: w.users.examiner.email, password: E2E_PASSWORD } });
    let dialogs = 0;
    page.on("dialog", (d) => {
      dialogs++;
      void d.dismiss();
    });
    await page.goto("/examiner/questions");
    await page.getByLabel("Search questions").fill(`E2E ${w.run} <img`);
    await expect(page.getByText(payload)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(dialogs).toBe(0);
  });
});
