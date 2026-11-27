"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Brand } from "./brand";
import type { NavItem } from "./nav-config";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ items, sectionLabel }: { items: NavItem[]; sectionLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
        <SheetHeader className="border-b border-sidebar-border px-5 py-4">
          <SheetTitle asChild>
            <div>
              <Brand inverted />
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Main" className="px-3 py-4">
          <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/60">
            {sectionLabel}
          </p>
          <SidebarNav items={items} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
