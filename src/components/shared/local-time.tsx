"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Renders a timestamp in the VIEWER's time zone (server renders UTC, the browser swaps in local time). */
export function LocalTime({ value, mode = "datetime", className }: { value: string | Date; mode?: "datetime" | "date" | "time"; className?: string }) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  const d = new Date(value);
  const opts: Intl.DateTimeFormatOptions =
    mode === "date"
      ? { day: "2-digit", month: "short", year: "numeric" }
      : mode === "time"
        ? { hour: "2-digit", minute: "2-digit" }
        : { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
  const text = isClient
    ? new Intl.DateTimeFormat(undefined, opts).format(d)
    : new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(d) + " UTC";
  return (
    <time dateTime={d.toISOString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
