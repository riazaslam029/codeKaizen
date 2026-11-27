import { Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { UserService } from "@/services/users/user.service";

export const metadata: Metadata = { title: "Roles & permissions" };

/** Mirrors the server-side checks in lib/permissions and the DAL — this page documents, the server enforces. */
const MATRIX: { capability: string; admin: boolean | string; examiner: boolean | string; candidate: boolean | string }[] = [
  { capability: "Create, edit, activate or deactivate accounts", admin: true, examiner: "Candidates only (create)", candidate: false },
  { capability: "Assign roles", admin: "Others only, never self", examiner: false, candidate: false },
  { capability: "Author questions in the shared bank", admin: true, examiner: "Edit own questions", candidate: false },
  { capability: "Create, schedule and publish examinations", admin: true, examiner: "Own exams", candidate: false },
  { capability: "Enrol candidates", admin: true, examiner: "Own exams", candidate: false },
  { capability: "Preview an exam in the sandbox", admin: true, examiner: "Own exams", candidate: false },
  { capability: "Monitor attempts & review indicators", admin: true, examiner: "Own exams", candidate: false },
  { capability: "Grade written answers & publish results", admin: true, examiner: "Own exams", candidate: false },
  { capability: "Sit enrolled examinations", admin: false, examiner: false, candidate: "Within the window" },
  { capability: "View results & download PDF reports", admin: true, examiner: "Own exams", candidate: "Own, once published" },
  { capability: "See answer keys", admin: true, examiner: true, candidate: false },
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check className="size-4 text-success" aria-label="Allowed" />;
  if (v === false) return <Minus className="size-4 text-muted-foreground" aria-label="Not allowed" />;
  return <span className="text-sm">{v}</span>;
}

export default async function RolesPage() {
  await requireRole("ADMIN");
  const counts = await UserService.countByRole();
  return (
    <>
      <PageHeader title="Roles & permissions" description="Three fixed roles. Permissions are enforced on the server for every page and API call; hiding UI is never relied on." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["ADMIN", "Administrators", "Manage people and access across the platform."],
            ["EXAMINER", "Examiners", "Author, deliver, monitor and grade their examinations."],
            ["CANDIDATE", "Candidates", "Sit examinations they are enrolled in and view published results."],
          ] as const
        ).map(([key, label, text]) => (
          <Card key={key} className="gap-2 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between text-base">
                {label} <span className="tabular text-2xl font-semibold">{counts[key]}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{text}</CardContent>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden py-0 shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-5">Capability</TableHead>
              <TableHead>Administrator</TableHead>
              <TableHead>Examiner</TableHead>
              <TableHead className="pr-5">Candidate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MATRIX.map((m) => (
              <TableRow key={m.capability}>
                <TableCell className="pl-5 font-medium whitespace-normal">{m.capability}</TableCell>
                <TableCell><Cell v={m.admin} /></TableCell>
                <TableCell><Cell v={m.examiner} /></TableCell>
                <TableCell className="pr-5"><Cell v={m.candidate} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-4 text-sm text-muted-foreground">
        Change a person&apos;s role from <Link href="/admin/users" className="font-medium text-primary hover:underline">Users</Link>. Administrators cannot change their own role or deactivate themselves.
      </p>
    </>
  );
}
