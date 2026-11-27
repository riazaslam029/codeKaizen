"use client";

import {
  Activity,
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Library,
  MonitorDot,
  PenLine,
  Settings2,
  ShieldCheck,
  Trophy,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "./nav-config";

const ICONS: Record<NavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  users: Users,
  roles: ShieldCheck,
  activity: Activity,
  exams: BookOpenCheck,
  bank: Library,
  candidates: UserRoundCheck,
  monitor: MonitorDot,
  grading: PenLine,
  results: Trophy,
  analytics: BarChart3,
  reports: FileText,
  enrollments: ClipboardList,
  preferences: Settings2,
};

type Props = { items: NavItem[]; onNavigate?: () => void };

/**
 * The active-item highlight depends on the URL, which is request-time data; it streams in behind
 * <Suspense> so the rest of the shell can be prerendered. The fallback is the same list, un-highlighted.
 */
export function SidebarNav(props: Props) {
  return (
    <Suspense fallback={<NavList {...props} pathname={null} />}>
      <ActiveNav {...props} />
    </Suspense>
  );
}

function ActiveNav(props: Props) {
  return <NavList {...props} pathname={usePathname()} />;
}

function NavList({ items, onNavigate, pathname }: Props & { pathname: string | null }) {
  // The section root (e.g. /admin) is active only on an exact match; deeper items match by prefix.
  const isActive = (href: string) =>
    pathname !== null && (pathname === href || (href.split("/").length > 2 && pathname.startsWith(`${href}/`)));

  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
