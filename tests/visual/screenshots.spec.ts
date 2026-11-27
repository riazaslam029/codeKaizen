/**
 * UI audit capture (not an assertion suite): full-page screenshots of every main page for all three roles at
 * 1440 / 768 / 375 px, in light and dark. Output: ui-audit/<theme>/<width>/<role>-<page>.png (git-ignored).
 *   npx playwright test tests/visual --project=chrome-desktop
 */
import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { world } from "../e2e/fixtures";
import { apiLogin } from "../e2e/helpers";

const w = world;
const PAGES: Record<"anon" | "admin" | "examiner" | "cand1", string[]> = {
  anon: ["/login", "/verify", "/does-not-exist"],
  admin: ["/admin", "/admin/users", "/admin/roles", "/admin/activity"],
  examiner: ["/examiner", "/examiner/exams", "/examiner/exams/new", "/examiner/questions", "/examiner/candidates", "/examiner/monitoring", "/examiner/grading", "/examiner/results", "/examiner/analytics", "/examiner/reports"],
  cand1: ["/candidate", "/candidate/exams", "/candidate/results", "/candidate/preferences"],
};
const WIDTHS = (process.env.AUDIT_WIDTHS ?? "1440,768,375").split(",").map(Number);
const THEMES = (process.env.AUDIT_THEMES ?? "light").split(",") as ("light" | "dark")[];

test.describe.configure({ mode: "serial" });
test.setTimeout(600_000);

for (const theme of THEMES) {
  test(`capture ${theme}`, async ({ browser }) => {
    for (const [role, paths] of Object.entries(PAGES)) {
      const ctx = await browser.newContext({ colorScheme: theme, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      if (role !== "anon") await apiLogin(page, w.users[role as "admin"].email);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: width < 500 ? 812 : 900 });
        for (const p of paths) {
          await page.goto(p);
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(400);
          const dir = `ui-audit/${theme}/${width}`;
          mkdirSync(dir, { recursive: true });
          await page.screenshot({ path: `${dir}/${role}${p.replace(/\//g, "_")}.png`, fullPage: true });
        }
      }
      await ctx.close();
    }
  });
}
