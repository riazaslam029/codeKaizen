import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <Brand className="mb-10" />
      <span className="rounded-full bg-accent p-3 text-accent-foreground">
        <FileQuestion className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page does not exist, or you do not have access to it. Records that belong to other users are never shown.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Go to your dashboard</Link>
      </Button>
    </main>
  );
}
