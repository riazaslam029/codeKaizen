"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Route-level error boundary: friendly message + retry. No stack traces or internals are shown. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center" role="alert">
      <span className="rounded-full bg-destructive/10 p-3 text-destructive">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The page could not be loaded. Your data is safe — if you were sitting an exam, your saved answers and the server-side timer are unaffected.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" aria-hidden /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
