import { Users } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { UserService } from "@/services/users/user.service";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  await requireRole("ADMIN");
  const list = await UserService.list();

  return (
    <>
      <PageHeader title="Users" description="Everyone with access to the platform. Roles are enforced on the server." />
      {list.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" description="Run the seed script or create the first accounts." />
      ) : (
        <Card className="overflow-hidden py-0 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden pr-5 lg:table-cell">Last sign-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-5">
                    <span className="block font-medium">{u.name}</span>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={u.role} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className={`size-1.5 rounded-full ${u.isActive ? "bg-success" : "bg-muted-foreground"}`} aria-hidden />
                      {u.isActive ? "Active" : "Disabled"}
                    </span>
                  </TableCell>
                  <TableCell className="tabular hidden pr-5 text-sm text-muted-foreground lg:table-cell">
                    {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
