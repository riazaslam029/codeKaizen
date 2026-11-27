"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  CloudOff,
  FlaskConical,
  Loader2,
  Megaphone,
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

  const themeClass = prefs.theme === "dark" ? "dark" : prefs.theme === "contrast" ? "contrast" : "";
  const timeTone = left <= 60_000 ? "text-destructive" : left <= 5 * 60_000 ? "text-[oklch(0.55_0.15_60)]" : "";
  const announcedThreshold = useMemo(() => (left <= 60_000 ? "1 minute remaining" : left <= 5 * 60_000 ? "5 minutes remaining" : ""), [left]);

  /* ───────────────────────── finished ───────────────────────── */
  if (!isOpen) {
    return (
      <div className={cn("min-h-dvh bg-background text-foreground", themeClass)}>
        <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
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
          return (
            <li key={x.questionId}>
              <button
                onClick={() => setIndex(i)}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Question ${i + 1}: ${done ? "answered" : "unanswered"}${ans?.flagged ? ", marked for review" : ""}`}
                className={cn(
                  "tabular relative flex h-9 w-full items-center justify-center rounded-md border text-sm font-medium transition-colors",
                  done ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  i === index && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
              >
                {i + 1}
                {ans?.flagged && <span className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-background bg-warning" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-2"><span className="size-3 rounded-sm bg-primary" aria-hidden /> Answered</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded-sm border bg-card" aria-hidden /> Not answered</li>
        <li className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-warning" aria-hidden /> Marked for review ({flaggedCount})</li>
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
            <div className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-base font-semibold tabular-nums", timeTone)} role="timer" aria-label={`Time remaining ${fmtClock(left)}`}>
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
            You are offline. Keep working — answers are kept on this device and will sync automatically. The timer keeps running on the server.
          </p>
        </div>
      )}

      <div className={cn("mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6", showSide ? "lg:grid-cols-[15rem_1fr]" : "max-w-3xl")}>
        {showSide && <aside className="hidden lg:block"><div className="sticky top-24">{navigator}</div></aside>}

        <main className={cn("min-w-0", FONT[prefs.fontSize])}>
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
              {answered(a) && (
                <Button variant="ghost" size="sm" onClick={() => sync.update(q.questionId, { response: null })}>
                  Clear answer
                </Button>
              )}
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

      <Scratchpad attemptId={attemptId} open={scratchOpen} onOpenChange={setScratchOpen} readOnly={!isOpen} />
    </div>
  );
}

function WrittenAnswer({ value, onChange, long }: { value: string; onChange: (v: string) => void; long: boolean }) {
  const [text, setText] = useState(value);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div>
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
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
    icon = <AlertTriangle className="size-4 text-[oklch(0.55_0.15_60)]" aria-hidden />;
    text = `Sync failed · ${sync.pendingCount} pending · retrying in ${retryIn}s`;
  } else if (sync.status === "closed") {
    icon = <AlertTriangle className="size-4 text-destructive" aria-hidden />;
    text = "Attempt closed";
  }
  return (
    <div className="flex items-center gap-2 text-sm" role="status" aria-live="polite">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", sync.online ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive")}>
        {sync.online ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
        {sync.online ? "Online" : "Offline"}
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
