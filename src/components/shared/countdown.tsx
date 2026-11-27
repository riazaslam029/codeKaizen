"use client";

import { useSyncExternalStore } from "react";

const subscribe = (cb: () => void) => {
  const t = setInterval(cb, 1000);
  return () => clearInterval(t);
};

/** Live "2d 03h 14m" countdown to a server-provided instant (display only; the server decides access). */
export function Countdown({ to, className }: { to: string | Date; className?: string }) {
  const target = new Date(to).getTime();
  const now = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 1000), () => 0);
  if (now === 0) return <span className={className}>—</span>;
  const s = Math.max(0, Math.floor(target / 1000) - now);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = s === 0 ? "Opening now" : d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return (
    <span className={className} aria-live="off" suppressHydrationWarning>
      {text}
    </span>
  );
}
