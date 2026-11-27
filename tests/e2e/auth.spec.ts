import { expect, test } from "@playwright/test";
import { world } from "./fixtures";
import { uiLogin } from "./helpers";

const w = world;

test.describe("login page", () => {
  test("client-side validation messages", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("wrong password shows a generic error and stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(w.users.cand1.email);
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("password visibility toggle and keyboard submit", async ({ page }) => {
    await page.goto("/login");
    const pw = page.getByLabel("Password", { exact: true });
    await pw.fill("secret-value");
    await expect(pw).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(pw).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await page.getByLabel("Email").fill(w.users.cand1.email);
    await pw.fill("E2e-Test-Pass-1");
    await pw.press("Enter");
    await expect(page).toHaveURL(/\/candidate$/);
  });
});

test.describe("role routing and logout", () => {
  for (const [role, area] of [["admin", "/admin"], ["examiner", "/examiner"], ["cand1", "/candidate"]] as const) {
    test(`${role} lands on ${area} and cannot open other areas`, async ({ page }) => {
      await uiLogin(page, w.users[role].email);
      await expect(page).toHaveURL(new RegExp(`${area}$`));
      for (const other of ["/admin", "/examiner", "/candidate"].filter((a) => a !== area)) {
        await page.goto(other);
        await expect(page).toHaveURL(new RegExp(`${area}$`));
      }
    });
  }

  test("signed-out users are sent to login with a return path; logout ends the session", async ({ page }) => {
    await page.goto("/examiner/exams");
    await expect(page).toHaveURL(/\/login\?next=%2Fexaminer%2Fexams/);
    await page.getByLabel("Email").fill(w.users.examiner.email);
    await page.getByLabel("Password", { exact: true }).fill("E2e-Test-Pass-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/examiner\/exams$/);
    await page.getByRole("button", { name: /Eli Examiner/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  });
});

test("unknown routes show the branded 404 page", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to your dashboard" })).toBeVisible();
});
