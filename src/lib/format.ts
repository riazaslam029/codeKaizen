const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export const formatDateTime = (d: Date | string) => dateTime.format(new Date(d));
export const formatDate = (d: Date | string) => dateOnly.format(new Date(d));
export const formatDuration = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;

/** Server-side "now" for request-time rendering (each request renders once; nothing is cached). */
export const serverClock = () => Date.now();

/** Suggested default window for a new exam: next full hour, three hours long. */
export function suggestedWindow() {
  const s = new Date(Date.now() + 60 * 60_000);
  s.setMinutes(0, 0, 0);
  return { startsAt: s.toISOString(), endsAt: new Date(s.getTime() + 3 * 3600_000).toISOString() };
}
