import { expect, test, type Page } from "@playwright/test";
import { world } from "./fixtures";
import { apiLogin, localInput, timerSeconds, uiLogin } from "./helpers";

const w = world;
const code = () => `E2E-${w.run.toUpperCase().slice(-8)}`;
let examUrl = "";

test.describe.configure({ mode: "serial" });

test("examiner creates, composes, enrols and publishes an examination", async ({ page }) => {
  await uiLogin(page, w.users.examiner.email);
  await page.getByRole("link", { name: "Examinations" }).click();
  await page.getByRole("link", { name: "New examination" }).first().click();

  await page.getByLabel("Title").fill("E2E Web Fundamentals");
  await page.getByLabel("Code").fill(code());
  await page.getByLabel("Instructions").fill("Answer every question.");
  await page.getByLabel("Opens").fill(localInput(-5));
  await page.getByLabel("Closes").fill(localInput(120));
  await page.getByLabel("Duration (minutes)").fill("30");
  await page.getByRole("button", { name: "Create examination" }).click();
  await expect(page).toHaveURL(/\/examiner\/exams\/[0-9a-f-]{36}$/);
  examUrl = page.url();
  await expect(page.getByText(code())).toBeVisible();

  // Add three question types from the bank
  await page.getByRole("button", { name: "Add from bank" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Search the bank").fill(`E2E ${w.run}`);
  for (const q of Object.values(w.questions)) await dlg.getByText(q.prompt).click();
  await dlg.getByRole("button", { name: /Add 3 selected/ }).click();
  await expect(page.getByText("3 question(s) added")).toBeVisible();
  await expect(page.getByText(/3 questions · 16 total marks/)).toBeVisible();

  // Enrol a candidate
  await page.getByRole("tab", { name: /Candidates/ }).click();
  await page.getByRole("button", { name: "Enrol candidates" }).click();
  await page.getByRole("dialog").getByLabel("Search candidates").fill("Casey Candidate");
  await page.getByRole("dialog").getByText("Casey Candidate").click();
  await page.getByRole("dialog").getByRole("button", { name: /Enrol 1/ }).click();
  await expect(page.getByText("1 candidate(s) enrolled")).toBeVisible();

  // Paper preview shows the answer key to the examiner
  await page.getByRole("link", { name: "Preview paper" }).click();
  await expect(page.getByText("examiner copy with answer key")).toBeVisible();
  await expect(page.getByText("Correct").first()).toBeVisible();
  await page.goBack();

  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Examination published")).toBeVisible();
  await expect(page.getByText("Ongoing").first()).toBeVisible();
});

async function goToQuestion(page: Page, text: string) {
  for (let i = 1; i <= 3; i++) {
    await page.getByRole("button", { name: new RegExp(`^Question ${i}:`) }).click();
    if (await page.locator("#q-prompt").getByText(text, { exact: false }).isVisible()) return;
  }
  throw new Error(`question not found: ${text}`);
}

test("candidate sits the exam: answers, review flag, refresh recovery, submit", async ({ page }) => {
  await uiLogin(page, w.users.cand1.email);
  await expect(page.getByText("E2E Web Fundamentals")).toBeVisible();
  await page.getByRole("link", { name: "E2E Web Fundamentals" }).first().click();
  await expect(page.getByText("You are enrolled")).toBeVisible();
  await expect(page.getByText("The examination window is open")).toBeVisible();
  await page.getByRole("button", { name: "Start examination" }).click();
  await expect(page).toHaveURL(/\/attempt\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("timer")).toBeVisible();

  await goToQuestion(page, "Which protocol");
  const q = page.locator("article");
  await q.getByText("HTTPS", { exact: true }).click();
  await page.getByRole("button", { name: "Mark for review" }).click();
  await goToQuestion(page, "prime numbers");
  await q.getByText("2", { exact: true }).click();
  await q.getByText("5", { exact: true }).click();
  await goToQuestion(page, "autosave matters");
  await page.getByLabel("Your answer").fill("Autosave protects work against crashes and outages.");
  await expect(page.getByRole("status").filter({ hasText: "All answers saved" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("navigation", { name: "Questions" }).first().getByText("3 / 3 answered")).toBeVisible();

  const before = await timerSeconds(page);
  expect(before).toBeLessThanOrEqual(30 * 60);
  await page.waitForTimeout(2_000);
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  const after = await timerSeconds(page);
  expect(after, "refresh must not reset the timer").toBeLessThan(before);
  expect(before - after).toBeLessThan(60);

  // Answers and the review flag survived the refresh
  await goToQuestion(page, "Which protocol");
  await expect(page.getByRole("radio", { name: /HTTPS/ }).or(page.locator("label:has-text('HTTPS') [role=radio]"))).toHaveAttribute("data-state", "checked");
  await expect(page.getByRole("button", { name: "Marked for review", exact: true })).toBeVisible();
  await goToQuestion(page, "autosave matters");
  await expect(page.getByLabel("Your answer")).toHaveValue(/Autosave protects work/);

  await page.getByRole("button", { name: "Review & submit" }).first().click();
  const review = page.getByRole("dialog");
  await expect(review.getByText(/3 of 3 answered · 0 unanswered · 1 marked for review/)).toBeVisible();
  await review.getByRole("button", { name: "Submit final answers" }).click();
  await expect(page.getByRole("heading", { name: "Attempt submitted" })).toBeVisible();
  await expect(page.getByText("3 of 3 questions answered")).toBeVisible();
});

test("examiner monitors, grades the written answer and publishes", async ({ page }) => {
  await uiLogin(page, w.users.examiner.email);
  await page.goto(examUrl.replace("/exams/", "/monitoring/"));
  const row = page.getByRole("row", { name: /Casey Candidate/ });
  await expect(row).toContainText("Submitted");
  await expect(row).toContainText("3/3");

  await page.getByRole("link", { name: "Grading" }).click();
  await page.getByRole("row", { name: /Casey Candidate/ }).getByRole("link", { name: "Grade" }).click();
  await expect(page.getByText("1 written answer(s) need a mark")).toBeVisible();
  const essay = page.locator("li", { hasText: "autosave matters" });
  await essay.getByLabel(/Marks \(max 10\)/).fill("11");
  await essay.getByRole("button", { name: "Save grade" }).click();
  await expect(essay.getByText("Enter a mark between 0 and 10")).toBeVisible();
  await essay.getByLabel(/Marks \(max 10\)/).fill("8");
  await essay.getByLabel(/Feedback to candidate/).fill("Clear explanation.");
  await essay.getByRole("button", { name: "Save grade" }).click();
  await expect(page.getByText(/attempt fully graded/)).toBeVisible();
  // single 2 + multi 4 + essay 8 = 14 / 16
  await expect(page.getByText("14 / 16")).toBeVisible();

  // Before publication the candidate sees a friendly waiting state, never an error
  const candCtx = await page.context().browser()!.newContext();
  const cand = await candCtx.newPage();
  await apiLogin(cand, w.users.cand1.email);
  await cand.goto("/candidate/results");
  await expect(cand.getByText(/Results not published yet/)).toBeVisible();
  await candCtx.close();

  await page.goto(examUrl.replace("/exams/", "/results/"));
  await expect(page.getByLabel("Pre-publish checklist")).toContainText("All written answers are graded");
  await expect(page.getByRole("row", { name: /Casey Candidate/ })).toContainText("Unpublished");
  await page.getByRole("button", { name: /Publish results \(1\)/ }).click();
  await expect(page.getByRole("alertdialog")).toContainText("1 candidate(s) will see their score");
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish results" }).click();
  await expect(page.getByText(/Published 1 result/)).toBeVisible();
  await expect(page.getByRole("row", { name: /Casey Candidate/ })).toContainText("Published");
  await expect(page.getByRole("row", { name: /Casey Candidate/ })).toContainText("Eli Examiner");

  // Exam-level PDF (examiner only)
  const report = await page.request.get(examUrl.replace("/examiner/exams/", "/api/exams/") + "/report");
  expect(report.status()).toBe(200);
  expect(report.headers()["content-type"]).toBe("application/pdf");

  // Analytics load with real data
  await page.goto(examUrl.replace("/exams/", "/analytics/"));
  await expect(page.getByText(/Based on 1 submitted attempt/)).toBeVisible();
  await expect(page.getByText("Assigned difficulty vs observed accuracy")).toBeVisible();
  await expect(page.getByText("Most common wrong answers")).toBeVisible();
});

test("candidate sees the published result, PDF with QR, and verification (valid → revoked)", async ({ page, browser }) => {
  await apiLogin(page, w.users.cand1.email);
  await page.goto("/candidate/results");
  await page.getByRole("link", { name: "E2E Web Fundamentals", exact: true }).click();
  await expect(page.getByText("87.5%")).toBeVisible();
  await expect(page.getByText("Performance by topic")).toBeVisible();
  await expect(page.getByText("Question by question")).toBeVisible();
  await expect(page.getByText("Clear explanation.")).toBeVisible();
  await expect(page.getByText(/Time spent:/)).toBeVisible();
  const code = (await page.locator("span.font-mono", { hasText: /^CKZ-/ }).first().textContent())!.trim();

  const pdf = await page.request.get((await page.getByRole("link", { name: /Download PDF report/ }).getAttribute("href")) as string);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.toString("latin1")).toMatch(/\/Subtype\s*\/Image/); // embedded QR code image

  // Candidates cannot download the exam-level report
  const examId = examUrl.split("/").pop();
  expect((await page.request.get(`/api/exams/${examId}/report`)).status()).toBe(403);

  await page.goto(`/verify/${code}`);
  await expect(page.getByRole("heading", { name: "Valid" })).toBeVisible();
  await expect(page.getByText("E2E Web Fundamentals")).toBeVisible();
  await expect(page.getByText("Casey")).toHaveCount(0);
  await expect(page.getByText("87.5")).toHaveCount(0);

  // Examiner withdraws → code reports Revoked, candidate sees the waiting state again
  const exCtx = await browser.newContext();
  const ex = await exCtx.newPage();
  await apiLogin(ex, w.users.examiner.email);
  await ex.goto(examUrl.replace("/exams/", "/results/"));
  await ex.getByRole("button", { name: /Unpublish/ }).click();
  await ex.getByRole("alertdialog").getByRole("button", { name: "Withdraw results" }).click();
  await expect(ex.getByText(/Withdrew 1 result/)).toBeVisible();
  await exCtx.close();
  await page.goto(`/verify/${code}`);
  await expect(page.getByRole("heading", { name: "Revoked" })).toBeVisible();
  await page.goto("/verify/CKZ-AAAA-BBBB-CCCC");
  await expect(page.getByRole("heading", { name: "Invalid" })).toBeVisible();
});
