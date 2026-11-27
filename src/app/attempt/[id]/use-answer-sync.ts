"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AnswerResponse } from "@/db/schema/types";

export type LocalAnswer = { response: AnswerResponse | null; flagged: boolean; revision: number };
export type SyncStatus = "saved" | "saving" | "offline" | "retrying" | "closed";
type ClientEvent = { type: "NETWORK_LOSS" | "RECONNECTED" | "SYNC_FAILED"; details: Record<string, unknown> };

const PERIODIC_MS = 10_000;

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
const DEBOUNCE_MS = 700;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / disabled — the in-memory queue still retries */
  }
}

/**
 * Failure-resilient answer synchronisation.
 * - Every edit bumps a per-question revision and enters a pending queue mirrored to localStorage,
 *   so unsynced answers survive refreshes, crashes and offline periods on this device.
 * - The queue is flushed (debounced + every 10 s + on reconnect) with exponential back-off on failure.
 * - The server applies a save only if its revision is newer, so retries are idempotent.
 * - The database remains the source of truth; localStorage is only a temporary outbox.
 */
export function useAnswerSync(opts: {
  attemptId: string;
  sessionId: string;
  initial: Record<string, LocalAnswer>;
  active: boolean;
  onServerTime: (serverNow: string, expiresAt: string) => void;
  onClosed: (message: string) => void;
  onRecovered: (count: number) => void;
}) {
  const { attemptId, sessionId, active } = opts;
  const pendingKey = `ckz:pending:${attemptId}`;
  const eventsKey = `ckz:events:${attemptId}`;

  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>(opts.initial);
  const pending = useRef<Record<string, LocalAnswer>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("saved");
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);

  const inflight = useRef(false);
  const failures = useRef(0);
  const reportedStreak = useRef(false);
  const offlineSince = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef(opts);
  useEffect(() => {
    cb.current = opts;
  });

  const persist = useCallback(() => {
    writeJSON(pendingKey, pending.current);
    setPendingCount(Object.keys(pending.current).length);
  }, [pendingKey]);

  /* ── client events (queued while offline) ── */
  const flushEvents = useCallback(async () => {
    const queue = readJSON<ClientEvent[]>(eventsKey, []);
    if (!queue.length || !navigator.onLine) return;
    const left: ClientEvent[] = [];
    for (const ev of queue) {
      try {
        const r = await fetch(`/api/attempts/${attemptId}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ev) });
        if (!r.ok && r.status >= 500) left.push(ev);
      } catch {
        left.push(ev);
      }
    }
    writeJSON(eventsKey, left);
  }, [attemptId, eventsKey]);

  const queueEvent = useCallback(
    (ev: ClientEvent) => {
      writeJSON(eventsKey, [...readJSON<ClientEvent[]>(eventsKey, []), ev].slice(-50));
      void flushEvents();
    },
    [eventsKey, flushEvents],
  );

  /* ── flush ── */
  const flush = useCallback(async (): Promise<boolean> => {
    if (!active || inflight.current) return Object.keys(pending.current).length === 0;
    const entries = Object.entries(pending.current);
    if (!entries.length) {
      setStatus((s) => (s === "closed" ? s : "saved"));
      return true;
    }
    if (!navigator.onLine) {
      setStatus("offline");
      return false;
    }
    inflight.current = true;
    setStatus("saving");
    try {
      const res = await fetch(`/api/attempts/${attemptId}/answers`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientSessionId: sessionId,
          answers: entries.map(([questionId, a]) => ({ questionId, response: a.response, flagged: a.flagged, revision: a.revision })),
        }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        pending.current = {};
        persist();
        setStatus("closed");
        cb.current.onClosed(body?.error?.message ?? "This attempt is closed.");
        return false;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { serverNow: string; expiresAt: string; revisions: Record<string, number> };
      cb.current.onServerTime(body.serverNow, body.expiresAt);
      for (const [qid] of entries) {
        const local = pending.current[qid];
        if (local && (body.revisions[qid] ?? 0) >= local.revision) delete pending.current[qid];
      }
      persist();
      failures.current = 0;
      reportedStreak.current = false;
      setRetryAt(null);
      setLastSavedAt(new Date());
      const remaining = Object.keys(pending.current).length;
      setStatus(remaining ? "saving" : "saved");
      if (remaining) schedule(200);
      return remaining === 0;
    } catch {
      failures.current += 1;
      const delay = Math.min(30, 2 ** failures.current) * 1000;
      setStatus(navigator.onLine ? "retrying" : "offline");
      setRetryAt(Date.now() + delay);
      schedule(delay);
      if (failures.current >= 3 && !reportedStreak.current) {
        reportedStreak.current = true;
        queueEvent({ type: "SYNC_FAILED", details: { failures: failures.current } });
      }
      return false;
    } finally {
      inflight.current = false;
    }
  }, [active, attemptId, sessionId, persist, queueEvent]);

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  function schedule(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), ms);
  }

  /* ── edits ── */
  const update = useCallback(
    (questionId: string, patch: Partial<Pick<LocalAnswer, "response" | "flagged">>) => {
      if (!active) return;
      setAnswers((prev) => {
        const cur = prev[questionId] ?? { response: null, flagged: false, revision: 0 };
        const next: LocalAnswer = { ...cur, ...patch, revision: Math.max(cur.revision, pending.current[questionId]?.revision ?? 0) + 1 };
        pending.current[questionId] = next;
        return { ...prev, [questionId]: next };
      });
      queueMicrotask(persist);
      setStatus(navigator.onLine ? "saving" : "offline");
      schedule(DEBOUNCE_MS);
    },
    [active, persist],
  );

  /* ── mount: recover unsynced answers from this device (one tick after hydration) ── */
  useEffect(() => {
    const t = setTimeout(recover, 0);
    return () => clearTimeout(t);
    function recover() {
    const stored = readJSON<Record<string, LocalAnswer>>(pendingKey, {});
    const newer = Object.entries(stored).filter(([qid, a]) => a.revision > (cb.current.initial[qid]?.revision ?? 0));
    if (newer.length && active) {
      for (const [qid, a] of newer) pending.current[qid] = a;
      setAnswers((prev) => ({ ...prev, ...Object.fromEntries(newer) }));
      persist();
      cb.current.onRecovered(newer.length);
      schedule(300);
    } else writeJSON(pendingKey, {});
    void flushEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── connectivity + periodic autosave ── */
  useEffect(() => {
    if (!active) return;
    const goOffline = () => {
      offlineSince.current ??= Date.now();
      setStatus("offline");
    };
    const goOnline = () => {
      if (offlineSince.current) {
        const offlineSeconds = Math.round((Date.now() - offlineSince.current) / 1000);
        offlineSince.current = null;
        queueEvent({ type: "NETWORK_LOSS", details: { offlineSeconds } });
        queueEvent({ type: "RECONNECTED", details: { offlineSeconds } });
      }
      failures.current = 0;
      void flushRef.current();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    const periodic = setInterval(() => void flushRef.current(), PERIODIC_MS);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("beforeunload", beforeUnload);
      clearInterval(periodic);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, queueEvent]);

  const retryNow = useCallback(() => {
    failures.current = 0;
    void flushRef.current();
  }, []);

  return { answers, update, flush, retryNow, status, pendingCount, online, lastSavedAt, retryAt };
}
