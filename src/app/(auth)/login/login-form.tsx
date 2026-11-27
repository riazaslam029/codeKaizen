"use client";

import { AlertCircle, ArrowBigUp, Eye, EyeOff, Info, Loader2, ShieldAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESTRICTED_MESSAGE } from "@/lib/auth/token";
import { loginSchema } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<Record<"email" | "password", string>>;
type Notice = { kind: "error" | "restricted" | "info"; text: string };

const REASON_NOTICE: Record<string, Notice> = {
  restricted: { kind: "restricted", text: RESTRICTED_MESSAGE },
  revoked: { kind: "info", text: "Your session ended because your account was changed by an administrator. Please sign in again." },
  expired: { kind: "info", text: "Your session expired. Please sign in again." },
};

/** Only allow same-site relative redirects (blocks open-redirects like ?next=https://evil.example). */
function safeNext(next: string | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function LoginForm({ demo }: { demo?: { label: string; email: string; password: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<Notice | null>(() => REASON_NOTICE[params.get("reason") ?? ""] ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] as keyof FieldErrors] ??= issue.message;
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const code = body?.error?.code;
        setNotice(
          code === "ACCOUNT_RESTRICTED"
            ? { kind: "restricted", text: RESTRICTED_MESSAGE }
            : { kind: "error", text: body?.error?.message ?? "Sign-in failed. Please try again." },
        );
        return;
      }
      toast.success(`Signed in as ${body.user.name}`);
      const next = safeNext(params.get("next"));
      router.replace(next && next.startsWith(body.redirectTo) ? next : body.redirectTo);
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "Network error. Check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  const NoticeIcon = notice?.kind === "restricted" ? ShieldAlert : notice?.kind === "info" ? Info : AlertCircle;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
      {notice && (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm",
            notice.kind === "info" ? "border-primary/30 bg-accent text-accent-foreground" : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          <NoticeIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{notice.text}</span>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="h-10"
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={onKey}
            onKeyDown={onKey}
            aria-invalid={!!errors.password}
            aria-describedby={[errors.password && "password-error", capsLock && "caps-hint"].filter(Boolean).join(" ") || undefined}
            className="h-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {capsLock && (
          <p id="caps-hint" className="flex items-center gap-1.5 text-xs text-warning-text">
            <ArrowBigUp className="size-3.5" aria-hidden /> Caps Lock is on
          </p>
        )}
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password}
          </p>
        )}
      </div>
      <Button type="submit" className="h-10 w-full" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
      {demo && demo.length > 0 && (
        <div className="rounded-md border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">Demo accounts — fill the form:</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {demo.map((d) => (
              <Button
                key={d.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                  setErrors({});
                  setNotice(null);
                }}
              >
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
