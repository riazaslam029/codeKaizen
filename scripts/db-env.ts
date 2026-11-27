/**
 * Shared env loading for DB scripts. Picks the env file from `--env <file>` (default .env.local)
 * and never prints connection strings.
 *
 *   .env.local              → development branch (used by `next dev`, seed, tests)
 *   .env.neon.production    → production branch (only used explicitly, e.g. db:migrate:prod)
 */
import { config } from "dotenv";

export function loadDbEnv(): { file: string; branch: string } {
  const i = process.argv.indexOf("--env");
  const file = i > -1 ? process.argv[i + 1]! : ".env.local";
  // override: true so the chosen file wins over anything already in the environment.
  const r = config({ path: file, override: true, quiet: true });
  if (r.error) {
    console.error(`✗ Cannot read ${file}. Pull it with: neon env pull --branch <name> -s postgres --file ${file}`);
    process.exit(1);
  }
  const branch = process.env.NEON_BRANCH ?? "unknown";
  return { file, branch };
}

/** Hard stop for anything that writes demo/test data: development branches only. */
export function assertNotProduction(task: string) {
  const branch = process.env.NEON_BRANCH;
  if (!branch || branch === "production" || process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    console.error(`✗ Refusing to ${task}: target branch is "${branch ?? "unknown"}". This only runs against a development branch.`);
    process.exit(1);
  }
}

export function hostOf(url: string | undefined) {
  try {
    return url ? new URL(url).hostname.split(".")[0] : "missing";
  } catch {
    return "invalid";
  }
}
