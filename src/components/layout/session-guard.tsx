"use client";

import { ShieldAlert, TimerOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Reason = "restricted" | "revoked" | "expired";

const COPY: Record<Reason, { title: string; body: string }> = {
  restricted: {
    title: "Your access was restricted by an administrator",
    body: "You have been signed out. Anything you saved is preserved. Contact your institution if you think this is a mistake.",
  },
  revoked: { title: "Your session has ended", body: "An administrator changed your account. Please sign in again." },
  expired: { title: "Your session has expired", body: "Please sign in again to continue." },
};

const POLL_MS = 45_000;
const WARN_BEFORE_MS = 10 * 60_000;

/**
 * Global session guard for signed-in screens:
 * - intercepts every same-origin API response; ACCOUNT_RESTRICTED (403) or a 401 ends the session in the UI;
 * - revalidates /api/auth/me every 45 s and whenever the tab regains focus, so an idle page also notices;
 * - warns 10 minutes before the session expires.
 * The server enforces all of this independently; this only makes it visible immediately.
 */
export function SessionGuard() {
  const [reason, setReason] = useState<Reason | null>(null);
  const tripped = useRef(false);
  const warned = useRef(false);

  useEffect(() => {
    const trip = (r: Reason) => {
      if (tripped.current) return;
      tripped.current = true;
      setReason(r);
      // A full navigation is required: the sign-out ROUTE HANDLER clears the HTTP-only cookie.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      setTimeout(() => window.location.assign(`/api/auth/signout?reason=${r}`), 8_000);
    };

    const original = window.fetch;
    window.fetch = async (input, init) => {
      const res = await original(input, init);
      try {
        const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
        if (url.origin === window.location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/login") && (res.status === 401 || res.status === 403)) {
          const body = await res.clone().json().catch(() => null);
          const code = body?.error?.code;
          if (code === "ACCOUNT_RESTRICTED") trip("restricted");
          else if (code === "SESSION_REVOKED") trip("revoked");
          else if (res.status === 401) trip("expired");
        }
      } catch {
        /* never let the guard break a request */
      }
      return res;
    };

    const check = async () => {
      if (document.visibilityState !== "visible" || tripped.current) return;
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return; // the interceptor above handles 401/403
        const body = (await res.json()) as { sessionExpiresAt: string | null };
        const left = body.sessionExpiresAt ? Date.parse(body.sessionExpiresAt) - Date.now() : Infinity;
        if (left < WARN_BEFORE_MS && !warned.current) {
          warned.current = true;
          toast.warning(`Your session expires in about ${Math.max(1, Math.round(left / 60_000))} minutes. Save your work and sign in again.`, { duration: 15_000 });
        }
      } catch {
        /* offline: the exam workspace has its own connectivity handling */
      }
    };
    const poll = setInterval(check, POLL_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.fetch = original;
      clearInterval(poll);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!reason) return null;
  const c = COPY[reason];
  const Icon = reason === "restricted" ? ShieldAlert : TimerOff;
  return (
    <AlertDialog open>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className="size-5 text-destructive" aria-hidden /> {c.title}
          </AlertDialogTitle>
          <AlertDialogDescription>{c.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination -- route handler must clear the HTTP-only cookie */}
          <AlertDialogAction onClick={() => window.location.assign(`/api/auth/signout?reason=${reason}`)}>Go to sign in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
