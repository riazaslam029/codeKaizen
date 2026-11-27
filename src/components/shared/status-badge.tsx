import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  // exams
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-accent text-accent-foreground",
  ACTIVE: "bg-success/12 text-success",
  CLOSED: "bg-secondary text-secondary-foreground",
  ARCHIVED: "bg-muted text-muted-foreground",
  // enrollments
  ENROLLED: "bg-accent text-accent-foreground",
  WITHDRAWN: "bg-muted text-muted-foreground",
  BLOCKED: "bg-destructive/10 text-destructive",
  // roles
  ADMIN: "bg-foreground text-background",
  EXAMINER: "bg-accent text-accent-foreground",
  CANDIDATE: "bg-secondary text-secondary-foreground",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const label = value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <Badge variant="secondary" className={cn("rounded-sm font-medium", TONES[value], className)}>
      {label}
    </Badge>
  );
}
