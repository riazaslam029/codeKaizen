import { AppShell } from "@/components/layout/app-shell";

export default function ExaminerLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="EXAMINER">{children}</AppShell>;
}
