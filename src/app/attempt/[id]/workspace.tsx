"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  CloudOff,
  Cloud,
  CloudUpload,
  FlaskConical,
  History,
  Keyboard,
  Loader2,
  ShieldCheck,
  Megaphone,
  LogOut,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings2,
  Timer,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/layout/brand";
import { LocalTime } from "@/components/shared/local-time";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { PreferencesControls } from "@/components/workspace/preferences-controls";
import type { WorkspacePreferences } from "@/db/schema/types";
import { cn } from "@/lib/utils";
import type { AttemptState } from "./types";
import { Scratchpad } from "./scratchpad";
import { type LocalAnswer, useAnswerSync } from "./use-answer-sync";

const FONT: Record<WorkspacePreferences["fontSize"], string> = { sm: "text-[15px]", md: "text-base", lg: "text-lg", xl: "text-xl" };
const GRACE_MS = 3_500;

function answered(a: LocalAnswer | undefined) {
  if (!a?.response) return false;
  return "optionIds" in a.response ? a.response.optionIds.length > 0 : a.response.text.trim().length > 0;
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function ExamWorkspace({ initial, initialPrefs, backHref }: { initial: AttemptState; initialPrefs: WorkspacePreferences; backHref: string }) {
  const [state, setState] = useState(initial);
  const [sessionId] = useState(() => crypto.randomUUID().replace(/-/g, ""));
  const attemptId = state.attempt.id;
  const isOpen = state.attempt.status === "IN_PROGRESS";

  /* ── server-authoritative clock ── */
  // offset = server clock - browser clock; set on mount and re-synced on every server response.
  const offset = useRef(0);
  const [expiresAt, setExpiresAt] = useState(Date.parse(initial.attempt.expiresAt));
  const [now, setNow] = useState(() => Date.parse(initial.serverNow));
  const [restored, setRestored] = useState<{ leftMs: number; answered: number; total: number } | null>(null);
  const left = expiresAt - now;
  const onServerTime = useCallback((serverNow: string, exp: string) => {
    offset.current = Date.parse(serverNow) - Date.now();
    setExpiresAt(Date.parse(exp));
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const r = await fetch(`/api/attempts/${attemptId}`, { headers: { "x-client-session": sessionId }, cache: "no-store" });
      if (!r.ok) return null;
      const s = (await r.json()) as AttemptState;
      onServerTime(s.serverNow, s.attempt.expiresAt);
      setState(s);
      if (s.resumed && s.attempt.status === "IN_PROGRESS") {
        setRestored({ leftMs: Date.parse(s.attempt.expiresAt) - Date.parse(s.serverNow), answered: s.summary.answered, total: s.summary.total });
      }
      return s;
    } catch {
      return null;
    }
  }, [attemptId, sessionId, onServerTime]);

  const sync = useAnswerSync({
    attemptId,
    sessionId,
    active: isOpen,
    initial: Object.fromEntries(Object.entries(initial.answers).map(([k, v]) => [k, v as LocalAnswer])),
    onServerTime,
    onClosed: (msg) => {
      toast.error(msg);
      void refreshState();
    },
    onRecovered: (n) => toast.success(`Recovered ${n} answer${n > 1 ? "s" : ""} saved on this device — syncing now.`),
  });

  /* ── register this tab (server records recovery if a previous session existed) + poll ── */
  useEffect(() => {
    const kick = setTimeout(() => void refreshState(), 0);
    const poll = setInterval(() => void refreshState(), 20_000);
    return () => {
      clearTimeout(kick);
      clearInterval(poll);
    };
  }, [refreshState]);

  /* ── ticking clock + deadline: flush what we have, then let the SERVER finalise (auto-submit) ── */
  const live = useRef({ isOpen, expiresAt, flush: sync.flush, refreshState });
  useEffect(() => {
    live.current = { isOpen, expiresAt, flush: sync.flush, refreshState };
  });
  const deadlineHandled = useRef(false);
  useEffect(() => {
    offset.current = Date.parse(initial.serverNow) - Date.now();
    const t = setInterval(() => {
      const serverNow = Date.now() + offset.current;
      setNow(serverNow);
      const l = live.current;
      if (l.isOpen && serverNow >= l.expiresAt && !deadlineHandled.current) {
        deadlineHandled.current = true;
        toast.warning("Time is up. Saving your last answers…");
        void l.flush().finally(() => setTimeout(() => void live.current.refreshState(), GRACE_MS));
      }
    }, 500);
    return () => clearInterval(t);
  }, [initial.serverNow]);

  /* ── announcements ── */
  const [seen, setSeen] = useStoredSet(`ckz:seen:${attemptId}`);
  const unseen = state.announcements.filter((a) => !seen.has(a.id));
  const dismiss = (ids: string[]) => setSeen(new Set([...seen, ...ids]));

  /* ── preferences (persisted to the DB) ── */
  const [prefs, setPrefs] = useState(initialPrefs);
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changePrefs = (p: WorkspacePreferences) => {
    setPrefs(p);
    if (prefTimer.current) clearTimeout(prefTimer.current);
    prefTimer.current = setTimeout(() => {
      void fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) }).catch(() => undefined);
    }, 600);
  };

  /* ── navigation ── */
  const questions = state.questions;
  const [index, setIndex] = useState(0);
  const q = questions[index]!;
  const a = sync.answers[q.questionId];
  const answeredCount = questions.filter((x) => answered(sync.answers[x.questionId])).length;
  const flaggedCount = questions.filter((x) => sync.answers[x.questionId]?.flagged).length;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  /* ── keyboard shortcuts (ignored while typing or when a dialog is open) ── */
  const keys = useRef({ index, total: questions.length, q, a, update: sync.update, blocked: false });
  useEffect(() => {
    keys.current = { index, total: questions.length, q, a, update: sync.update, blocked: reviewOpen || exitOpen || scratchOpen || helpOpen };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.closest("input, textarea, select, [contenteditable=true]") || t.isContentEditable)) return;
      const k = keys.current;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }
      if (k.blocked) return;
      const key = e.key.toLowerCase();
      if (key === "n" && k.index < k.total - 1) setIndex(k.index + 1);
      else if (key === "p" && k.index > 0) setIndex(k.index - 1);
      else if (key === "f") k.update(k.q.questionId, { flagged: !k.a?.flagged });
      else if (/^[1-9]$/.test(key) && k.q.options) {
        const opt = k.q.options[Number(key) - 1];
        if (!opt) return;
        if (k.q.type === "MCQ_MULTI") {
          const sel = k.a?.response && "optionIds" in k.a.response ? k.a.response.optionIds : [];
          k.update(k.q.questionId, { response: { optionIds: sel.includes(opt.id) ? sel.filter((x) => x !== opt.id) : [...sel, opt.id] } });
        } else k.update(k.q.questionId, { response: { optionIds: [opt.id] } });
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Save & exit: flush, then leave. The attempt stays IN_PROGRESS and the server timer keeps running. */
  const saveAndExit = async () => {
    setExiting(true);
    const flushed = await sync.flush();
    if (!flushed) toast.warning("Some answers could not reach the server yet. They are kept on this device and sync when you return here.");
    router.push(backHref);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const flushed = await sync.flush();
      if (!flushed) {
        toast.error("Some answers have not reached the server yet. Check your connection — your answers are kept on this device.");
        return;
      }
      const r = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      if (!r.ok) {
        const b = await r.json().catch(() => null);
        toast.error(b?.error?.message ?? "Submission failed. Please retry.");
        return;
      }
      setReviewOpen(false);
      await refreshState();
    } catch {
      toast.error("Network error while submitting. Your answers are safe — retry when you are back online.");
    } finally {
      setSubmitting(false);
    }
  };

  const themeClass = prefs.theme === "dark" ? "dark" : prefs.theme === "contrast" ? "light contrast" : "light";
  const timeTone =
    left <= 60_000
      ? "border-destructive bg-destructive/12 text-destructive"
      : left <= 5 * 60_000
        ? "border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200"
        : "";
  const announcedThreshold = useMemo(() => (left <= 60_000 ? "1 minute remaining" : left <= 5 * 60_000 ? "5 minutes remaining" : ""), [left]);

  /* ───────────────────────── finished ───────────────────────── */
  if (!isOpen) {
    return (
      <div className={cn("min-h-dvh bg-background text-foreground", themeClass)}>
        <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center outline-none">
          <CheckCircle2 className="size-12 text-success" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold">{state.attempt.status === "AUTO_SUBMITTED" ? "Time is up — attempt submitted" : "Attempt submitted"}</h1>
          <p className="mt-2 text-muted-foreground">
            {state.exam.title}. {state.summary.answered} of {state.summary.total} questions answered.
            {state.attempt.submittedAt && (
              <>
                {" "}Recorded at <LocalTime value={state.attempt.submittedAt} />.
              </>
            )}
          </p>
          {state.attempt.isSandbox && state.sandboxScore && (
            <p className="mt-4 rounded-md border bg-card px-4 py-3 text-sm">
              Sandbox score (auto-marked): <strong>{state.sandboxScore.score} / {state.sandboxScore.maxScore}</strong>
              {state.sandboxScore.manualPending > 0 && ` · ${state.sandboxScore.manualPending} written answer(s) not auto-marked`}. Not recorded as a result.
            </p>
          )}
          {!state.attempt.isSandbox && <p className="mt-4 text-sm text-muted-foreground">Results appear on your dashboard once your examiner publishes them.</p>}
          <Button asChild className="mt-6">
            <Link href={backHref}>Return to dashboard</Link>
          </Button>
        </main>
      </div>
    );
  }

  /* ───────────────────────── workspace ───────────────────────── */
  const navigator = (
    <nav aria-label="Questions" className="space-y-4">
      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span className="tabular">{answeredCount} / {questions.length} answered</span>
        </div>
        <Progress value={(answeredCount / questions.length) * 100} aria-label="Answered progress" />
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {questions.map((x, i) => {
          const ans = sync.answers[x.questionId];
          const done = answered(ans);
          const unsynced = sync.pendingIds.has(x.questionId);
          return (
            <li key={x.questionId}>
              <button
                onClick={() => setIndex(i)}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Question ${i + 1}: ${done ? "answered" : "unanswered"}${ans?.flagged ? ", marked for review" : ""}${unsynced ? ", not yet synced" : ""}`}
                className={cn(
                  "tabular relative flex h-9 w-full items-center justify-center rounded-md border text-sm font-medium transition-colors",
                  done ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  i === index && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
              >
                {i + 1}
                {ans?.flagged && <Bookmark className="absolute -top-1.5 -right-1.5 size-3.5 fill-warning text-amber-700 dark:text-amber-300" aria-hidden />}
                {unsynced && <CloudUpload className="absolute -right-1.5 -bottom-1.5 size-3.5 rounded-full bg-background text-amber-700 dark:text-amber-300" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-2"><span className="size-3 rounded-sm bg-primary" aria-hidden /> Answered</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded-sm border bg-card" aria-hidden /> Not answered</li>
        <li className="flex items-center gap-2"><Bookmark className="size-3 fill-warning text-amber-700 dark:text-amber-300" aria-hidden /> Marked for review ({flaggedCount})</li>
        <li className="flex items-center gap-2"><CloudUpload className="size-3 text-amber-700 dark:text-amber-300" aria-hidden /> Saved on this device, syncing ({sync.pendingCount})</li>
      </ul>
    </nav>
  );

  const showSide = prefs.showNavigator && prefs.layout === "split";

  return (
    <div className={cn("flex min-h-dvh flex-col bg-background text-foreground", themeClass)}>
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Brand className="hidden md:inline-flex" />
            <div className="min-w-0 md:border-l md:pl-3">
              <p className="truncate text-sm font-semibold">{state.exam.title}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {state.exam.code}
                {state.attempt.isSandbox && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded bg-warning/20 px-1.5 py-0.5 font-sans font-medium text-foreground">
                    <FlaskConical className="size-3" aria-hidden /> Sandbox — not recorded
                  </span>
                )}
              </p>
            </div>
          </div>

          <SyncIndicator sync={sync} />

          <div className="ml-auto flex items-center gap-2">
            <div className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-base font-semibold tabular-nums transition-colors", timeTone)} role="timer" aria-label={`Time remaining ${fmtClock(left)}`}>
              <Timer className="size-4" aria-hidden />
              {fmtClock(left)}
            </div>
            <span className="sr-only" aria-live="assertive">{announcedThreshold}</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label={`Announcements (${state.announcements.length})`} className="relative">
                  <Megaphone className="size-4" />
                  {unseen.length > 0 && <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">{unseen.length}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <p className="mb-2 text-sm font-semibold">Announcements</p>
                {state.announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None yet.</p>
                ) : (
                  <ol className="max-h-80 space-y-3 overflow-y-auto">
                    {state.announcements.map((n) => (
                      <li key={n.id} className="text-sm">
                        <p className="font-medium">{n.title}</p>
                        <p className="whitespace-pre-line text-muted-foreground">{n.body}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Connection and recovery log" className="hidden sm:inline-flex">
                  <History className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <p className="text-sm font-semibold">Connection & recovery log</p>
                <p className="mb-2 text-xs text-muted-foreground">Recorded by the server. Disruptions never add or remove time.</p>
                {state.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No disruptions so far.</p>
                ) : (
                  <ol className="max-h-72 space-y-2 overflow-y-auto border-l pl-3">
                    {state.timeline.map((t) => (
                      <li key={t.id} className="text-sm">
                        <p className="font-medium">{TIMELINE_LABEL[t.type] ?? t.type}</p>
                        <LocalTime value={t.occurredAt} mode="time" className="text-xs text-muted-foreground" />
                      </li>
                    ))}
                  </ol>
                )}
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" aria-label="Keyboard shortcuts (?)" className="hidden md:inline-flex" onClick={() => setHelpOpen(true)}>
              <Keyboard className="size-4" />
            </Button>
            <Button variant="outline" size="icon" aria-label="Open scratchpad" onClick={() => setScratchOpen(true)}>
              <NotebookPen className="size-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Workspace preferences">
                  <Settings2 className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <PreferencesControls value={prefs} onChange={changePrefs} />
              </PopoverContent>
            </Popover>
            <Button variant="outline" onClick={() => setExitOpen(true)}>
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Save & exit</span>
              <span className="sr-only sm:hidden">Save and exit</span>
            </Button>
            <Button onClick={() => setReviewOpen(true)}>Review & submit</Button>
          </div>
        </div>
      </header>

      {unseen.length > 0 && (
        <div className="border-b bg-accent text-accent-foreground" role="alert">
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5 text-sm">
            <Megaphone className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="flex-1">
              <strong>{unseen[0]!.title}:</strong> {unseen[0]!.body}
              {unseen.length > 1 && <span className="text-muted-foreground"> (+{unseen.length - 1} more)</span>}
            </p>
            <button onClick={() => dismiss(unseen.map((u) => u.id))} aria-label="Dismiss announcements" className="rounded p-0.5 hover:bg-background/40">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {!sync.online && (
        <div className="border-b bg-warning/15" role="status">
          <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-sm">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            <span>
              <strong>You are offline.</strong> Your answers are safe — they are kept on this device and sync automatically when the
              connection returns. The server timer keeps running.
            </span>
          </p>
        </div>
      )}

      <div className={cn("mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6", showSide ? "lg:grid-cols-[15rem_1fr]" : "max-w-3xl")}>
        {showSide && <aside className="hidden lg:block"><div className="sticky top-24">{navigator}</div></aside>}

        <main id="main" tabIndex={-1} className={cn("min-w-0 outline-none", FONT[prefs.fontSize])}>
          <div className="mb-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Question <span className="tabular font-semibold text-foreground">{index + 1}</span> of {questions.length} · {q.marks} {q.marks === 1 ? "mark" : "marks"}
              {q.type === "MCQ_MULTI" && " · select all that apply"}
            </span>
            {prefs.showNavigator && !showSide && <span className="tabular">{answeredCount}/{questions.length} answered</span>}
          </div>

          <article className="rounded-lg border bg-card p-5 sm:p-7" aria-labelledby="q-prompt">
            <p id="q-prompt" className="leading-relaxed whitespace-pre-line">{q.prompt}</p>

            <div className="mt-6">
              {(q.type === "MCQ_SINGLE" || q.type === "TRUE_FALSE") && (
                <RadioGroup
                  value={a?.response && "optionIds" in a.response ? (a.response.optionIds[0] ?? "") : ""}
                  onValueChange={(v) => sync.update(q.questionId, { response: { optionIds: [v] } })}
                  aria-labelledby="q-prompt"
                  className="gap-2.5"
                >
                  {q.options!.map((o, i) => (
                    <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors hover:bg-muted/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent">
                      <RadioGroupItem value={o.id} className="mt-0.5" />
                      <span className="font-mono text-sm text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{o.text}</span>
                    </label>
                  ))}
                </RadioGroup>
              )}
              {q.type === "MCQ_MULTI" && (
                <div className="grid gap-2.5" role="group" aria-labelledby="q-prompt">
                  {q.options!.map((o, i) => {
                    const sel = a?.response && "optionIds" in a.response ? a.response.optionIds : [];
                    const checked = sel.includes(o.id);
                    return (
                      <label key={o.id} className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors hover:bg-muted/60", checked && "border-primary bg-accent")}>
                        <Checkbox
                          checked={checked}
                          className="mt-0.5"
                          onCheckedChange={(v) => sync.update(q.questionId, { response: { optionIds: v ? [...sel, o.id] : sel.filter((x) => x !== o.id) } })}
                        />
                        <span className="font-mono text-sm text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                        <span className="flex-1">{o.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {(q.type === "SHORT_ANSWER" || q.type === "ESSAY") && (
                <WrittenAnswer
                  key={q.questionId}
                  long={q.type === "ESSAY"}
                  value={a?.response && "text" in a.response ? a.response.text : ""}
                  onChange={(text) => sync.update(q.questionId, { response: { text } })}
                />
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                variant={a?.flagged ? "secondary" : "outline"}
                size="sm"
                aria-pressed={!!a?.flagged}
                onClick={() => sync.update(q.questionId, { flagged: !a?.flagged })}
              >
                {a?.flagged ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
                {a?.flagged ? "Marked for review" : "Mark for review"}
              </Button>
              <span className="ml-auto flex items-center gap-3">
                <AnswerSaveState pending={sync.pendingIds.has(q.questionId)} online={sync.online} hasAnswer={!!a} />
                {answered(a) && (
                  <Button variant="ghost" size="sm" onClick={() => sync.update(q.questionId, { response: null })}>
                    Clear answer
                  </Button>
                )}
              </span>
            </div>
          </article>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ArrowLeft className="size-4" aria-hidden /> Previous
            </Button>
            {prefs.showNavigator && !showSide && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost">{showSide ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />} All questions</Button>
                </PopoverTrigger>
                <PopoverContent className="w-72">{navigator}</PopoverContent>
              </Popover>
            )}
            {index < questions.length - 1 ? (
              <Button onClick={() => setIndex(index + 1)}>
                Next <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={() => setReviewOpen(true)}>Review & submit</Button>
            )}
          </div>
          {showSide && <div className="mt-6 lg:hidden">{navigator}</div>}
        </main>
      </div>

      {/* review + submit */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className={cn("max-h-[90dvh] overflow-y-auto sm:max-w-xl", themeClass)}>
          <DialogHeader>
            <DialogTitle>Review before submitting</DialogTitle>
            <DialogDescription>
              {answeredCount} of {questions.length} answered · {questions.length - answeredCount} unanswered · {flaggedCount} marked for review. You cannot change answers after submitting.
            </DialogDescription>
          </DialogHeader>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {questions.map((x, i) => {
              const ans = sync.answers[x.questionId];
              return (
                <li key={x.questionId}>
                  <button
                    onClick={() => { setIndex(i); setReviewOpen(false); }}
                    className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span>Q{i + 1}</span>
                    <span className={cn("text-xs", answered(ans) ? "text-success" : "text-destructive")}>
                      {answered(ans) ? "Answered" : "Unanswered"}
                      {ans?.flagged && " · ⚑"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {sync.pendingCount > 0 && (
            <p className="flex items-center gap-2 rounded-md bg-warning/15 p-3 text-sm">
              <CloudOff className="size-4 shrink-0" aria-hidden /> {sync.pendingCount} answer(s) still syncing. Submission waits until the server has them.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Keep working</Button>
            <Button onClick={submit} disabled={submitting || !sync.online}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {sync.online ? "Submit final answers" : "Reconnect to submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent className={cn("sm:max-w-md", themeClass)}>
          <DialogHeader>
            <DialogTitle>Save and leave the examination?</DialogTitle>
            <DialogDescription>
              Your answers are saved and the attempt stays open. Your timer keeps running on the server — you can return
              until time expires at <LocalTime value={new Date(expiresAt).toISOString()} mode="time" />. This does not submit your exam.
            </DialogDescription>
          </DialogHeader>
          {sync.pendingCount > 0 && (
            <p className="flex items-center gap-2 rounded-md bg-warning/15 p-3 text-sm">
              <CloudOff className="size-4 shrink-0" aria-hidden /> {sync.pendingCount} answer(s) are still syncing; they will be sent before you leave.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitOpen(false)} disabled={exiting}>Keep working</Button>
            <Button onClick={saveAndExit} disabled={exiting}>
              {exiting && <Loader2 className="size-4 animate-spin" aria-hidden />} Save & exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restored} onOpenChange={(o) => !o && setRestored(null)}>
        <DialogContent className={cn("sm:max-w-md", themeClass)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-success" aria-hidden /> Attempt restored — no time was added
            </DialogTitle>
            <DialogDescription>
              We picked up where you left off. {restored?.answered} of {restored?.total} answers are safely on the server, and any answers
              saved on this device are syncing now. Your deadline is set by the server and did not change:{" "}
              <strong className="text-foreground">{fmtClock(restored?.leftMs ?? 0)}</strong> left.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setRestored(null)}>Continue the examination</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className={cn("sm:max-w-sm", themeClass)}>
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Shortcuts are paused while you type in an answer box.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                </dt>
                <dd className="text-muted-foreground">{d}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>

      <Scratchpad attemptId={attemptId} open={scratchOpen} onOpenChange={setScratchOpen} readOnly={!isOpen} />
    </div>
  );
}

/** Controlled by the synced answer state, so recovered/refreshed answers always show the latest revision. */
function WrittenAnswer({ value, onChange, long }: { value: string; onChange: (v: string) => void; long: boolean }) {
  const text = value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div>
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={long ? 12 : 3}
        maxLength={20_000}
        placeholder={long ? "Write your answer…" : "Type your answer"}
        className="text-[inherit] leading-relaxed"
        aria-label="Your answer"
        spellCheck
      />
      <p className="mt-1.5 text-right text-xs text-muted-foreground tabular-nums">
        {words} words · {text.length.toLocaleString()} / 20,000 characters
      </p>
    </div>
  );
}

const PILL = {
  online: { label: "Online", cls: "bg-success/12 text-success" },
  unstable: { label: "Unstable", cls: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  reconnecting: { label: "Reconnecting", cls: "bg-chart-2/15 text-foreground" },
  offline: { label: "Offline", cls: "bg-destructive/10 text-destructive" },
} as const;

const SHORTCUTS = [
  ["N", "Next question"],
  ["P", "Previous question"],
  ["1 - 9", "Choose option 1 - 9"],
  ["F", "Mark / unmark for review"],
  ["?", "Show this help"],
  ["Tab", "Move between controls"],
] as const;

const TIMELINE_LABEL: Record<string, string> = {
  NETWORK_LOSS: "Connection lost",
  RECONNECTED: "Reconnected, answers synced",
  SYNC_FAILED: "Saving failed repeatedly (retried automatically)",
  ATTEMPT_RESUMED: "Attempt restored after reload or new tab",
  LATE_ANSWER_REJECTED: "Answers after the deadline were not accepted",
  AUTO_SUBMITTED: "Auto-submitted at the deadline",
};

function AnswerSaveState({ pending, online, hasAnswer }: { pending: boolean; online: boolean; hasAnswer: boolean }) {
  if (!hasAnswer) return null;
  if (pending)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-800 dark:text-amber-200">
        <CloudUpload className="size-3.5" aria-hidden /> {online ? "Saving to server…" : "Saved on this device, will sync"}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <Cloud className="size-3.5" aria-hidden /> Saved to server
    </span>
  );
}

function SyncIndicator({ sync }: { sync: ReturnType<typeof useAnswerSync> }) {
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const retryIn = sync.retryAt && clock ? Math.max(0, Math.ceil((sync.retryAt - clock) / 1000)) : 0;
  let icon = <CheckCircle2 className="size-4 text-success" aria-hidden />;
  let text = sync.lastSavedAt ? `All answers saved · ${sync.lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "All answers saved";
  if (sync.status === "saving") {
    icon = <Loader2 className="size-4 animate-spin" aria-hidden />;
    text = `Saving${sync.pendingCount ? ` ${sync.pendingCount} answer(s)` : ""}…`;
  } else if (sync.status === "offline") {
    icon = <WifiOff className="size-4 text-destructive" aria-hidden />;
    text = `Offline · ${sync.pendingCount} answer(s) waiting to sync`;
  } else if (sync.status === "retrying") {
    icon = <AlertTriangle className="size-4 text-warning-text" aria-hidden />;
    text = `Sync failed · ${sync.pendingCount} pending · retrying in ${retryIn}s`;
  } else if (sync.status === "closed") {
    icon = <AlertTriangle className="size-4 text-destructive" aria-hidden />;
    text = "Attempt closed";
  }
  const conn: keyof typeof PILL = !sync.online ? "offline" : sync.status === "offline" ? "reconnecting" : sync.status === "retrying" ? "unstable" : "online";
  return (
    <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", PILL[conn].cls)}>
        {conn === "offline" ? (
          <WifiOff className="size-3" aria-hidden />
        ) : conn === "reconnecting" ? (
          <RefreshCw className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <Wifi className="size-3" aria-hidden />
        )}
        {PILL[conn].label}
      </span>
      {icon}
      <span className="text-muted-foreground">{text}</span>
      {(sync.status === "retrying" || (sync.status === "offline" && sync.online)) && (
        <Button variant="ghost" size="sm" onClick={sync.retryNow}>
          <RefreshCw className="size-3.5" aria-hidden /> Retry now
        </Button>
      )}
    </div>
  );
}

/** A Set persisted in localStorage, read through useSyncExternalStore (SSR-safe, no setState in effects). */
function useStoredSet(key: string): [Set<string>, (next: Set<string>) => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener("ckz-storage", cb);
    return () => {
      window.removeEventListener("storage", cb);
      window.removeEventListener("ckz-storage", cb);
    };
  }, []);
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key) ?? "[]", () => "[]");
  const set = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const write = useCallback(
    (next: Set<string>) => {
      localStorage.setItem(key, JSON.stringify([...next]));
      window.dispatchEvent(new Event("ckz-storage"));
    },
    [key],
  );
  return [set, write];
}
