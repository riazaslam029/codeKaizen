/**
 * Phase 1: account restriction (login message, live lock-out, restore) and Save & exit.
 */
import { expect, test } from "@playwright/test";
import * as t from "../../src/db/schema";
import { devDb, E2E_PASSWORD, world } from "./fixtures";
import { apiLogin, uiLogin } from "./helpers";

const w = world;
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const db = devDb();
  const now = Date.now();
  const [exam] = await db
    .insert(t.exams)
    .values({ code: `RST-${w.run.toUpperCase().slice(-8)}`, title: "E2E Restriction Drill", createdById: w.users.examiner.id, status: "PUBLISHED", durationMinutes: 45, startsAt: new Date(now - 5 * 60_000), endsAt: new Date(now + 3600_000) })
    .returning({ id: t.exams.id });
  await db.insert(t.examQuestions).values({ examId: exam!.id, questionId: w.questions.single.id, position: 1 });
  await db.insert(t.enrollments).values({ examId: exam!.id, candidateId: w.users.cand1.id, enrolledById: w.users.examiner.id });
});

test("Save & exit keeps the attempt open; dashboard shows Resume with server time left", async ({ page }) => {
  await apiLogin(page, w.users.cand1.email);
  await page.goto("/candidate/exams");
  const card = page.locator("[data-slot=card]", { hasText: "E2E Restriction Drill" });
  await card.getByRole("button", { name: "Start examination" }).click();
  await expect(page).toHaveURL(/\/attempt\//);
  await page.locator("article").getByText("HTTPS", { exact: true }).click();
  await page.getByRole("button", { name: /Save & exit|Save and exit/ }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toContainText("Your timer keeps running on the server");
  await dlg.getByRole("button", { name: "Save & exit" }).click();
  await expect(page).toHaveURL(/\/candidate$/);
  const resumeCard = page.locator("[data-slot=card]", { hasText: "E2E Restriction Drill" }).first();
  await expect(resumeCard).toContainText(/In progress · about \d+ min left/);
  await expect(resumeCard.getByRole("button", { name: "Resume examination" })).toBeVisible();
});

test("restricting a signed-in candidate locks them out immediately; login then shows the restriction message", async ({ browser }) => {
  const adminCtx = await browser.newContext();
  const candCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const cand = await candCtx.newPage();

  await apiLogin(cand, w.users.cand1.email);
  await cand.goto("/candidate");
  await expect(cand.getByRole("heading", { name: /Hello, Casey/ })).toBeVisible();

  await uiLogin(admin, w.users.admin.email);
  await admin.goto("/admin/users");
  await admin.getByPlaceholder("Search name or email").fill(w.users.cand1.email);
  const row = admin.getByRole("row", { name: /Casey Candidate/ });
  await row.getByRole("button", { name: /Restrict Casey Candidate/ }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Restrict access" }).click();
  await expect(admin.getByText(/Account restricted/)).toBeVisible();
  await expect(row).toContainText("Restricted");

  // The candidate's open page notices on its next request (focus triggers a session check)
  await cand.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(cand.getByRole("alertdialog")).toContainText("Your access was restricted by an administrator");
  await cand.getByRole("button", { name: "Go to sign in" }).click();
  await expect(cand).toHaveURL(/\/login\?reason=restricted/);
  await expect(cand.getByRole("alert").filter({ hasText: "restricted by an administrator" })).toBeVisible();

  // APIs refuse the old session with 403 ACCOUNT_RESTRICTED, never data
  const me = await candCtx.request.get("/api/auth/me");
  expect([401, 403]).toContain(me.status());

  // Correct password → restriction message; wrong password → generic message
  await cand.getByLabel("Email").fill(w.users.cand1.email);
  await cand.getByLabel("Password", { exact: true }).fill("wrong-password-x");
  await cand.getByRole("button", { name: "Sign in" }).click();
  await expect(cand.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
  await cand.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await cand.getByRole("button", { name: "Sign in" }).click();
  await expect(cand.getByRole("alert").filter({ hasText: "Your account has been restricted by an administrator. Contact your institution." })).toBeVisible();

  // Platform activity names the admin
  await admin.goto("/admin/activity");
  await expect(admin.getByText(/Avery Admin restricted Casey Candidate/).first()).toBeVisible();

  // Restore → the candidate can sign in and resume
  await admin.goto("/admin/users");
  await admin.getByPlaceholder("Search name or email").fill(w.users.cand1.email);
  await admin.getByRole("row", { name: /Casey Candidate/ }).getByRole("button", { name: /Restore access for Casey Candidate/ }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Restore access" }).click();
  await expect(admin.getByText("Access restored")).toBeVisible();
  await cand.getByRole("button", { name: "Sign in" }).click();
  await expect(cand).toHaveURL(/\/candidate$/);
  await expect(cand.locator("[data-slot=card]", { hasText: "E2E Restriction Drill" }).first().getByRole("button", { name: "Resume examination" })).toBeVisible();

  await adminCtx.close();
  await candCtx.close();
});

test("the admin cannot restrict themselves (no control is offered)", async ({ page }) => {
  await uiLogin(page, w.users.admin.email);
  await page.goto("/admin/users");
  await page.getByPlaceholder("Search name or email").fill(w.users.admin.email);
  await expect(page.getByRole("row", { name: /Avery Admin/ }).getByRole("button", { name: /Restrict/ })).toHaveCount(0);
});
