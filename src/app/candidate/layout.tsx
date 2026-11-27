import { AppShell } from "@/components/layout/app-shell";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="CANDIDATE">{children}</AppShell>;
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
