import { existsSync, unlinkSync } from "node:fs";
import { destroyE2EWorld, loadWorld, WORLD_FILE } from "./fixtures";

export default async function globalTeardown() {
  if (!existsSync(WORLD_FILE)) return;
  if (process.env.E2E_KEEP_DATA) return; // debugging aid
  await destroyE2EWorld(loadWorld());
  unlinkSync(WORLD_FILE);
  console.log("[e2e] fixture world removed");
}
