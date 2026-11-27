import { ArrowLeft, QrCode, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/layout/brand";
import { Hero3DCanvas } from "@/components/motion/hero-3d-canvas";
import { Tilt3D } from "@/components/motion/tilt-3d";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Verify a result report" };

async function go(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 24);
  redirect(`/verify/${encodeURIComponent(code || "-")}`);
}

/** Public page — no sign-in. Confirms a printed report's verification code. */
export default function VerifyPage() {
  return (
    <main id="main" className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-5 py-12">
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <Hero3DCanvas variant="panel" className="opacity-55" />
      </div>
      <div className="ckz-reveal relative z-10 w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Brand />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono-code text-xs text-muted-foreground uppercase hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Home
          </Link>
        </div>

        <Tilt3D maxTilt={4} className="rounded-2xl border bg-card p-6 shadow-xl sm:p-8">
          <div className="flex items-center gap-2 font-mono-code text-[11px] tracking-[0.18em] text-primary uppercase">
            <QrCode className="size-3.5" aria-hidden="true" /> CRYPTOGRAPHIC REPORT CHECK
          </div>
          <h1 className="font-display mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Verify a result report</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the code printed on the PDF report (e.g. <span className="font-mono-code text-foreground">CKZ-7KQ2-M9XD-P4TA</span>).
          </p>
          <form action={go} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                name="code"
                className="font-mono-code h-11 uppercase tracking-wider"
                placeholder="CKZ-XXXX-XXXX-XXXX"
                autoComplete="off"
                required
                maxLength={24}
              />
            </div>
            <Button type="submit" className="h-11 w-full font-mono-code text-xs tracking-wider uppercase">
              Verify Report
            </Button>
          </form>
          <p className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
            Privacy-safe lookup: candidate names and scores are never exposed publicly.
          </p>
        </Tilt3D>
      </div>
    </main>
  );
}
