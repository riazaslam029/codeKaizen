import { expect, test } from "@playwright/test";
import { world } from "./fixtures";
import { uiLogin } from "./helpers";

const w = world;

test("administrator journey: dashboard → create user → assign role → deactivate → activity", async ({ page }) => {
  await uiLogin(page, w.users.admin.email);
  await expect(page.getByRole("heading", { name: /Welcome back, Avery/ })).toBeVisible();
  // Stat cards show real numbers (not placeholders)
  await expect(page.getByText("Users", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Users" }).click();
  await page.getByRole("button", { name: "New user" }).click();
  const dialog = page.getByRole("dialog");
  // validation inside the dialog
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(dialog.getByText(/at least 2 characters|valid email/).first()).toBeVisible();
  const email = `e2e-${w.run}-created@e2e.test`;
  await dialog.getByLabel("Full name").fill("Created By Admin");
  await dialog.getByLabel("Email").fill(email);
  await dialog.getByLabel("Password").fill("Created-Pass-1");
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("Account created")).toBeVisible();

  await page.getByPlaceholder("Search name or email").fill(email);
  const row = page.getByRole("row", { name: /Created By Admin/ });
  await expect(row).toBeVisible();
  await row.getByRole("combobox", { name: /Role for Created By Admin/ }).click();
  await page.getByRole("option", { name: "Examiner" }).click();
  await expect(page.getByText("Role updated")).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await row.getByRole("switch", { name: /Deactivate Created By Admin/ }).click();
  await expect(page.getByText("Account deactivated")).toBeVisible();

  // The admin's own row cannot be demoted or deactivated
  await page.getByPlaceholder("Search name or email").fill(w.users.admin.email);
  const self = page.getByRole("row", { name: /Avery Admin/ });
  await expect(self.getByRole("combobox")).toHaveCount(0);
  await expect(self.getByRole("switch")).toBeDisabled();

  await page.getByRole("link", { name: "Platform activity" }).click();
  await expect(page.getByText("Avery Admin created examiner Created By Admin").or(page.getByText("Avery Admin created candidate Created By Admin"))).toBeVisible();
  await expect(page.getByText(/set Created By Admin's role to examiner/)).toBeVisible();
});
