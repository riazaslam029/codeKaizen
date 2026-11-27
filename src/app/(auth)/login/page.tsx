import { ArrowLeft, LockKeyhole, ShieldCheck, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Brand } from "@/components/layout/brand";
import { Hero3DCanvas } from "@/components/motion/hero-3d-canvas";
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
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.08] bg-[#05070B] p-12 text-slate-200 lg:flex">
        <Hero3DCanvas variant="panel" className="opacity-80" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-[#0066FF]/14 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 size-80 rounded-full bg-[#7B3FF2]/12 blur-[120px]"
        />

        <div className="relative z-10 flex items-center justify-between">
          <Brand inverted />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 font-mono-code text-[11px] tracking-wider text-slate-300 uppercase transition-colors hover:border-[#0066FF]/60 hover:text-white"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Showcase
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono-code text-[11px] text-emerald-400">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
            SYS.OPERATIONAL /// TRACK 5.3
          </span>
          <h1 className="font-display mt-5 text-5xl leading-[0.95] font-bold tracking-[-0.03em] text-white uppercase">
            Examinations
            <span className="text-gradient-veyqora block">you can defend.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Author, schedule, deliver and grade assessments with role-based access, frozen marking schemes and a full
            incident trail.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              { icon: ShieldCheck, text: "Server-enforced roles for administrators, examiners and candidates" },
              { icon: LockKeyhole, text: "Answer keys never leave the server during an attempt" },
              {
                icon: Timer,
                text: "Failure-resilient exams: answers survive outages and refreshes, and the server-kept timer never grants extra time",
              },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[#0A0E1A]/85 p-3.5 backdrop-blur-sm transition-colors hover:border-[#0066FF]/40"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-[#4D94FF]" aria-hidden="true" />
                <span className="text-slate-200">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/[0.08] pt-5 font-mono-code text-[11px] text-slate-400">
          <span>TECHNOVERSE 5.0 · WEB-E-THON</span>
          <span>HS256 // SESSION_VERSION</span>
        </div>
      </section>

      <main id="main" className="flex items-center justify-center bg-background px-5 py-12 sm:px-8">
        <div className="ckz-reveal w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Brand />
            <Link
              href="/"
              className="inline-flex items-center gap-1 font-mono-code text-[11px] text-muted-foreground uppercase hover:text-foreground"
            >
              <ArrowLeft className="size-3" aria-hidden="true" /> Showcase
            </Link>
          </div>
          <span className="font-mono-code text-[11px] tracking-[0.18em] text-primary uppercase">ACCESS PORTAL</span>
          <h2 className="font-display mt-1.5 text-3xl font-bold tracking-tight">Sign in</h2>
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
