import { AlertTriangle, BookOpenCheck, ClipboardList, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { ExamService } from "@/services/exams/exam.service";
import { UserService } from "@/services/users/user.service";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const admin = await requireRole("ADMIN");
  const [roles, stats] = await Promise.all([UserService.countByRole(), ExamService.platformStats()]);
  const totalUsers = roles.ADMIN + roles.EXAMINER + roles.CANDIDATE;

  return (
    <>
      <PageHeader title={`Welcome back, ${admin.name.split(" ")[0]}`} description="Platform health at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={totalUsers} hint={`${roles.CANDIDATE} candidates`} icon={Users} />
        <StatCard label="Examinations" value={stats.exams} hint={`${stats.liveExams} published or active`} icon={BookOpenCheck} />
        <StatCard label="Active enrolments" value={stats.enrollments} icon={ClipboardList} />
        <StatCard label="Unreviewed incidents" value={stats.openIncidents} icon={AlertTriangle} />
      </div>

      <Card className="mt-6 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Accounts by role</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            {(["ADMIN", "EXAMINER", "CANDIDATE"] as const).map((r) => {
              const pct = totalUsers ? Math.round((roles[r] / totalUsers) * 100) : 0;
              return (
                <div key={r}>
                  <dt className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{r.charAt(0) + r.slice(1).toLowerCase()}s</span>
                    <span className="tabular font-medium">{roles[r]}</span>
                  </dt>
                  <dd className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${pct}%`}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </dd>
                </div>
              );
            })}
          </dl>
          <Link href="/admin/users" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
            Manage users →
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
