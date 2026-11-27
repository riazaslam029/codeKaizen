import { expect, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./fixtures";

/** Signs in through the real login form. */
export async function uiLogin(page: Page, email: string, password = E2E_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Fast sign-in via the API (shares cookies with the page's browser context). */
export async function apiLogin(page: Page, email: string, password = E2E_PASSWORD) {
  const res = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(res.status(), `login ${email}`).toBe(200);
}

/** Local value for <input type="datetime-local"> offset from now. */
export function localInput(offsetMinutes: number) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Parses the workspace timer ("Time remaining 12:34" / "1:02:03") into seconds. */
export async function timerSeconds(page: Page) {
  const label = (await page.getByRole("timer").getAttribute("aria-label")) ?? "";
  const parts = label.replace("Time remaining", "").trim().split(":").map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export async function expectNoHorizontalOverflow(page: Page, label = page.url()) {
  const r = await page.evaluate(() => {
    const inner = window.innerWidth;
    const culprit = [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > inner + 1 && getComputedStyle(e).position !== "fixed")
      .map((e) => `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).split(" ").slice(0, 4).join(".")}`)
      .slice(-1)[0];
    return { scroll: document.documentElement.scrollWidth, inner, culprit };
  });
  expect(r.scroll, `${label}: page wider than viewport (${r.culprit ?? "?"})`).toBeLessThanOrEqual(r.inner + 1);
}
