import { config } from "dotenv";

// Integration tests use the DEVELOPMENT branch from .env.local and refuse to touch production.
config({ path: ".env.local", override: true, quiet: true });
const branch = process.env.NEON_BRANCH;
if (!branch || branch === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error(`Integration tests refuse to run against branch "${branch ?? "unknown"}". Point .env.local at a development branch.`);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing in .env.local");
process.env.AUTH_SECRET ??= "integration-test-secret-0123456789-abcdefghij";
