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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NavGroup, NavIcon } from "./nav-config";

export const ICONS: Record<NavIcon, LucideIcon> = {
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

type Props = { groups: NavGroup[]; onNavigate?: () => void; collapsed?: boolean };

/**
 * The active-item highlight depends on the URL (request-time data); it streams in behind <Suspense>
 * so the rest of the shell can be prerendered. The fallback is the same list, un-highlighted.
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

export function isActiveHref(pathname: string | null, href: string) {
  // A section root (e.g. /admin) is active only on an exact match; deeper items match by prefix.
  return pathname !== null && (pathname === href || (href.split("/").length > 2 && pathname.startsWith(`${href}/`)));
}

function NavList({ groups, onNavigate, pathname, collapsed }: Props & { pathname: string | null }) {
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p
            className={cn(
              "px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/90",
              collapsed && "sr-only",
            )}
          >
            {g.label}
          </p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActiveHref(pathname, item.href);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary transition-opacity", active ? "opacity-100" : "opacity-0")}
                  />
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {!collapsed && item.label}
                </Link>
              );
              return (
                <li key={item.href}>
                  {collapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
