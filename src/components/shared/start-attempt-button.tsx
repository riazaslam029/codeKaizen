"use client";

import { Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Starts (or resumes) the candidate's attempt; the server decides eligibility and the deadline. */
export function StartAttemptButton({ examId, resume, size }: { examId: string; resume?: boolean; size?: "default" | "lg" | "sm" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ examId }) });
          const body = await res.json().catch(() => null);
          if (!res.ok) {
            toast.error(body?.error?.message ?? "Could not start the examination");
            router.refresh();
            return;
          }
          router.push(`/attempt/${body.attemptId}`);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
      {resume ? "Resume examination" : "Start examination"}
    </Button>
  );
}
