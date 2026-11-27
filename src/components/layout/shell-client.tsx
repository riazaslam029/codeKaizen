"use client";

import { Bell, ChevronRight, LogOut, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Fragment, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserRole } from "@/db/schema/enums";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { allItems, NAV } from "./nav-config";
import { ICONS, isActiveHref, SidebarNav } from "./sidebar-nav";

/* ───────────── persisted sidebar collapse ───────────── */
const KEY = "ckz-sidebar-collapsed";
const subscribe = (cb: () => void) => {
  window.addEventListener("ckz-sidebar", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("ckz-sidebar", cb);
    window.removeEventListener("storage", cb);
  };
};
export function useCollapsed(): [boolean, (v: boolean) => void] {
  const v = useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) === "1", () => false);
  const set = useCallback((next: boolean) => {
    localStorage.setItem(KEY, next ? "1" : "0");
    window.dispatchEvent(new Event("ckz-sidebar"));
  }, []);
  return [v, set];
}

export function DesktopSidebar({ role, userCard }: { role: UserRole; userCard: ReactNode }) {
  const [collapsed, setCollapsed] = useCollapsed();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[4.25rem]" : "w-64",
      )}
      aria-label="Sidebar"
    >
      <div className={cn("flex h-16 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "justify-between px-5")}>
        {!collapsed && <Brand inverted />}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="rounded-md p-1.5 text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-sidebar-ring"
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
        </Tooltip>
      </div>
      <nav aria-label="Main" className={cn("flex-1 overflow-y-auto py-5", collapsed ? "px-2" : "px-3")}>
        <SidebarNav groups={NAV[role].groups} collapsed={collapsed} />
      </nav>
      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")} data-collapsed={collapsed}>
        {userCard}
      </div>
    </aside>
  );
}

/* ───────────── sign out (shared) ───────────── */
export async function signOut(router: ReturnType<typeof useRouter>) {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  if (!res.ok) return void toast.error("Could not sign out. Please try again.");
  router.replace("/login");
  router.refresh();
}

export function SidebarUserCard({ name, roleLabel }: { name: string; roleLabel: string }) {
  const router = useRouter();
  const [collapsed] = useCollapsed();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return (
    <div className={cn("flex items-center gap-2.5", collapsed && "flex-col")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground" aria-hidden>
        {initials}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">{name}</span>
          <span className="block truncate text-xs text-sidebar-foreground/90">{roleLabel}</span>
        </span>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void signOut(router)}
            aria-label="Sign out"
            className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Sign out</TooltipContent>
      </Tooltip>
    </div>
  );
}

