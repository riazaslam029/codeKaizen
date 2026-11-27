"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type Summary = {
  total: number;
  created: number;
  committed: boolean;
  duplicates: { row: number; value: string; reason: string }[];
  errors: { row: number; message: string }[];
};

/** CSV/JSON upload → server validates every row → all-or-nothing insert → summary shown here. */
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
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!file) return;
    const format = file.name.toLowerCase().endsWith(".json") ? "json" : file.name.toLowerCase().endsWith(".csv") ? "csv" : null;
    if (!format) return void toast.error("Choose a .csv or .json file");
    if (file.size > 1_000_000) return void toast.error("File is larger than 1 MB");
    start(async () => {
      const content = await file.text();
      const res = await fetch(`/api/import/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format, content, ...(extraValues?.() ?? {}) }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Import failed");
        return;
      }
      setSummary(body);
      if (body.committed) {
        toast.success(`Imported ${body.created} ${kind}`);
        router.refresh();
      } else toast.error(body.errors.length ? "Nothing imported — fix the errors and retry" : "Nothing new to import");
    });
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([sample.content], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: sample.name });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); setSummary(null); setFile(null); }}>
        <FileUp className="size-4" aria-hidden /> Import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>
          <button type="button" onClick={download} className="w-fit text-sm font-medium text-primary hover:underline">
            Download a sample file ({sample.name})
          </button>
          <div className="space-y-1.5">
            <Label htmlFor={`file-${kind}`}>File (.csv or .json, max 200 rows / 1 MB)</Label>
            <Input id={`file-${kind}`} type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSummary(null); }} />
          </div>
          {extra}
          {summary && (
            <div className="rounded-md border p-3 text-sm" role="status">
              <p className="font-medium">
                {summary.committed ? `Imported ${summary.created} of ${summary.total} rows.` : `Nothing was imported (${summary.total} rows checked).`}
              </p>
              {(summary.errors.length > 0 || summary.duplicates.length > 0) && (
                <ScrollArea className="mt-2 max-h-48">
                  <ul className="space-y-1 text-xs">
                    {summary.errors.map((e, i) => (
                      <li key={`e${i}`} className="text-destructive">Row {e.row}: {e.message}</li>
                    ))}
                    {summary.duplicates.map((d, i) => (
                      <li key={`d${i}`} className="text-muted-foreground">Row {d.row}: skipped duplicate — {d.value} ({d.reason})</li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={submit} disabled={!file || pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Validate & import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
