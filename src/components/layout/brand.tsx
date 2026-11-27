import { cn } from "@/lib/utils";

/** Geometric hexagonal seal + precision checkmark mark paired with Space Grotesk & JetBrains Mono wordmark. */
export function Brand({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
          inverted
            ? "border-white/15 bg-[#0A0E1A] shadow-[0_0_16px_rgba(0,102,255,0.22)]"
            : "border-primary/25 bg-primary/10 dark:border-white/15 dark:bg-[#0A0E1A]",
        )}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4.5">
          <path
            d="M4.5 7.5L12 3.5L19.5 7.5V16.5L12 20.5L4.5 16.5V7.5Z"
            fill="none"
            className={inverted ? "stroke-[#4D94FF]" : "stroke-primary"}
            strokeWidth="1.9"
          />
          <path
            d="M8.5 12.2L11 14.7L15.8 9.6"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={inverted ? "stroke-white" : "stroke-foreground"}
          />
        </svg>
      </span>
      <span className="leading-none">
        <span
          className={cn(
            "font-display block text-[15px] font-bold tracking-tight",
            inverted ? "text-sidebar-accent-foreground" : "text-foreground",
          )}
        >
          CODEKAIZEN<sup className="ml-0.5 text-[9px] text-[#4D94FF]">®</sup>
        </span>
        <span
          className={cn(
            "font-mono-code block text-[9.5px] tracking-[0.2em] uppercase",
            inverted ? "text-slate-400" : "text-muted-foreground",
          )}
        >
          EXAMS // 5.3
        </span>
      </span>
    </span>
  );
}
