import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <Brand className="mb-10" />
      <span className="rounded-2xl border bg-accent p-3.5 text-accent-foreground">
        <FileQuestion className="size-6" aria-hidden />
      </span>
      <span className="font-mono-code mt-5 text-xs tracking-[0.2em] text-primary uppercase">HTTP 404 // ROUTE ISOLATED</span>
      <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page does not exist, or you do not have access to it. Records that belong to other users are never shown.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go to your dashboard</Link>
      </Button>
    </main>
  );
}
