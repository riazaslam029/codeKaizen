import { createE2EWorld } from "./fixtures";

export default async function globalSetup() {
  const w = await createE2EWorld();
  console.log(`[e2e] fixture world ${w.run} created on the development branch`);
}