/* ───────────── breadcrumbs ───────────── */
export function Breadcrumbs({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = allItems(role);
  const root = items[0]!;
  const section = [...items].reverse().find((i) => isActiveHref(pathname, i.href) && i.href !== root.href);
  const crumbs: { label: string; href?: string }[] = [{ label: NAV[role].label, href: root.href }];
  if (section) crumbs.push({ label: section.label, href: pathname === section.href ? undefined : section.href });
  if (section && pathname !== section.href) {
    const rest = pathname.slice(section.href.length).split("/").filter(Boolean);
    const last = rest[rest.length - 1] ?? "";
    crumbs.push({ label: last === "new" ? "New" : last === "preview" ? "Preview" : "Details" });
  }
  if (!section && pathname !== root.href) crumbs.push({ label: "Details" });
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            <li className="truncate">
              {c.href && i < crumbs.length - 1 ? (
                <Link href={c.href} className="hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={i === crumbs.length - 1 ? "page" : undefined} className={i === crumbs.length - 1 ? "font-medium text-foreground" : undefined}>
                  {c.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/* ───────────── theme toggle ───────────── */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const current = mounted ? (theme ?? "system") : "system";
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Theme: ${current}`}>
          <Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {(
          [
            ["light", "Light", Sun],
            ["dark", "Dark", Moon],
            ["system", "System", Monitor],
          ] as const
        ).map(([v, l, I]) => (
          <DropdownMenuItem key={v} onSelect={() => setTheme(v)} aria-checked={current === v} role="menuitemradio">
            <I className="size-4" aria-hidden /> {l} {current === v && <span className="ml-auto text-xs text-muted-foreground">Active</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ───────────── notifications ───────────── */
type Note = { id: string; title: string; body: string; at: string; href: string };
export function Notifications() {
  const [items, setItems] = useState<Note[] | null>(null);
  const [seen, setSeen] = useState<string>("");
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) setItems((await r.json()).items);
    } catch {
      /* offline: keep the last list */
    }
  }, []);
  useEffect(() => {
    const kick = setTimeout(() => {
      setSeen(localStorage.getItem("ckz-notes-seen") ?? "");
      void load();
    }, 0);
    const t = setInterval(load, 60_000);
    return () => {
      clearTimeout(kick);
      clearInterval(t);
    };
  }, [load]);
  const unread = (items ?? []).filter((n) => n.at > seen).length;
  return (
    <Popover
      onOpenChange={(o) => {
        if (o && items?.[0]) {
          localStorage.setItem("ckz-notes-seen", items[0].at);
          setSeen(items[0].at);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? ` (${unread} new)` : ""}`} className="relative">
          <Bell className="size-4" />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" aria-hidden />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <p className="border-b px-4 py-2.5 text-sm font-semibold">Notifications</p>
        {items === null ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">You are all caught up.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.href} className="block px-4 py-2.5 hover:bg-muted/60">
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{n.body}</span>
                  <span className="block text-[11px] text-muted-foreground" suppressHydrationWarning>
                    {new Date(n.at).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ───────────── command palette (Ctrl/⌘ + K) ───────────── */
export function CommandPalette({ role }: { role: UserRole }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo(
    () => [
      ...allItems(role).map((i) => ({ id: i.href, label: i.label, hint: "Go to", icon: ICONS[i.icon], keywords: i.keywords ?? "", run: () => router.push(i.href) })),
      { id: "theme-light", label: "Light theme", hint: "Theme", icon: Sun, keywords: "appearance", run: () => setTheme("light") },
      { id: "theme-dark", label: "Dark theme", hint: "Theme", icon: Moon, keywords: "appearance night", run: () => setTheme("dark") },
      { id: "theme-system", label: "System theme", hint: "Theme", icon: Monitor, keywords: "appearance auto", run: () => setTheme("system") },
      { id: "verify", label: "Verify a report", hint: "Open", icon: Search, keywords: "qr code certificate", run: () => router.push("/verify") },
      { id: "signout", label: "Sign out", hint: "Account", icon: LogOut, keywords: "logout exit", run: () => void signOut(router) },
    ],
    [role, router, setTheme],
  );
  const results = commands.filter((c) => `${c.label} ${c.keywords} ${c.hint}`.toLowerCase().includes(q.toLowerCase()));
  const sel = Math.min(index, Math.max(0, results.length - 1));
  const choose = (i: number) => {
    const c = results[i];
    if (!c) return;
    setOpen(false);
    setQ("");
    setIndex(0);
    c.run();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:flex"
        aria-label="Open command palette (Ctrl+K)"
      >
        <Search className="size-4" aria-hidden /> <span className="hidden whitespace-nowrap xl:inline">Search or jump to…</span>
        <kbd className="ml-2 hidden items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] whitespace-nowrap xl:inline-flex">
          Ctrl K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQ(""); setIndex(0); } }}>
        <DialogContent className="top-[20%] translate-y-0 gap-0 p-0 sm:max-w-lg" aria-describedby="cmdk-desc">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription id="cmdk-desc" className="sr-only">Type to filter pages and actions, use the arrow keys and press Enter.</DialogDescription>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(sel);
                }
              }}
              placeholder="Search pages and actions…"
              className="h-12 flex-1 bg-transparent text-sm outline-none"
              role="combobox"
              aria-expanded
              aria-controls="cmdk-list"
              aria-activedescendant={results[sel] ? `cmd-${results[sel]!.id}` : undefined}
              aria-label="Search pages and actions"
            />
          </div>
          <ul id="cmdk-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</li>}
            {results.map((c, i) => (
              <li
                key={c.id}
                id={`cmd-${c.id}`}
                role="option"
                aria-selected={i === sel}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(i)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm", i === sel && "bg-accent text-accent-foreground")}
              >
                <c.icon className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">{c.label}</span>
                <span className="text-xs text-muted-foreground">{c.hint}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MobileBrand() {
  return (
    <span className="lg:hidden">
      <Brand />
    </span>
  );
}
