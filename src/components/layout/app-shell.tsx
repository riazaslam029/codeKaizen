import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserRole } from "@/db/schema/enums";
import { requireRole } from "@/lib/auth/dal";
import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { NAV, ROLE_LABEL } from "./nav-config";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

/**
 * Shared shell for the three role areas. The sidebar is static (prerendered);
 * everything that reads the session streams in behind <Suspense>, as Cache Components requires.
 */
export function AppShell({ role, children }: { role: UserRole; children: ReactNode }) {
  const nav = NAV[role];
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Brand inverted />
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
            {nav.label}
          </p>
          <SidebarNav items={nav.items} />
        </nav>
        <p className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/60">
          Sessions expire after 8 hours.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6">
          <MobileNav items={nav.items} sectionLabel={nav.label} />
          <span className="lg:hidden">
            <Brand />
          </span>
          <div className="ml-auto">
            <Suspense fallback={<Skeleton className="h-9 w-40" />}>
              <CurrentUserMenu role={role} />
            </Suspense>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

async function CurrentUserMenu({ role }: { role: UserRole }) {
  const user = await requireRole(role);
  return <UserMenu name={user.name} email={user.email} roleLabel={ROLE_LABEL[user.role]} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
