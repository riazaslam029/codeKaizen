import { AppShell } from "@/components/layout/app-shell";

export default function ExaminerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="EXAMINER">{children}</AppShell>;
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
