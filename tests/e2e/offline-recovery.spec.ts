/**
 * Failure-resilience in a real browser: network loss, failed syncs, refresh with unsynced answers.
 * Uses Playwright's network emulation (navigator.onLine=false, requests fail) and request interception.
 */
import { and, eq } from "drizzle-orm";
import { expect, test } from "@playwright/test";
import * as t from "../../src/db/schema";
import { devDb, world } from "./fixtures";
import { apiLogin, timerSeconds } from "./helpers";

const w = world;
let attemptId = "";

test.beforeAll(async () => {
  const db = devDb();
  const now = Date.now();
  const [exam] = await db
    .insert(t.exams)
    .values({ code: `OFF-${w.run.toUpperCase().slice(-8)}`, title: "E2E Offline Drill", createdById: w.users.examiner.id, status: "PUBLISHED", durationMinutes: 30, startsAt: new Date(now - 5 * 60_000), endsAt: new Date(now + 3600_000) })
    .returning({ id: t.exams.id });
  await db.insert(t.examQuestions).values([
    { examId: exam!.id, questionId: w.questions.essay.id, position: 1 },
    { examId: exam!.id, questionId: w.questions.single.id, position: 2 },
  ]);
  await db.insert(t.enrollments).values({ examId: exam!.id, candidateId: w.users.cand2.id, enrolledById: w.users.examiner.id });
});

const essayText = async (id: string) => {
  const db = devDb();
  const [row] = await db.select().from(t.answers).where(and(eq(t.answers.attemptId, id), eq(t.answers.questionId, w.questions.essay.id)));
  return row?.response && "text" in row.response ? row.response.text : null;
};

test("offline: keep answering, see pending sync, reconnect → saved and recorded", async ({ page, context }) => {
  await apiLogin(page, w.users.cand2.email);
  await page.goto("/candidate/exams");
  await page.getByRole("button", { name: "Start examination" }).first().click();
  await expect(page).toHaveURL(/\/attempt\//);
  attemptId = page.url().split("/attempt/")[1]!;

  const box = page.getByLabel("Your answer");
  await box.fill("Online part.");
  await expect(page.getByText(/All answers saved/)).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await expect(page.getByText("You are offline.", { exact: false })).toBeVisible();
  await box.fill("Online part. Written while offline.");
  await expect(page.getByRole("status").filter({ hasText: /Offline · 1 answer\(s\) waiting to sync/ })).toBeVisible();
  const outbox = await page.evaluate((id) => localStorage.getItem(`ckz:pending:${id}`), attemptId);
  expect(outbox, "unsynced answer kept on this device").toContain("Written while offline");
  expect(await essayText(attemptId)).toBe("Online part.");
  // Submitting is blocked while offline
  await page.getByRole("button", { name: "Review & submit" }).first().click();
  await expect(page.getByRole("button", { name: "Reconnect to submit" })).toBeDisabled();
  await page.keyboard.press("Escape");

  await context.setOffline(false);
  await expect(page.getByText(/All answers saved/)).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => essayText(attemptId), { timeout: 15_000 }).toBe("Online part. Written while offline.");
  // Indicators recorded for the examiner after reconnecting
  await expect
    .poll(async () => (await devDb().select().from(t.incidents).where(eq(t.incidents.attemptId, attemptId))).map((i) => i.type).sort().join(","), { timeout: 15_000 })
    .toContain("NETWORK_LOSS");
});

test("failed syncs survive a refresh: outbox is recovered and replayed, deadline unchanged", async ({ page }) => {
  await apiLogin(page, w.users.cand2.email);
  await page.goto(`/attempt/${attemptId}`);
  const before = await timerSeconds(page);

  // Server unreachable for answer saves (e.g. flaky Wi-Fi while navigator still says online)
  await page.route("**/api/attempts/*/answers", (r) => r.abort("failed"));
  await page.getByLabel("Your answer").fill("Edited during an outage, then the page was refreshed.");
  await expect(page.getByRole("status").filter({ hasText: /Sync failed · 1 pending · retrying/ })).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByText(/Recovered 1 answer/)).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveValue("Edited during an outage, then the page was refreshed.");
  const after = await timerSeconds(page);
  expect(after).toBeLessThanOrEqual(before);

  await page.unroute("**/api/attempts/*/answers");
  await page.getByRole("button", { name: /Retry now/ }).click().catch(() => undefined);
  await expect.poll(() => essayText(attemptId), { timeout: 30_000 }).toBe("Edited during an outage, then the page was refreshed.");
  await expect(page.getByText(/All answers saved/)).toBeVisible({ timeout: 20_000 });

  const resumed = await devDb().select().from(t.incidents).where(and(eq(t.incidents.attemptId, attemptId), eq(t.incidents.type, "ATTEMPT_RESUMED")));
  expect(resumed.length).toBeGreaterThanOrEqual(1);
});
