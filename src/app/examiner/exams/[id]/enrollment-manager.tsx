"use client";

import { Loader2, Search, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { enrollAction, setEnrollmentStatusAction } from "../../actions";

type Enrolled = { enrollmentId: string; status: "ENROLLED" | "WITHDRAWN" | "BLOCKED"; candidateId: string; name: string; email: string; isActive: boolean };
type Candidate = { id: string; name: string; email: string; isActive: boolean };

export function EnrollmentManager({ examId, enrolled, candidates }: { examId: string; enrolled: Enrolled[]; candidates: Candidate[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const enrolledIds = useMemo(() => new Set(enrolled.filter((e) => e.status === "ENROLLED").map((e) => e.candidateId)), [enrolled]);
  const available = candidates.filter((c) => c.isActive && !enrolledIds.has(c.id) && `${c.name} ${c.email}`.toLowerCase().includes(query.toLowerCase()));

  function enroll() {
    start(async () => {
      const r = await enrollAction(examId, [...picked]);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${r.data.enrolled} candidate(s) enrolled`);
      setPicked(new Set());
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Only enrolled, active candidates may enter. Blocked or withdrawn candidates are refused by the server.</p>
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="size-4" aria-hidden /> Enrol candidates
        </Button>
      </div>
      {enrolled.length === 0 ? (
        <EmptyState icon={Users} title="Nobody is enrolled" description="Enrol existing candidates, or import a CSV from the Candidates page." />
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Candidate</TableHead>
                <TableHead className="pr-5 text-right">Enrolment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrolled.map((e) => (
                <TableRow key={e.enrollmentId}>
                  <TableCell className="pl-5">
                    <span className="block font-medium">{e.name}</span>
                    <span className="block text-xs text-muted-foreground">{e.email}{!e.isActive && " · account disabled"}</span>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Select
                      value={e.status}
                      disabled={pending}
                      onValueChange={(v) =>
                        start(async () => {
                          const r = await setEnrollmentStatusAction(e.enrollmentId, v);
                          if (!r.ok) toast.error(r.error);
                          else {
                            toast.success(r.message);
                            router.refresh();
                          }
                        })
                      }
                    >
                      <SelectTrigger size="sm" className="ml-auto w-36" aria-label={`Enrolment status for ${e.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ENROLLED">Enrolled</SelectItem>
                        <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                        <SelectItem value="BLOCKED">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enrol candidates</DialogTitle>
            <DialogDescription>Select active candidate accounts to enrol.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input placeholder="Search candidates" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" aria-label="Search candidates" />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{available.length} available</span>
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => setPicked(new Set(available.map((c) => c.id)))}>
              Select all shown
            </button>
          </div>
          <ScrollArea className="h-72 rounded-md border">
            <ul className="divide-y">
              {available.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Everyone shown is already enrolled.</li>}
              {available.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/50">
                    <Checkbox
                      checked={picked.has(c.id)}
                      onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); if (v) n.add(c.id); else n.delete(c.id); return n; })}
                    />
                    <span>
                      <span className="block text-sm font-medium">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{c.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={picked.size === 0 || pending} onClick={enroll}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Enrol {picked.size || ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
