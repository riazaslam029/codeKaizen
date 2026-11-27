"use client";

import { CheckCircle2, CircleAlert, Copy, Download, FileUp, Loader2, UploadCloud, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Summary = {
  total: number;
  created: number;
  committed: boolean;
  dryRun: boolean;
  duplicates: { row: number; value: string; reason: string }[];
  errors: { row: number; field: string; message: string }[];
  preview: { row: number; label: string; status: "valid" | "duplicate" | "error" }[];
};

const MAX_BYTES = 1_000_000;

/**
 * Bulk import: choose or drop a CSV/JSON file → the server validates every row (dry run) → preview with
 * row statuses and an error table → import the valid rows in one transaction.
 */
export function ImportDialog({
  kind,
  title,
  description,
  sample,
  extra,
  extraValues,
}: {
  kind: "candidates" | "questions";
  title: string;
  description: ReactNode;
  sample: { name: string; content: string };
  extra?: ReactNode;
  extraValues?: () => Record<string, string | undefined>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<{ name: string; format: "csv" | "json"; content: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();

  const send = (body: Record<string, unknown>) =>
    fetch(`/api/import/${kind}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...(extraValues?.() ?? {}) }) });

  function load(f: File | undefined) {
    setSummary(null);
    if (!f) return;
    const name = f.name.toLowerCase();
    const format = name.endsWith(".json") ? "json" : name.endsWith(".csv") ? "csv" : null;
    if (!format) return void toast.error("Choose a .csv or .json file");
    if (f.size > MAX_BYTES) return void toast.error("File is larger than 1 MB");
    start(async () => {
      const content = await f.text();
      setFile({ name: f.name, format, content });
      const res = await send({ format, content, dryRun: true });
      const body = await res.json().catch(() => null);
      if (!res.ok) return void toast.error(body?.error?.message ?? "Could not read the file");
      setSummary(body);
    });
  }

  function commit() {
    if (!file) return;
    start(async () => {
      const res = await send({ format: file.format, content: file.content, skipInvalid: true });
      const body = await res.json().catch(() => null);
      if (!res.ok) return void toast.error(body?.error?.message ?? "Import failed");
      setSummary(body);
      if (body.committed) {
        toast.success(`Imported ${body.created} ${kind}`);
        router.refresh();
      } else toast.error("Nothing was imported");
    });
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    load(e.dataTransfer.files?.[0]);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([sample.content], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: sample.name });
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = summary?.preview.filter((p) => p.status === "valid").length ?? 0;
  const reset = () => {
    setFile(null);
    setSummary(null);
  };

  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); reset(); }}>
        <FileUp className="size-4" aria-hidden /> Import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={download}>
              <Download className="size-4" aria-hidden /> Download template ({sample.name})
            </Button>
            {file && (
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Choose another file
              </Button>
            )}
          </div>

          {!file && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose or drop a CSV or JSON file"
              onClick={() => input.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                dragging ? "border-primary bg-accent" : "hover:bg-muted/50",
              )}
            >
              {pending ? <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden /> : <UploadCloud className="size-7 text-muted-foreground" aria-hidden />}
              <p className="text-sm font-medium">Drop a .csv or .json file here, or click to browse</p>
              <p className="text-xs text-muted-foreground">Max 200 rows · 1 MB. Every row is validated before anything is saved.</p>
              <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" className="sr-only" onChange={(e) => load(e.target.files?.[0])} aria-label="File (.csv or .json)" />
            </div>
          )}

          {extra}

          {summary && (
            <div className="space-y-3" role="status">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="font-medium">{file?.name}</span>
                <span className="rounded bg-success/12 px-2 text-success">{validCount} valid</span>
                <span className="rounded bg-warning/15 px-2 text-[oklch(0.45_0.12_70)]">{summary.duplicates.length} duplicate</span>
                <span className="rounded bg-destructive/10 px-2 text-destructive">{new Set(summary.errors.map((e) => e.row)).size} with errors</span>
                {summary.committed && <span className="rounded bg-accent px-2 text-accent-foreground">Imported {summary.created}</span>}
              </div>
              <Tabs defaultValue={summary.errors.length ? "errors" : "preview"}>
                <TabsList>
                  <TabsTrigger value="preview">Rows ({summary.preview.length})</TabsTrigger>
                  <TabsTrigger value="errors">Errors ({summary.errors.length})</TabsTrigger>
                  <TabsTrigger value="duplicates">Duplicates ({summary.duplicates.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="preview">
                  <ScrollArea className="h-64 rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted text-left text-xs">
                        <tr>
                          <th className="px-3 py-2">Row</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Content</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.preview.map((p) => (
                          <tr key={p.row} className="border-t">
                            <td className="tabular px-3 py-1.5 text-muted-foreground">{p.row}</td>
                            <td className="px-3 py-1.5">
                              {p.status === "valid" ? (
                                <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" aria-hidden /> Valid</span>
                              ) : p.status === "duplicate" ? (
                                <span className="inline-flex items-center gap-1 text-[oklch(0.45_0.12_70)]"><Copy className="size-3.5" aria-hidden /> Duplicate</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="size-3.5" aria-hidden /> Error</span>
                              )}
                            </td>
                            <td className="max-w-0 truncate px-3 py-1.5">{p.label}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="errors">
                  {summary.errors.length === 0 ? (
                    <p className="flex items-center gap-2 py-4 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden /> No validation errors.</p>
                  ) : (
                    <ScrollArea className="h-64 rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted text-left text-xs">
                          <tr>
                            <th className="px-3 py-2">Row</th>
                            <th className="px-3 py-2">Field</th>
                            <th className="px-3 py-2">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.errors.map((e, i) => (
                            <tr key={i} className="border-t">
                              <td className="tabular px-3 py-1.5">{e.row}</td>
                              <td className="px-3 py-1.5 font-mono text-xs">{e.field}</td>
                              <td className="px-3 py-1.5 text-destructive">{e.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  )}
                </TabsContent>
                <TabsContent value="duplicates">
                  {summary.duplicates.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">No duplicates.</p>
                  ) : (
                    <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
                      {summary.duplicates.map((d, i) => (
                        <li key={i}>
                          Row {d.row}: {d.value} <span className="text-muted-foreground">({d.reason})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              </Tabs>
              {!summary.committed && summary.errors.length > 0 && validCount > 0 && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Rows with errors and duplicates are skipped. Fix them in the file and import again later if needed.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button onClick={commit} disabled={!summary || summary.committed || validCount === 0 || pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Import {validCount} valid row{validCount === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
