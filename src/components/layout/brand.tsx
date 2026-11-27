import { cn } from "@/lib/utils";

/** Wordmark: a square "seal" glyph + name. Pure CSS/SVG, no image request. */
export function Brand({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-7 shrink-0">
        <rect x="1" y="1" width="22" height="22" rx="5" className={inverted ? "fill-sidebar-primary" : "fill-primary"} />
        <path
          d="M7 12.5l3.2 3.2L17 8.8"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={inverted ? "stroke-sidebar" : "stroke-primary-foreground"}
        />
      </svg>
      <span className="leading-none">
        <span className={cn("block text-[15px] font-semibold tracking-tight", inverted && "text-sidebar-accent-foreground")}>
          CodeKaizen
        </span>
        <span
          className={cn(
            "block font-mono text-[10px] uppercase tracking-[0.18em]",
            inverted ? "text-sidebar-foreground/70" : "text-muted-foreground",
          )}
        >
          Exams
        </span>
      </span>
    </span>
  );
}
