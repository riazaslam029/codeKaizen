import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE = {
  primary: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-chart-2/15 text-chart-2",
  neutral: "bg-muted text-muted-foreground",
} as const;
export type StatTone = keyof typeof TONE;

/** One stat tile everywhere: icon chip, label, large number and an always-present sub-line, equal heights in a grid. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  return (
    <Card className="lift h-full gap-0 py-0 shadow-none">
      <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
        <div className="flex min-h-10 items-center gap-2.5">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE[tone])}>
            <Icon className="size-4" aria-hidden />
          </span>
          <p className="min-w-0 text-sm leading-tight font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="tabular text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
        <p className="mt-auto text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
