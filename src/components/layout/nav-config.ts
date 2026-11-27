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
export type NavItem = { href: string; label: string; icon: NavIcon; keywords?: string };
export type NavGroup = { label: string; items: NavItem[] };

/** Only routes that exist are listed — no dead links. Grouped by task. */
export const NAV: Record<UserRole, { label: string; groups: NavGroup[] }> = {
  ADMIN: {
    label: "Administration",
    groups: [
      { label: "Overview", items: [{ href: "/admin", label: "Overview", icon: "overview", keywords: "dashboard home" }] },
      {
        label: "People & access",
        items: [
          { href: "/admin/users", label: "Users", icon: "users", keywords: "accounts restrict create" },
          { href: "/admin/roles", label: "Roles & permissions", icon: "roles", keywords: "rbac access" },
        ],
      },
      { label: "Oversight", items: [{ href: "/admin/activity", label: "Platform activity", icon: "activity", keywords: "audit log" }] },
    ],
  },
  EXAMINER: {
    label: "Examiner",
    groups: [
      { label: "Overview", items: [{ href: "/examiner", label: "Overview", icon: "overview", keywords: "dashboard home" }] },
      {
        label: "Authoring",
        items: [
          { href: "/examiner/exams", label: "Examinations", icon: "exams", keywords: "create publish schedule" },
          { href: "/examiner/questions", label: "Question bank", icon: "bank", keywords: "import csv json" },
          { href: "/examiner/candidates", label: "Candidates", icon: "candidates", keywords: "enrol import" },
        ],
      },
      {
        label: "Delivery",
        items: [
          { href: "/examiner/monitoring", label: "Monitoring", icon: "monitor", keywords: "live incidents announcements" },
          { href: "/examiner/grading", label: "Grading", icon: "grading", keywords: "mark essays" },
        ],
      },
      {
        label: "Insights",
        items: [
          { href: "/examiner/results", label: "Results", icon: "results", keywords: "publish scores" },
          { href: "/examiner/analytics", label: "Analytics", icon: "analytics", keywords: "questions difficulty" },
          { href: "/examiner/reports", label: "Reports", icon: "reports", keywords: "pdf verification" },
        ],
      },
    ],
  },
  CANDIDATE: {
    label: "Candidate",
    groups: [
      { label: "Overview", items: [{ href: "/candidate", label: "Dashboard", icon: "overview", keywords: "home" }] },
      {
        label: "Examinations",
        items: [
          { href: "/candidate/exams", label: "My examinations", icon: "enrollments", keywords: "start resume" },
          { href: "/candidate/results", label: "Results", icon: "results", keywords: "scores pdf" },
        ],
      },
      { label: "Settings", items: [{ href: "/candidate/preferences", label: "Workspace preferences", icon: "preferences", keywords: "font theme layout" }] },
    ],
  },
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrator",
  EXAMINER: "Examiner",
  CANDIDATE: "Candidate",
};

export const allItems = (role: UserRole) => NAV[role].groups.flatMap((g) => g.items);
