import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { homeForRole } from "@/lib/auth/token";
import { AttemptService } from "@/services/attempts/attempt.service";
import { PreferencesService } from "@/services/preferences.service";
import { ExamWorkspace } from "./workspace";

export const metadata: Metadata = { title: "Examination", robots: { index: false } };

/** Distraction-minimised, full-screen workspace (no app sidebar). */
export default function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden /> Loading your examination…
        </div>
      }
    >
      <Workspace params={params} />
    </Suspense>
  );
}

async function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // Ownership is enforced inside getState (404 for anyone else's attempt). Answer keys are never included.
  const [state, prefs] = await Promise.all([AttemptService.getState(user, id), PreferencesService.get(user.id)]);
  const back = state.attempt.isSandbox ? "/examiner/exams" : homeForRole(user.role);
  return <ExamWorkspace initial={state} initialPrefs={prefs} backHref={back} />;
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
