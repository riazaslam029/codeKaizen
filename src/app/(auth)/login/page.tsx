import { LockKeyhole, ShieldCheck, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/layout/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Demo quick-fill buttons appear only when DEMO_LOGIN_PASSWORD is configured for this deployment
 * (e.g. during judging). Leave it unset to hide demo credentials entirely.
 */
function demoAccounts() {
  const password = process.env.DEMO_LOGIN_PASSWORD;
  if (!password) return undefined;
  return [
    { label: "Admin", email: "admin@codekaizen.test", password },
    { label: "Examiner", email: "d.reyes@codekaizen.test", password },
    { label: "Candidate", email: "lena.fischer@codekaizen.test", password },
  ];
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        {/* Faint ruled-paper lines: a quiet nod to an exam script, not decoration for its own sake. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, white 0 1px, transparent 1px 32px)" }}
        />
        <Brand inverted className="relative" />
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight text-sidebar-accent-foreground">
            Examinations you can defend.
          </h1>
          <p className="mt-4 text-base leading-relaxed">
            Author, schedule, deliver and grade assessments with role-based access, frozen marking schemes and a full
            incident trail.
          </p>
          <ul className="mt-10 space-y-4 text-sm">
            {[
              { icon: ShieldCheck, text: "Server-enforced roles for administrators, examiners and candidates" },
              { icon: LockKeyhole, text: "Answer keys never leave the server during an attempt" },
              { icon: Timer, text: "Failure-resilient exams: answers survive outages and refreshes, and the server-kept timer never grants extra time" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-sidebar-primary" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative font-mono text-xs text-sidebar-foreground/90">TechnoVerse 5.0 · Web-e-Thon</p>
      </section>

      <main id="main" className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Brand className="mb-10 lg:hidden" />
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">Use the account issued by your institution.</p>
          <Suspense>
            <LoginForm demo={demoAccounts()} />
          </Suspense>
          <p className="mt-8 border-t pt-5 text-sm text-muted-foreground">
            Checking a result report?{" "}
            <Link href="/verify" className="font-medium text-primary hover:underline">
              Verify a report
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
