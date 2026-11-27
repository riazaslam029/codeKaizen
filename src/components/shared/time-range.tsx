"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * "28 Nov 2026, 09:00 – 12:00" when both ends are on the same local day,
 * otherwise "27 Nov 2026, 11:40 – 27 Dec 2026, 11:40". Viewer's time zone after hydration.
 */
export function TimeRange({ start, end, className }: { start: string | Date; end: string | Date; className?: string }) {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  const tz = isClient ? undefined : "UTC";
  const s = new Date(start);
  const e = new Date(end);
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const full = new Intl.DateTimeFormat(isClient ? undefined : "en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const time = new Intl.DateTimeFormat(isClient ? undefined : "en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const sameDay = day(s) === day(e);
  return (
    <span className={className} suppressHydrationWarning>
      <time dateTime={s.toISOString()} suppressHydrationWarning>{full.format(s)}</time>
      {" – "}
      <time dateTime={e.toISOString()} suppressHydrationWarning>{sameDay ? time.format(e) : full.format(e)}</time>
      {!isClient && " UTC"}
    </span>
  );
}
