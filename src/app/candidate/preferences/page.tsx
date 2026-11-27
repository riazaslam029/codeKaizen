import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/dal";
import { PreferencesService } from "@/services/preferences.service";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Workspace preferences" };

export default async function PreferencesPage() {
  const candidate = await requireRole("CANDIDATE");
  const prefs = await PreferencesService.get(candidate.id);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Workspace preferences" description="How the examination workspace looks for you. Saved to your account, so they follow you to any device. You can also change them during an exam." />
      <PreferencesForm initial={prefs} />
    </div>
  );
}
