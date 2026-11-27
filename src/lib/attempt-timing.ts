/**
 * Server-authoritative exam timing. Pure functions so the rules are unit-testable;
 * every caller passes the SERVER's clock — the browser's clock is never an input.
 */

/**
 * Network grace for in-flight requests: a save that LEAVES the browser before the deadline may
 * arrive a moment later. Anything later than this is rejected. It never extends the exam itself.
 */
export const DEADLINE_GRACE_MS = 3_000;

/** Minimum time an attempt must have when it starts; otherwise starting is refused. */
export const MIN_START_WINDOW_MS = 30_000;

/**
 * Deadline for a new attempt: start + duration, but a real attempt can never run past the exam's
 * availability window. Sandbox previews get the full duration.
 */
export function computeExpiry(now: Date, durationMinutes: number, windowEnd: Date, sandbox: boolean): Date {
  const byDuration = now.getTime() + durationMinutes * 60_000;
  return new Date(sandbox ? byDuration : Math.min(byDuration, windowEnd.getTime()));
}

/** True once the server clock is beyond the deadline plus the network grace. */
export function isPastDeadline(expiresAt: Date, nowMs: number): boolean {
  return nowMs > expiresAt.getTime() + DEADLINE_GRACE_MS;
}

/** Remaining milliseconds as the SERVER sees them (never negative). */
export function remainingMs(expiresAt: Date, nowMs: number): number {
  return Math.max(0, expiresAt.getTime() - nowMs);
}
