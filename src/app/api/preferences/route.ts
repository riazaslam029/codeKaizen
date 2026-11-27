import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth/dal";
import { readJson, route } from "@/lib/http";
import { preferencesSchema } from "@/lib/validations/attempt";
import { PreferencesService } from "@/services/preferences.service";

export const GET = route(async () => {
  const actor = await authorize();
  return NextResponse.json({ preferences: await PreferencesService.get(actor.id) });
});

export const PUT = route(async (req) => {
  const actor = await authorize();
  const prefs = preferencesSchema.parse(await readJson(req));
  return NextResponse.json({ preferences: await PreferencesService.set(actor.id, prefs) });
});
