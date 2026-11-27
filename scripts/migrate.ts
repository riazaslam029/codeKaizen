/**
 * Applies pending SQL migrations from ./drizzle to the database in DATABASE_URL.
 * Usage: npm run db:migrate
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { migrate } from "drizzle-orm/neon-http/migrator";
import { createDb } from "../src/db/client";

async function main() {
  // Neon guidance: run migrations over the direct (non-pooled) endpoint.
  const db = createDb(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
  const started = Date.now();
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log(`✓ Migrations applied in ${Date.now() - started} ms`);
}

main().catch((err) => {
  console.error("✗ Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
