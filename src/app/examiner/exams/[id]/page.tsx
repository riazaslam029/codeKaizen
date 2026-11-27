import { ArrowLeft, BarChart3, Eye, MonitorDot, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ActionButton } from "@/components/shared/action-button";
import { LocalTime } from "@/components/shared/local-time";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { formatDuration } from "@/lib/format";
import { EnrollmentService, ExamService } from "@/services/exams/exam.service";
import { QuestionService } from "@/services/questions/question.service";
import { closeExamAction, publishExamAction, unpublishExamAction } from "../../actions";
import { ExamForm } from "../exam-form";
import { AnnouncementPanel } from "./announcement-panel";
import { EnrollmentManager } from "./enrollment-manager";
import { PaperManager } from "./paper-manager";
import { SandboxButton } from "./sandbox-button";

export const metadata: Metadata = { title: "Examination" };

export default async function ExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const examiner = await requireRole("EXAMINER");
  const { id } = await params;
  const [{ exam, paper, totalMarks, attemptCount }, enrolled, candidates, bank, notices] = await Promise.all([
    ExamService.getForExaminer(examiner, id),
    EnrollmentService.listForExam(examiner, id),
    EnrollmentService.listCandidates(),
    QuestionService.list(),
    db.select().from(announcements).where(eq(announcements.examId, id)).orderBy(desc(announcements.publishedAt)),
  ]);
  const isDraft = exam.status === "DRAFT";

  return (
    <>
      <Link href="/examiner/exams" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All examinations
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{exam.code}</span>
            <StatusBadge value={exam.phase} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold">{exam.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <LocalTime value={exam.startsAt} /> – <LocalTime value={exam.endsAt} /> · {formatDuration(exam.durationMinutes)} · {paper.length} questions · {totalMarks} marks · pass {exam.passPercentage}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/examiner/exams/${id}/preview`}>
              <Eye className="size-4" aria-hidden /> Preview paper
            </Link>
          </Button>
          <SandboxButton examId={id} disabled={paper.length === 0} />
          {isDraft && (
            <ActionButton
              action={publishExamAction.bind(null, id)}
              disabled={paper.length === 0}
              confirm={{
                title: "Publish this examination?",
                description: "Enrolled candidates will see it and can start once the window opens. Questions can no longer be changed.",
                confirmLabel: "Publish",
              }}
            >
              Publish
            </ActionButton>
          )}
          {exam.status === "PUBLISHED" && attemptCount === 0 && (
            <ActionButton variant="outline" action={unpublishExamAction.bind(null, id)} confirm={{ title: "Return to draft?", description: "Candidates will no longer see this examination until you publish it again." }}>
              Return to draft
            </ActionButton>
          )}
          {exam.status === "PUBLISHED" && (
            <ActionButton
              variant="outline"
              action={closeExamAction.bind(null, id)}
              confirm={{
                title: "Close the examination now?",
                description: "No new attempts can start. Attempts already in progress keep their own deadline.",
                confirmLabel: "Close examination",
                destructive: true,
              }}
            >
              Close
            </ActionButton>
          )}
        </div>
      </div>

      {!isDraft && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { href: `/examiner/monitoring/${id}`, icon: MonitorDot, label: "Monitor attempts", hint: `${attemptCount} attempt(s)` },
            { href: `/examiner/results/${id}`, icon: Trophy, label: "Results & publication", hint: "Grade, review, publish" },
            { href: `/examiner/analytics/${id}`, icon: BarChart3, label: "Question analytics", hint: "From real responses" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="group flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
              <l.icon className="size-5 text-primary" aria-hidden />
              <span>
                <span className="block text-sm font-medium group-hover:underline">{l.label}</span>
                <span className="block text-xs text-muted-foreground">{l.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <Tabs defaultValue="paper">
        <TabsList>
          <TabsTrigger value="paper">Paper ({paper.length})</TabsTrigger>
          <TabsTrigger value="candidates">Candidates ({enrolled.filter((e) => e.status === "ENROLLED").length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="announcements">Announcements ({notices.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="paper" className="mt-4">
          <PaperManager
            examId={id}
            editable={isDraft}
            paper={paper.map((p) => ({ id: p.id, position: p.position, type: p.type, prompt: p.prompt, marks: p.marks, difficulty: p.difficulty, topic: p.topic ?? p.subject }))}
            bank={bank.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, marks: q.defaultMarks, difficulty: q.difficulty, subject: q.subject }))}
          />
        </TabsContent>
        <TabsContent value="candidates" className="mt-4">
          <EnrollmentManager
            examId={id}
            enrolled={enrolled.map((e) => ({ ...e, enrolledAt: e.enrolledAt.toISOString() }))}
            candidates={candidates.map((c) => ({ id: c.id, name: c.name, email: c.email, isActive: c.isActive }))}
          />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <ExamForm
            examId={id}
            totalMarks={totalMarks}
            locked={attemptCount > 0}
            initial={{
              ...exam,
              startsAt: exam.startsAt.toISOString(),
              endsAt: exam.endsAt.toISOString(),
            }}
          />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Announcements</CardTitle>
            </CardHeader>
            <CardContent>
              <AnnouncementPanel examId={id} items={notices.map((n) => ({ id: n.id, title: n.title, body: n.body, publishedAt: n.publishedAt.toISOString() }))} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
