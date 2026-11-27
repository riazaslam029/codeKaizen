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
  ACCESS_RESTRICTED: "Access restricted by administrator",
  ACCESS_RESTORED: "Access restored by administrator",
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
  if (typeof details.by === "string") parts.push(`by ${details.by}`);
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

/** Things a browser/client can do that an examiner may want to review — never proof of misconduct. */
const INTEGRITY = new Set(["TAB_SWITCH", "FULLSCREEN_EXIT", "COPY_PASTE", "MULTIPLE_SESSIONS", "DUPLICATE_SUBMISSION", "OTHER"]);

type Item = Parameters<typeof IncidentList>[0]["items"][number];

/** Separates failure-resilience events (connectivity, sync, recovery, deadline) from integrity indicators. */
export function SplitIncidents({ items, showCandidate = true }: { items: Item[]; showCandidate?: boolean }) {
  const technical = items.filter((i) => !INTEGRITY.has(i.type));
  const integrity = items.filter((i) => INTEGRITY.has(i.type));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="tech-events">
        <h3 id="tech-events" className="text-sm font-semibold">
          Connectivity & technical events <span className="font-normal text-muted-foreground">({technical.length})</span>
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">Connection loss, reconnection, sync retries, reloads and deadline handling. No time is ever added or removed.</p>
        {technical.length ? <IncidentList items={technical} showCandidate={showCandidate} /> : <p className="text-sm text-muted-foreground">No technical events.</p>}
      </section>
      <section aria-labelledby="integrity-events">
        <h3 id="integrity-events" className="text-sm font-semibold">
          Integrity indicators <span className="font-normal text-muted-foreground">({integrity.length})</span>
        </h3>
        <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Indicators are not evidence of misconduct.</strong> They show what the system observed so a person can review it in context.
        </p>
        {integrity.length ? <IncidentList items={integrity} showCandidate={showCandidate} /> : <p className="text-sm text-muted-foreground">No integrity indicators.</p>}
      </section>
    </div>
  );
}
