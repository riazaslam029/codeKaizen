import type { UserRole } from "@/db/schema/enums";

export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavIcon = "overview" | "users" | "exams" | "enrollments";

/** Only routes that exist are listed — no dead links. Extend as features land. */
export const NAV: Record<UserRole, { label: string; items: NavItem[] }> = {
  ADMIN: {
    label: "Administration",
    items: [
      { href: "/admin", label: "Overview", icon: "overview" },
      { href: "/admin/users", label: "Users", icon: "users" },
    ],
  },
  EXAMINER: {
    label: "Examiner",
    items: [{ href: "/examiner", label: "My exams", icon: "exams" }],
  },
  CANDIDATE: {
    label: "Candidate",
    items: [{ href: "/candidate", label: "My exams", icon: "enrollments" }],
  },
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrator",
  EXAMINER: "Examiner",
  CANDIDATE: "Candidate",
};
