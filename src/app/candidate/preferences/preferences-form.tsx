"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PreferencesControls } from "@/components/workspace/preferences-controls";
import type { WorkspacePreferences } from "@/db/schema/types";
import { cn } from "@/lib/utils";

const SIZE = { sm: "text-[15px]", md: "text-base", lg: "text-lg", xl: "text-xl" } as const;

export function PreferencesForm({ initial }: { initial: WorkspacePreferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);
  const save = () =>
    start(async () => {
      const r = await fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(prefs) });
      if (r.ok) toast.success("Preferences saved");
      else toast.error("Could not save preferences");
    });
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
      <Card className="shadow-none"><CardContent><PreferencesControls value={prefs} onChange={setPrefs} /></CardContent></Card>
      <div>
        <p className="mb-2 text-sm font-medium">Preview</p>
        <div className={cn("rounded-lg border bg-background p-5 text-foreground", prefs.theme === "dark" && "dark", prefs.theme === "contrast" && "contrast")}>
          <div className={cn("rounded-md border bg-card p-4", SIZE[prefs.fontSize])}>
            <p className="leading-relaxed">Which cookie attribute prevents client-side JavaScript from reading a session cookie?</p>
            <div className="mt-3 space-y-2">
              {["Secure", "HttpOnly"].map((o, i) => (
                <div key={o} className={cn("rounded-md border p-2.5", i === 1 && "border-primary bg-accent")}>{String.fromCharCode(65 + i)}. {o}</div>
              ))}
            </div>
          </div>
        </div>
        <Button className="mt-4" onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Save preferences
        </Button>
      </div>
    </div>
  );
}
