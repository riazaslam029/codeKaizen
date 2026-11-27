import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  // exam phase / status
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-accent text-accent-foreground",
  PUBLISHED: "bg-accent text-accent-foreground",
  ONGOING: "bg-success/12 text-success",
  ACTIVE: "bg-success/12 text-success",
  COMPLETED: "bg-secondary text-secondary-foreground",
  CLOSED: "bg-secondary text-secondary-foreground",
  ARCHIVED: "bg-muted text-muted-foreground",
  // enrolment
  ENROLLED: "bg-accent text-accent-foreground",
  WITHDRAWN: "bg-muted text-muted-foreground",
  BLOCKED: "bg-destructive/10 text-destructive",
  // attempts
  IN_PROGRESS: "bg-success/12 text-success",
  SUBMITTED: "bg-warning/15 text-[oklch(0.45_0.12_70)]",
  AUTO_SUBMITTED: "bg-warning/15 text-[oklch(0.45_0.12_70)]",
  GRADED: "bg-accent text-accent-foreground",
  INVALIDATED: "bg-destructive/10 text-destructive",
  NOT_STARTED: "bg-muted text-muted-foreground",
  // results
  PROVISIONAL: "bg-muted text-muted-foreground",
  WITHHELD: "bg-destructive/10 text-destructive",
  PASS: "bg-success/12 text-success",
  FAIL: "bg-destructive/10 text-destructive",
  // severities
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-warning/15 text-[oklch(0.45_0.12_70)]",
  HIGH: "bg-destructive/10 text-destructive",
  // roles
  ADMIN: "bg-foreground text-background",
  EXAMINER: "bg-accent text-accent-foreground",
  CANDIDATE: "bg-secondary text-secondary-foreground",
};

const LABELS: Record<string, string> = {
  SCHEDULED: "Published",
  AUTO_SUBMITTED: "Auto-submitted",
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
  PROVISIONAL: "Unpublished",
  FAIL: "Not passed",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const label = LABELS[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <Badge variant="secondary" className={cn("rounded-sm font-medium whitespace-nowrap", TONES[value], className)}>
      {label}
    </Badge>
  );
}
