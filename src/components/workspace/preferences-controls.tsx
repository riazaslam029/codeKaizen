"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type { WorkspacePreferences } from "@/db/schema/types";

/** Shared controls for the exam-workspace preferences (used in the workspace popover and on the preferences page). */
export function PreferencesControls({ value, onChange }: { value: WorkspacePreferences; onChange: (p: WorkspacePreferences) => void }) {
  const set = <K extends keyof WorkspacePreferences>(k: K, v: WorkspacePreferences[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Text size</legend>
        <RadioGroup value={value.fontSize} onValueChange={(v) => set("fontSize", v as WorkspacePreferences["fontSize"])} className="grid grid-cols-4 gap-2">
          {(["sm", "md", "lg", "xl"] as const).map((s, i) => (
            <Label key={s} className="flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
              <RadioGroupItem value={s} className="sr-only" />
              <span style={{ fontSize: 13 + i * 2 }} aria-hidden>Aa</span>
              <span className="text-xs text-muted-foreground">{["Small", "Default", "Large", "X-large"][i]}</span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Theme</legend>
        <RadioGroup value={value.theme} onValueChange={(v) => set("theme", v as WorkspacePreferences["theme"])} className="grid grid-cols-3 gap-2">
          {(
            [
              ["light", "Light"],
              ["dark", "Dark"],
              ["contrast", "High contrast"],
            ] as const
          ).map(([v, l]) => (
            <Label key={v} className="flex cursor-pointer items-center justify-center rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
              <RadioGroupItem value={v} className="sr-only" />
              {l}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Layout</legend>
        <RadioGroup value={value.layout} onValueChange={(v) => set("layout", v as WorkspacePreferences["layout"])} className="grid grid-cols-2 gap-2">
          {(
            [
              ["split", "Side by side", "Navigator beside the question"],
              ["focus", "Focus", "One centred column"],
            ] as const
          ).map(([v, l, h]) => (
            <Label key={v} className="flex cursor-pointer flex-col items-start rounded-md border p-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
              <RadioGroupItem value={v} className="sr-only" />
              <span className="text-sm">{l}</span>
              <span className="text-xs font-normal text-muted-foreground">{h}</span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Show question panel</span>
        <Switch checked={value.showNavigator} onCheckedChange={(v) => set("showNavigator", v)} />
      </label>
    </div>
  );
}
