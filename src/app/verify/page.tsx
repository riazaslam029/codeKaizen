import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/layout/brand";
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
    <main className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="w-full max-w-md">
        <Brand className="mb-8" />
        <h1 className="text-2xl font-semibold">Verify a result report</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Enter the code printed on the PDF report (e.g. CKZ-7KQ2-M9XD-P4TA).</p>
        <form action={go} className="mt-6 space-y-3">
          <Label htmlFor="code">Verification code</Label>
          <Input id="code" name="code" className="font-mono uppercase" placeholder="CKZ-XXXX-XXXX-XXXX" autoComplete="off" required maxLength={24} />
          <Button type="submit" className="w-full">Verify</Button>
        </form>
      </div>
    </main>
  );
}
