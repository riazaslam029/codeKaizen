import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit reads .env.local (development) unless DRIZZLE_ENV_FILE points elsewhere.
config({ path: process.env.DRIZZLE_ENV_FILE ?? ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Direct (non-pooled) endpoint for drizzle-kit, per Neon guidance.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
