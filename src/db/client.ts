import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Neon HTTP driver: one HTTPS round-trip per query — ideal for Vercel serverless functions. */
export function createDb(url: string | undefined = process.env.DATABASE_URL) {
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  return drizzle({ client: neon(url), schema });
}

export type DB = ReturnType<typeof createDb>;
