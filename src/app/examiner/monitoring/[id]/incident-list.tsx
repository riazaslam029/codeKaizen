import { LocalTime } from "@/components/shared/local-time";
import { StatusBadge } from "@/components/shared/status-badge";

const LABEL: Record<string, string> = {
  NETWORK_LOSS: "Connection lost",
  RECONNECTED: "Reconnected",
  SYNC_FAILED: "Answer sync failed repeatedly",
  DUPLICATE_SUBMISSION: "Repeated submission request",
  ATTEMPT_RESUMED: "Workspace reloaded / recovered",
  LATE_ANSWER_REJECTED: "Answers after deadline rejected",
  AUTO_SUBMITTED: "Auto-submitted at deadline",
  TAB_SWITCH: "Tab switch",
  FULLSCREEN_EXIT: "Left full screen",
  COPY_PASTE: "Copy / paste",
  MULTIPLE_SESSIONS: "Multiple sessions",
  OTHER: "Other",
};

function describe(details: Record<string, unknown> | null) {
  if (!details) return "";
  const parts: string[] = [];
  if (typeof details.offlineSeconds === "number") parts.push(`offline ${details.offlineSeconds}s`);
  if (typeof details.failures === "number") parts.push(`${details.failures} failed attempts`);
  if (typeof details.count === "number") parts.push(`${details.count} answer(s)`);
  if (typeof details.note === "string") parts.push(details.note);
  if (details.source === "browser") parts.push("reported by browser");
  return parts.join(" · ");
}

export function IncidentList({
  items,
  showCandidate = true,
}: {
  items: { id: string; type: string; severity: string; details: Record<string, unknown> | null; occurredAt: string; candidate?: string }[];
  showCandidate?: boolean;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No indicators recorded.</p>;
  return (
    <ol className="relative space-y-3 border-l pl-5">
      {items.map((i) => (
        <li key={i.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{LABEL[i.type] ?? i.type}</span>
            <StatusBadge value={i.severity} />
            {showCandidate && i.candidate && <span className="text-muted-foreground">· {i.candidate}</span>}
            <LocalTime value={i.occurredAt} className="ml-auto text-xs text-muted-foreground" />
          </div>
          {describe(i.details) && <p className="text-xs text-muted-foreground">{describe(i.details)}</p>}
        </li>
      ))}
    </ol>
  );
}
