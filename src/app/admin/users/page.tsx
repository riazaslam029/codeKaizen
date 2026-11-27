import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/dal";
import { UserService } from "@/services/users/user.service";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const admin = await requireRole("ADMIN");
  const list = await UserService.list();
  return (
    <>
      <PageHeader
        title="Users"
        description="Create accounts, assign roles and control access. Every change is enforced on the server and recorded in platform activity."
      />
      <UsersManager
        currentUserId={admin.id}
        users={list.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }))}
      />
    </>
  );
}
