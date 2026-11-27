"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Client-side pagination for already-loaded lists. Resets to page 1 whenever `resetKey` changes (e.g. a filter). */
export function usePagination<T>(items: T[], pageSize = 20, resetKey = "") {
  const [state, setState] = useState({ page: 1, key: resetKey });
  const page = state.key === resetKey ? state.page : 1;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages);
  const slice = items.slice((current - 1) * pageSize, current * pageSize);
  const setPage = (p: number) => setState({ page: Math.min(Math.max(1, p), pages), key: resetKey });
  return { slice, page: current, pages, setPage, total: items.length, from: items.length ? (current - 1) * pageSize + 1 : 0, to: (current - 1) * pageSize + slice.length };
}

export function Pagination({ page, pages, setPage, total, from, to, noun = "items" }: ReturnType<typeof usePagination<unknown>> & { noun?: string }) {
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="tabular">
        {from}–{to} of {total} {noun}
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1} aria-label="Previous page">
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <span className="tabular px-2" aria-live="polite">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === pages} aria-label="Next page">
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </nav>
  );
}
