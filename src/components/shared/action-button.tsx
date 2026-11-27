"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-types";

type Props = {
  action: () => Promise<ActionResult<unknown>>;
  children: ReactNode;
  confirm?: { title: string; description: string; confirmLabel?: string; destructive?: boolean };
  successMessage?: (data: unknown) => string | undefined;
} & Omit<ComponentProps<typeof Button>, "onClick" | "action">;

/** Runs a (bound) server action with optional confirmation, toasts the outcome and refreshes server data. */
export function ActionButton({ action, children, confirm, successMessage, ...button }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function run() {
    start(async () => {
      const r = await action();
      setOpen(false);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const msg = successMessage?.(r.data) ?? r.message;
      if (msg) toast.success(msg);
      router.refresh();
    });
  }

  const btn = (
    <Button {...button} disabled={pending || button.disabled} onClick={confirm ? () => setOpen(true) : run}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
  if (!confirm) return btn;
  return (
    <>
      {btn}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                run();
              }}
              disabled={pending}
              className={confirm.destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {confirm.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
