/**
 * Applies pending SQL migrations from ./drizzle over the DIRECT (non-pooled) endpoint.
 * Migrations are additive and recorded in drizzle.__drizzle_migrations, so re-running is a no-op.
 *
 *   npm run db:migrate         → development branch (.env.local)
 *   npm run db:migrate:prod    → production branch (.env.neon.production, needs --confirm-production)
 */
import { loadDbEnv } from "./db-env";

const { file, branch } = loadDbEnv();

import { migrate } from "drizzle-orm/neon-http/migrator";
import { createDb } from "../src/db/client";

async function main() {
  if (branch === "production" && !process.argv.includes("--confirm-production")) {
    console.error("✗ Target is PRODUCTION. Re-run with --confirm-production (npm run db:migrate:prod).");
    process.exit(1);
  }
  console.log(`→ Migrating branch "${branch}" (env: ${file})`);
  const db = createDb(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
  const started = Date.now();
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log(`✓ Migrations applied in ${Date.now() - started} ms`);
}

main().catch((err) => {
  console.error("✗ Migration failed:", err instanceof Error ? err.message.replace(/postgres(ql)?:\/\/\S+/g, "<redacted-url>") : err);
  process.exit(1);
});
