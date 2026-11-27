"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Starts an isolated sandbox attempt (never counted in results or analytics) and opens the candidate workspace. */
export function SandboxButton({ examId, disabled }: { examId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      title="Take the exam as a candidate would. Sandbox attempts never affect results."
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ examId }) });
          const body = await res.json().catch(() => null);
          if (!res.ok) {
            toast.error(body?.error?.message ?? "Could not start the sandbox");
            return;
          }
          router.push(`/attempt/${body.attemptId}`);
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FlaskConical className="size-4" aria-hidden />}
      Try as candidate
    </Button>
  );
}
