"use client";

import { Loader2, Plus, Search, UserRoundPen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Field } from "@/components/shared/field";
import { LocalTime } from "@/components/shared/local-time";
import { Pagination, usePagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { changeRoleAction, createUserAction, setActiveAction, updateUserAction } from "./actions";

type Role = "ADMIN" | "EXAMINER" | "CANDIDATE";
type U = { id: string; name: string; email: string; role: Role; isActive: boolean; lastLoginAt: string | null };

export function UsersManager({ users, currentUserId }: { users: U[]; currentUserId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [editing, setEditing] = useState<U | "new" | null>(null);
  const [pending, start] = useTransition();

  const shown = useMemo(
    () =>
      users.filter(
        (u) =>
          (roleFilter === "ALL" || u.role === roleFilter) &&
          (u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())),
      ),
    [users, query, roleFilter],
  );

  const pager = usePagination(shown, 20, `${query}|${roleFilter}`);

  function act(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        if (r.message) toast.success(r.message);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" aria-label="Search users" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "ALL" | Role)}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value="ADMIN">Administrators</SelectItem>
            <SelectItem value="EXAMINER">Examiners</SelectItem>
            <SelectItem value="CANDIDATE">Candidates</SelectItem>
          </SelectContent>
        </Select>
        <Button className="sm:ml-auto" onClick={() => setEditing("new")}>
          <Plus className="size-4" aria-hidden /> New user
        </Button>
      </div>

      <Card className="overflow-hidden py-0 shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Active</TableHead>
              <TableHead className="hidden lg:table-cell">Last sign-in</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No users match your filters.
                </TableCell>
              </TableRow>
            )}
            {pager.slice.map((u) => {
              const self = u.id === currentUserId;
              return (
                <TableRow key={u.id} className={u.isActive ? undefined : "bg-muted/40"}>
                  <TableCell className="pl-5">
                    <span className="block font-medium">
                      {u.name} {self && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </TableCell>
                  <TableCell>
                    {self ? (
                      <StatusBadge value={u.role} />
                    ) : (
                      <Select value={u.role} disabled={pending} onValueChange={(v) => act(() => changeRoleAction(u.id, v))}>
                        <SelectTrigger size="sm" className="w-36" aria-label={`Role for ${u.name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Administrator</SelectItem>
                          <SelectItem value="EXAMINER">Examiner</SelectItem>
                          <SelectItem value="CANDIDATE">Candidate</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Switch
                      checked={u.isActive}
                      disabled={self || pending}
                      onCheckedChange={(v) => act(() => setActiveAction(u.id, v))}
                      aria-label={`${u.isActive ? "Deactivate" : "Activate"} ${u.name}`}
                    />
                  </TableCell>
                  <TableCell className="tabular hidden text-sm text-muted-foreground lg:table-cell">
                    {u.lastLoginAt ? <LocalTime value={u.lastLoginAt} /> : "Never"}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                      <UserRoundPen className="size-4" aria-hidden /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <Pagination {...pager} noun="users" />

      <UserDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </>
  );
}

function UserDialog({ user, onClose, onSaved }: { user: U | "new" | null; onClose: () => void; onSaved: () => void }) {
  const isNew = user === "new";
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [role, setRole] = useState<Role>("CANDIDATE");

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    start(async () => {
      const r = isNew ? await createUserAction({ ...fd, role }) : await updateUserAction((user as U).id, fd);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? { _: r.error });
        if (!r.fieldErrors) toast.error(r.error);
        return;
      }
      toast.success(r.message);
      onSaved();
    });
  }

  const u = user && user !== "new" ? user : null;
  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Create user" : "Edit user"}</DialogTitle>
          <DialogDescription>
            {isNew ? "The user signs in with this email and password." : "Leave the password blank to keep the current one."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="u-name" label="Full name" error={errors.name}>
            <Input id="u-name" name="name" defaultValue={u?.name} required aria-invalid={!!errors.name} />
          </Field>
          <Field id="u-email" label="Email" error={errors.email}>
            <Input id="u-email" name="email" type="email" defaultValue={u?.email} required aria-invalid={!!errors.email} />
          </Field>
          {isNew && (
            <Field id="u-role" label="Role">
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="u-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CANDIDATE">Candidate</SelectItem>
                  <SelectItem value="EXAMINER">Examiner</SelectItem>
                  <SelectItem value="ADMIN">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field id="u-password" label={isNew ? "Password" : "New password (optional)"} error={errors.password} hint="At least 8 characters.">
            <Input id="u-password" name="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} />
          </Field>
          {errors._ && <p className="text-sm text-destructive">{errors._}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {isNew ? "Create user" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
