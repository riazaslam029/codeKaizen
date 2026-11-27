import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Browser tests run against a production build backed by the DEVELOPMENT branch (.env.local).
loadEnv({ path: ".env.local", quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3200);
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests",
  testMatch: process.env.AUDIT ? ["visual/**/*.spec.ts"] : ["e2e/**/*.spec.ts", "security/**/*.spec.ts", "ui/**/*.spec.ts"],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  fullyParallel: false,
  workers: 1, // one shared Neon dev branch: keep flows deterministic
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    // Uses the locally installed Google Chrome (no browser download needed).
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chrome-desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `${BASE_URL}/login`,
        reuseExistingServer: true,
        timeout: 300_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
