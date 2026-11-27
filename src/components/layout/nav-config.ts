import type { UserRole } from "@/db/schema/enums";

export type NavIcon =
  | "overview"
  | "users"
  | "roles"
  | "activity"
  | "exams"
  | "bank"
  | "candidates"
  | "monitor"
  | "grading"
  | "results"
  | "analytics"
  | "reports"
  | "enrollments"
  | "preferences";
export type NavItem = { href: string; label: string; icon: NavIcon };

/** Only routes that exist are listed — no dead links. */
export const NAV: Record<UserRole, { label: string; items: NavItem[] }> = {
  ADMIN: {
    label: "Administration",
    items: [
      { href: "/admin", label: "Overview", icon: "overview" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/roles", label: "Roles & permissions", icon: "roles" },
      { href: "/admin/activity", label: "Platform activity", icon: "activity" },
    ],
  },
  EXAMINER: {
    label: "Examiner",
    items: [
      { href: "/examiner", label: "Overview", icon: "overview" },
      { href: "/examiner/exams", label: "Examinations", icon: "exams" },
      { href: "/examiner/questions", label: "Question bank", icon: "bank" },
      { href: "/examiner/candidates", label: "Candidates", icon: "candidates" },
      { href: "/examiner/monitoring", label: "Monitoring", icon: "monitor" },
      { href: "/examiner/grading", label: "Grading", icon: "grading" },
      { href: "/examiner/results", label: "Results", icon: "results" },
      { href: "/examiner/analytics", label: "Analytics", icon: "analytics" },
      { href: "/examiner/reports", label: "Reports", icon: "reports" },
    ],
  },
  CANDIDATE: {
    label: "Candidate",
    items: [
      { href: "/candidate", label: "Dashboard", icon: "overview" },
      { href: "/candidate/exams", label: "My examinations", icon: "enrollments" },
      { href: "/candidate/results", label: "Results", icon: "results" },
      { href: "/candidate/preferences", label: "Workspace preferences", icon: "preferences" },
    ],
  },
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrator",
  EXAMINER: "Examiner",
  CANDIDATE: "Candidate",
};
