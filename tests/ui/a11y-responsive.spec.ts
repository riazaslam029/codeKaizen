import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { world } from "../e2e/fixtures";
import { apiLogin, expectNoHorizontalOverflow } from "../e2e/helpers";

const w = world;

const PAGES: { role: "admin" | "examiner" | "cand1" | null; path: string; name: string }[] = [
  { role: null, path: "/login", name: "login" },
  { role: null, path: "/verify", name: "verify" },
  { role: "admin", path: "/admin", name: "admin overview" },
  { role: "admin", path: "/admin/users", name: "admin users" },
  { role: "admin", path: "/admin/roles", name: "admin roles" },
  { role: "examiner", path: "/examiner", name: "examiner overview" },
  { role: "examiner", path: "/examiner/exams", name: "examiner exams" },
  { role: "examiner", path: "/examiner/exams/new", name: "new exam form" },
  { role: "examiner", path: "/examiner/questions", name: "question bank" },
  { role: "examiner", path: "/examiner/candidates", name: "candidates" },
  { role: "examiner", path: "/examiner/grading", name: "grading" },
  { role: "cand1", path: "/candidate", name: "candidate dashboard" },
  { role: "cand1", path: "/candidate/exams", name: "candidate exams" },
  { role: "cand1", path: "/candidate/results", name: "candidate results" },
  { role: "cand1", path: "/candidate/preferences", name: "preferences" },
];

async function open(page: Page, role: (typeof PAGES)[number]["role"], path: string) {
  if (role) await apiLogin(page, w.users[role].email);
  const res = await page.goto(path);
  expect(res?.status(), `${path} status`).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility, ${scheme} theme (axe: no serious or critical violations)`, () => {
    for (const p of PAGES) {
      test(p.name, async ({ page }) => {
        const errors: string[] = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        // Reduced motion: the app disables entrance animations, so axe never samples a half-faded element.
        // The app defaults to the "system" theme, so emulating the colour scheme exercises both palettes.
        await page.emulateMedia({ reducedMotion: "reduce", colorScheme: scheme });
        await open(page, p.role, p.path);
        expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(scheme === "dark");
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(bad.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
        expect(errors, "browser console errors").toEqual([]);
      });
    }
  });
}

test.describe("responsive layout: no horizontal overflow", () => {
  for (const vp of [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "laptop", width: 1366, height: 768 },
  ]) {
    test(vp.name, async ({ page }) => {
      await page.setViewportSize(vp);
      let current: string | null = "none";
      for (const p of PAGES) {
        if (p.role !== current) {
          await page.context().clearCookies();
          current = p.role;
        }
        await open(page, p.role, p.path);
        await expectNoHorizontalOverflow(page, `${vp.name} ${p.path}`);
      }
    });
  }

  test("mobile shows the navigation drawer, desktop the sidebar", async ({ page }) => {
    await apiLogin(page, w.users.examiner.email);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/examiner");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Question bank" })).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/examiner");
    await expect(page.getByRole("button", { name: "Open navigation" })).toBeHidden();
  });
});

test.describe("keyboard", () => {
  test("login form is fully operable by keyboard with visible focus", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    // The skip link is the first focusable element on the page and becomes visible on focus.
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await skip.focus();
    await expect(skip).toBeInViewport();
    // Tab from the skip link reaches the sign-in form (the email field may also be autofocused).
    let focused: string | null = null;
    for (let i = 0; i < 6 && !["email", "password"].includes(focused ?? ""); i++) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => document.activeElement?.getAttribute("id") ?? document.activeElement?.tagName ?? null);
    }
    expect(["email", "password"]).toContain(focused);
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" || s.boxShadow !== "none";
    });
    expect(outline, "focused control must show a focus indicator").toBe(true);
  });
});
