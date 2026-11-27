/**
 * Read-only health + migration status for one branch. Prints no secrets.
 *   npm run db:status         → development (.env.local)
 *   npm run db:status:prod    → production (.env.neon.production)
 */
import { readFileSync } from "node:fs";
import { hostOf, loadDbEnv } from "./db-env";

const { file, branch } = loadDbEnv();

import { neon } from "@neondatabase/serverless";

async function main() {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: { tag: string }[] };
  const pooled = neon(process.env.DATABASE_URL!);
  const direct = neon(process.env.DATABASE_URL_UNPOOLED!);
  const t0 = Date.now();
  await pooled`select 1`;
  const pooledMs = Date.now() - t0;
  const applied = await direct`select count(*)::int as n from drizzle.__drizzle_migrations`;
  const tables = await direct`select count(*)::int as n from information_schema.tables where table_schema = 'public'`;
  const users = await direct`select role, count(*)::int as n, count(*) filter (where is_active)::int as active from users group by role order by role`;
  console.log(
    JSON.stringify(
      {
        branch,
        envFile: file,
        pooledEndpoint: hostOf(process.env.DATABASE_URL),
        directEndpoint: hostOf(process.env.DATABASE_URL_UNPOOLED),
        pooledConnectivity: `ok (${pooledMs} ms)`,
        migrations: { inRepo: journal.entries.length, applied: applied[0]!.n, upToDate: applied[0]!.n === journal.entries.length },
        publicTables: tables[0]!.n,
        usersByRole: Object.fromEntries(users.map((u) => [u.role, `${u.n} (${u.active} active)`])),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(`✗ ${branch}: ${err instanceof Error ? err.message.replace(/postgres(ql)?:\/\/\S+/g, "<redacted-url>") : err}`);
  process.exit(1);
});
