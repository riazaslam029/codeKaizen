import { describe, expect, it } from "vitest";
import { computeExpiry, DEADLINE_GRACE_MS, isPastDeadline, remainingMs } from "@/lib/attempt-timing";
import { examPhase } from "@/lib/exam-phase";

const T = new Date("2026-06-01T10:00:00Z");
const min = (m: number) => new Date(T.getTime() + m * 60_000);

describe("computeExpiry (server-authoritative deadline)", () => {
  it("is start + duration when the window allows it", () => expect(computeExpiry(T, 60, min(180), false)).toEqual(min(60)));
  it("is capped at the window end for real attempts started late", () => expect(computeExpiry(T, 60, min(20), false)).toEqual(min(20)));
  it("sandbox previews always get the full duration", () => expect(computeExpiry(T, 60, min(20), true)).toEqual(min(60)));
  it("does not depend on anything but the inputs (no browser clock)", () => {
    expect(computeExpiry(T, 1, min(10), false).getTime() - T.getTime()).toBe(60_000);
  });
});

describe("isPastDeadline / remainingMs", () => {
  const exp = min(30);
  it("accepts up to the deadline", () => expect(isPastDeadline(exp, exp.getTime())).toBe(false));
  it("accepts within the network grace", () => expect(isPastDeadline(exp, exp.getTime() + DEADLINE_GRACE_MS)).toBe(false));
  it("rejects after the grace", () => expect(isPastDeadline(exp, exp.getTime() + DEADLINE_GRACE_MS + 1)).toBe(true));
  it("grace is small (≤ 5 s) so it can never meaningfully extend an exam", () => expect(DEADLINE_GRACE_MS).toBeLessThanOrEqual(5_000));
  it("remaining time never goes negative", () => {
    expect(remainingMs(exp, exp.getTime() + 10_000)).toBe(0);
    expect(remainingMs(exp, T.getTime())).toBe(30 * 60_000);
  });
});

describe("examPhase (derived lifecycle)", () => {
  const exam = (status: "DRAFT" | "PUBLISHED" | "ACTIVE" | "CLOSED" | "ARCHIVED") => ({ status, startsAt: min(0), endsAt: min(60) });
  it("draft stays draft regardless of time", () => expect(examPhase(exam("DRAFT"), min(30))).toBe("DRAFT"));
  it("archived is archived", () => expect(examPhase(exam("ARCHIVED"), min(30))).toBe("ARCHIVED"));
  it("closed counts as completed even inside the window", () => expect(examPhase(exam("CLOSED"), min(30))).toBe("COMPLETED"));
  it("published before start → scheduled", () => expect(examPhase(exam("PUBLISHED"), min(-1))).toBe("SCHEDULED"));
  it("start boundary is inclusive → ongoing", () => expect(examPhase(exam("PUBLISHED"), min(0))).toBe("ONGOING"));
  it("end boundary is inclusive → ongoing", () => expect(examPhase(exam("PUBLISHED"), min(60))).toBe("ONGOING"));
  it("after end → completed", () => expect(examPhase(exam("PUBLISHED"), new Date(min(60).getTime() + 1))).toBe("COMPLETED"));
  it("accepts ISO strings", () => expect(examPhase({ status: "PUBLISHED", startsAt: min(0).toISOString(), endsAt: min(60).toISOString() }, min(1))).toBe("ONGOING"));
});
