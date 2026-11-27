"use client";

import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { ImportDialog } from "@/components/shared/import-dialog";
import { LocalTime } from "@/components/shared/local-time";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createCandidateAction } from "../actions";

type C = { id: string; name: string; email: string; isActive: boolean; enrolments: number; createdAt: string };

const SAMPLE = `name,email,password
Aisha Khan,aisha.khan@example.test,
Bilal Ahmed,bilal.ahmed@example.test,Strong-Pass-123
`;

export function CandidateDirectory({ candidates, exams }: { candidates: C[]; exams: { id: string; label: string }[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const defaultPw = useRef("");
  const [examId, setExamId] = useState("NONE");
  const shown = candidates.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase()));

  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    start(async () => {
      const r = await createCandidateAction(fd);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input placeholder="Search candidates" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" aria-label="Search candidates" />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <ImportDialog
            kind="candidates"
            title="Import candidates"
            description={
              <>
                CSV or JSON with <code>name, email</code> and optional <code>password</code>. Rows without a password use the default below. Existing emails and
                repeats are skipped; any invalid row stops the whole import.
              </>
            }
            sample={{ name: "candidates-sample.csv", content: SAMPLE }}
            extraValues={() => ({ defaultPassword: defaultPw.current || undefined, examId: examId === "NONE" ? undefined : examId })}
            extra={
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="imp-pw" label="Default password" hint="Min 8 characters.">
                  <Input id="imp-pw" type="password" autoComplete="new-password" onChange={(e) => (defaultPw.current = e.target.value)} />
                </Field>
                <Field id="imp-exam" label="Also enrol in">
                  <Select value={examId} onValueChange={setExamId}>
                    <SelectTrigger id="imp-exam" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Don&apos;t enrol</SelectItem>
                      {exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            }
          />
          <Button onClick={() => { setErrors({}); setOpen(true); }}>
            <UserPlus className="size-4" aria-hidden /> New candidate
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Users} title={candidates.length ? "No matches" : "No candidates yet"} description="Create candidates individually or import a file." />
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Candidate</TableHead>
                <TableHead className="text-right">Enrolments</TableHead>
                <TableHead className="hidden pr-5 md:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((c) => (
                <TableRow key={c.id} className={c.isActive ? undefined : "bg-muted/40"}>
                  <TableCell className="pl-5">
                    <span className="block font-medium">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">{c.email}{!c.isActive && " · disabled"}</span>
                  </TableCell>
                  <TableCell className="tabular text-right">{c.enrolments}</TableCell>
                  <TableCell className="hidden pr-5 text-sm text-muted-foreground md:table-cell"><LocalTime value={c.createdAt} mode="date" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New candidate</DialogTitle>
            <DialogDescription>Creates a candidate account. Enrol them from an examination&apos;s Candidates tab.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-4" noValidate>
            <Field id="c-name" label="Full name" error={errors.name}><Input id="c-name" name="name" /></Field>
            <Field id="c-email" label="Email" error={errors.email}><Input id="c-email" name="email" type="email" /></Field>
            <Field id="c-pw" label="Initial password" error={errors.password} hint="At least 8 characters."><Input id="c-pw" name="password" type="password" autoComplete="new-password" /></Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
