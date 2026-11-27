/**
 * Phase 3: the fixed 100-question datasets import through the real UI; broken files show row-level errors.
 */
import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { world } from "./fixtures";
import { apiLogin } from "./helpers";

const w = world;
test.describe.configure({ mode: "serial" });

async function openImport(page: import("@playwright/test").Page) {
  await apiLogin(page, w.users.examiner2.email);
  await page.goto("/examiner/questions");
  await page.getByRole("button", { name: "Import" }).click();
  return page.getByRole("dialog");
}

test("fixed CSV: 100 valid rows preview, then 100 imported", async ({ page }) => {
  const dlg = await openImport(page);
  await dlg.locator('input[type="file"]').setInputFiles("sample-data/web_exam_100_questions_fixed.csv");
  await expect(dlg.getByText("100 valid", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(dlg.getByText("0 with errors", { exact: true })).toBeVisible();
  await dlg.getByRole("button", { name: "Import 100 valid rows" }).click();
  await expect(page.getByText("Imported 100 questions")).toBeVisible({ timeout: 60_000 });
});

test("fixed JSON has identical data: every row is reported as already in the bank", async ({ page }) => {
  const dlg = await openImport(page);
  await dlg.locator('input[type="file"]').setInputFiles("sample-data/web_exam_100_questions_fixed.json");
  await expect(dlg.getByText("100 duplicate", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(dlg.getByText("0 valid", { exact: true })).toBeVisible();
  await expect(dlg.getByRole("button", { name: /Import 0 valid rows/ })).toBeDisabled();
});

test("a deliberately broken file shows a row / field / reason error table; valid rows can still be imported", async ({ page }, info) => {
  const path = info.outputPath("broken.csv");
  writeFileSync(
    path,
    ["type,prompt,options,correct,marks", `MCQ_SINGLE,E2E ${w.run} good row,A|B,a,1`, "single,Bad type row,A|B,a,1", `MCQ_SINGLE,E2E ${w.run} bad key,A|B,q,1`, `MCQ_MULTI,E2E ${w.run} no key,A|B|C,,1`].join("\n"),
  );
  const dlg = await openImport(page);
  await dlg.locator('input[type="file"]').setInputFiles(path);
  await expect(dlg.getByText("1 valid", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(dlg.getByText("3 with errors", { exact: true })).toBeVisible();
  const table = dlg.getByRole("table");
  await expect(table).toContainText("type");
  await expect(table).toContainText("correct");
  await expect(table.getByRole("row", { name: /^3 type/ })).toBeVisible();
  await dlg.getByRole("button", { name: "Import 1 valid row" }).click();
  await expect(page.getByText("Imported 1 questions")).toBeVisible({ timeout: 30_000 });
});
