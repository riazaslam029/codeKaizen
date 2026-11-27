import { Suspense, type ReactNode } from "react";
import { PageReveal } from "@/components/motion/page-reveal";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRole } from "@/db/schema/enums";
import { requireRole } from "@/lib/auth/dal";
import { MobileNav } from "./mobile-nav";
import { NAV, ROLE_LABEL } from "./nav-config";
import { SessionGuard } from "./session-guard";
import { Breadcrumbs, CommandPalette, DesktopSidebar, MobileBrand, Notifications, SidebarUserCard, ThemeToggle } from "./shell-client";
import { UserMenu } from "./user-menu";

/**
 * Shared shell for the three role areas. Static chrome prerenders; everything that reads the session
 * streams in behind <Suspense>, as Cache Components requires.
 */
export function AppShell({ role, children }: { role: UserRole; children: ReactNode }) {
  const nav = NAV[role];
  return (
    <div className="flex min-h-dvh">
      <SessionGuard />
      <DesktopSidebar
        role={role}
        userCard={
          <Suspense fallback={<Skeleton className="h-9 w-full bg-sidebar-accent" />}>
            <CurrentUserCard role={role} />
          </Suspense>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/80 bg-background/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 sm:gap-3 sm:px-6">
          <MobileNav groups={nav.groups} sectionLabel={nav.label} />
          <MobileBrand />
          <Suspense fallback={null}>
            <Breadcrumbs role={role} />
          </Suspense>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <span className="font-mono-code hidden items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[10px] tracking-wider text-success uppercase xl:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
              SYS.OPERATIONAL
            </span>
            <CommandPalette role={role} />
            <ThemeToggle />
            <Notifications />
            <Suspense fallback={<Skeleton className="h-9 w-9 rounded-full sm:w-40" />}>
              <CurrentUserMenu role={role} />
            </Suspense>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageSkeleton />}>
            <PageReveal>{children}</PageReveal>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

async function CurrentUserMenu({ role }: { role: UserRole }) {
  const user = await requireRole(role);
  return <UserMenu name={user.name} email={user.email} roleLabel={ROLE_LABEL[user.role]} />;
}

async function CurrentUserCard({ role }: { role: UserRole }) {
  const user = await requireRole(role);
  return <SidebarUserCard name={user.name} roleLabel={ROLE_LABEL[user.role]} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
