import { AlertTriangle, BookOpenCheck, ClipboardList, Timer, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityChart } from "@/components/charts/charts";
import { LocalTime } from "@/components/shared/local-time";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { ExamService } from "@/services/exams/exam.service";
import { ResultsService } from "@/services/results/results.service";
import { UserService } from "@/services/users/user.service";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const admin = await requireRole("ADMIN");
  const [roles, stats, activity] = await Promise.all([UserService.countByRole(), ExamService.platformStats(), ResultsService.platformActivity()]);
  const totalUsers = roles.ADMIN + roles.EXAMINER + roles.CANDIDATE;

  return (
    <>
      <PageHeader title={`Welcome back, ${admin.name.split(" ")[0]}`} description="Platform health at a glance. All figures come from live records." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Users" value={totalUsers} hint={`${roles.CANDIDATE} candidates · ${roles.EXAMINER} examiners`} icon={Users} tone="primary" />
        <StatCard label="Examinations" value={stats.exams} hint={`${stats.liveExams} open right now`} icon={BookOpenCheck} tone="info" />
        <StatCard label="Active enrolments" value={stats.enrollments} hint="Candidates enrolled in exams" icon={ClipboardList} tone="success" />
        <StatCard label="Attempts" value={stats.attempts} hint={`${stats.attemptsInProgress} in progress`} icon={Timer} tone="warning" />
        <StatCard label="Unreviewed indicators" value={stats.openIncidents} hint="Connectivity & sync events" icon={AlertTriangle} tone="danger" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Activity — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityChart data={activity.series} />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Link href="/admin/activity" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {activity.feed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-3">
                {activity.feed.slice(0, 7).map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                    <span>{e.summary}</span>
                    <LocalTime value={e.createdAt} mode="time" className="tabular shrink-0 text-xs text-muted-foreground" />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** Per-user, per-request data (session + live DB): blocking navigation is intended. */
export const instant = false;
