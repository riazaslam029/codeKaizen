"use client";

import { Eraser, Loader2, PenLine, Plus, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ScratchPage, ScratchpadData, ScratchStroke } from "@/db/schema/types";
import { cn } from "@/lib/utils";

const newPage = (n: number): ScratchPage => ({ id: crypto.randomUUID().slice(0, 8), title: `Page ${n}`, notes: "", strokes: [] });

/**
 * Digital scratchpad: multiple pages of typed notes + freehand drawing (mouse, pen or touch),
 * with undo and clear. Stored in its own table — completely separate from answers and never graded.
 */
export function Scratchpad({ attemptId, open, onOpenChange, readOnly }: { attemptId: string; open: boolean; onOpenChange: (o: boolean) => void; readOnly: boolean }) {
  const [data, setData] = useState<ScratchpadData | null>(null);
  const [active, setActive] = useState(0);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    fetch(`/api/attempts/${attemptId}/scratchpad`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setData(b?.data ?? { pages: [newPage(1)] }))
      .catch(() => setData({ pages: [newPage(1)] }));
  }, [open, attemptId]);

  const save = useCallback(
    (next: ScratchpadData) => {
      setData(next);
      if (readOnly) return;
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const r = await fetch(`/api/attempts/${attemptId}/scratchpad`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
          setSaveState(r.ok ? "saved" : "error");
        } catch {
          setSaveState("error");
        }
      }, 1200);
    },
    [attemptId, readOnly],
  );

  const page = data?.pages[active];
  const setPage = (patch: Partial<ScratchPage>) => {
    if (!data || !page) return;
    save({ pages: data.pages.map((p, i) => (i === active ? { ...p, ...patch } : p)) });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>Scratchpad</SheetTitle>
          <SheetDescription>
            Private rough work. Not part of your answers and never graded.{" "}
            <span aria-live="polite" className="font-medium">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved — will retry on next change" : ""}
            </span>
          </SheetDescription>
        </SheetHeader>
        {!data || !page ? (
          <div className="flex flex-1 items-center justify-center p-10 text-muted-foreground"><Loader2 className="size-5 animate-spin" aria-label="Loading scratchpad" /></div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Scratchpad pages">
              {data.pages.map((p, i) => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                  className={cn("rounded-md px-3 py-1.5 text-sm", i === active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70")}
                >
                  {p.title}
                </button>
              ))}
              {!readOnly && data.pages.length < 5 && (
                <Button variant="ghost" size="sm" onClick={() => { save({ pages: [...data.pages, newPage(data.pages.length + 1)] }); setActive(data.pages.length); }}>
                  <Plus className="size-4" aria-hidden /> Page
                </Button>
              )}
            </div>
            <Textarea
              value={page.notes}
              readOnly={readOnly}
              onChange={(e) => setPage({ notes: e.target.value })}
              rows={5}
              placeholder="Type notes…"
              aria-label={`${page.title} notes`}
            />
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant={tool === "pen" ? "default" : "outline"} onClick={() => setTool("pen")} aria-pressed={tool === "pen"} disabled={readOnly}>
                <PenLine className="size-4" aria-hidden /> Pen
              </Button>
              <Button size="sm" variant={tool === "eraser" ? "default" : "outline"} onClick={() => setTool("eraser")} aria-pressed={tool === "eraser"} disabled={readOnly}>
                <Eraser className="size-4" aria-hidden /> Eraser
              </Button>
              <Button size="sm" variant="outline" className="ml-auto" disabled={readOnly || page.strokes.length === 0} onClick={() => setPage({ strokes: page.strokes.slice(0, -1) })}>
                <Undo2 className="size-4" aria-hidden /> Undo
              </Button>
              <Button size="sm" variant="outline" disabled={readOnly || (page.strokes.length === 0 && !page.notes)} onClick={() => setPage({ strokes: [], notes: "" })}>
                <Trash2 className="size-4" aria-hidden /> Clear page
              </Button>
            </div>
            <DrawingCanvas strokes={page.strokes} tool={tool} readOnly={readOnly} onStroke={(s) => setPage({ strokes: [...page.strokes, s] })} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Strokes are stored in normalised [0..1] coordinates so drawings survive resizing and devices. */
function DrawingCanvas({ strokes, tool, readOnly, onStroke }: { strokes: ScratchStroke[]; tool: "pen" | "eraser"; readOnly: boolean; onStroke: (s: ScratchStroke) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef<ScratchStroke | null>(null);
  const HEIGHT = 380;

  const redraw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    if (c.width !== w * dpr) {
      c.width = w * dpr;
      c.height = HEIGHT * dpr;
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, HEIGHT);
    const all = current.current ? [...strokes, current.current] : strokes;
    for (const s of all) {
      if (s.points.length < 1) continue;
      ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
      ctx.strokeStyle = getComputedStyle(c).color;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * HEIGHT) : ctx.moveTo(x * w, y * HEIGHT)));
      if (s.points.length === 1) ctx.lineTo(s.points[0]![0] * w + 0.1, s.points[0]![1] * HEIGHT);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }, [strokes]);

  useEffect(() => {
    redraw();
    const ro = new ResizeObserver(redraw);
    if (canvas.current) ro.observe(canvas.current);
    return () => ro.disconnect();
  }, [redraw]);

  const point = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000, Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000];
  };

  return (
    <canvas
      ref={canvas}
      aria-label="Drawing area. Use a mouse, pen or finger to sketch."
      role="img"
      className={cn("w-full rounded-md border bg-card text-foreground", readOnly ? "cursor-not-allowed" : "cursor-crosshair")}
      style={{ height: HEIGHT, touchAction: "none" }}
      onPointerDown={(e) => {
        if (readOnly) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        current.current = { points: [point(e)], width: tool === "eraser" ? 18 : 2.5, erase: tool === "eraser" || undefined };
        redraw();
      }}
      onPointerMove={(e) => {
        if (!current.current) return;
        if (current.current.points.length < 4900) current.current.points.push(point(e));
        redraw();
      }}
      onPointerUp={() => {
        if (current.current) onStroke(current.current);
        current.current = null;
      }}
      onPointerCancel={() => {
        current.current = null;
        redraw();
      }}
    />
  );
}
