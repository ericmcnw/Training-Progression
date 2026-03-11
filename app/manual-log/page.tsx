import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatRoutineTypeLabel,
  isCardioKind,
  isCompletionKind,
  isGuidedKind,
  isSessionKind,
  isWorkoutKind,
} from "@/lib/routines";
import DeleteLogButton from "./DeleteLogButton";

export const dynamic = "force-dynamic";

const dateHeadingFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function ManualLogPage() {
  const recentLogs = await prisma.routineLog.findMany({
    orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
    take: 120,
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      notes: true,
      completionCount: true,
      distanceMi: true,
      durationSec: true,
      location: true,
      routine: { select: { id: true, name: true, category: true, kind: true } },
      exercises: { select: { id: true, sets: { select: { id: true } } } },
    },
  });

  const byDate = new Map<string, typeof recentLogs>();
  for (const log of recentLogs) {
    const performedAt = new Date(log.performedAt);
    const dateKey = localDateKey(performedAt);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(log);
  }
  const orderedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Manual Log</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Recent routine logs, grouped by date with newest entries first. Edit date/time and content from here.
          </div>
        </div>
        <Link href="/routines" style={linkBtn}>
          Back to Routines
        </Link>
      </div>

      <section style={panel}>
        <div style={panelHeader}>RECENT LOGS</div>
        <div style={{ padding: 12, display: "grid", gap: 14 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No logs yet.</div>}
          {orderedDates.map((dateKey) => {
            const logs = byDate.get(dateKey) ?? [];
            const headingDate = new Date(`${dateKey}T12:00:00`);
            return (
              <div key={dateKey} style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.4, opacity: 0.9 }}>
                  {dateHeadingFormatter.format(headingDate).toUpperCase()} ({logs.length})
                </div>
                {logs.map((log) => {
                  const exerciseSetCount = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
                  const routineKind = String(log.routine.kind);
                  const typeLabel = formatRoutineTypeLabel(routineKind);
                  const categoryLabel = (log.routine.category || "General").trim() || "General";
                  const editHref = isWorkoutKind(routineKind)
                    ? `/routines/${log.routineId}/log/${log.id}?returnTo=${encodeURIComponent("/manual-log")}`
                    : isCardioKind(routineKind)
                    ? `/routines/${log.routineId}/log-cardio/${log.id}?returnTo=${encodeURIComponent("/manual-log")}`
                    : isGuidedKind(routineKind)
                    ? `/routines/${log.routineId}/log-guided/${log.id}?returnTo=${encodeURIComponent("/manual-log")}`
                    : isSessionKind(routineKind)
                    ? `/routines/${log.routineId}/log-session/${log.id}?returnTo=${encodeURIComponent("/manual-log")}`
                    : `/routines/${log.routineId}/log-check/${log.id}?returnTo=${encodeURIComponent("/manual-log")}`;

                  return (
                    <div key={log.id} style={{ border: "1px solid rgba(128,128,128,0.28)", borderRadius: 10, padding: 10, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", background: "rgba(128,128,128,0.06)" }}>
                      <div style={{ fontSize: 13 }}>
                        <div style={{ fontWeight: 800 }}>
                          {log.routine.name} | {categoryLabel} | {typeLabel}
                        </div>
                        <div style={{ opacity: 0.8, marginTop: 2 }}>
                          {timeFormatter.format(new Date(log.performedAt))}
                        </div>
                        {isCardioKind(routineKind) && (
                          <div style={{ opacity: 0.8, marginTop: 2 }}>
                            {(log.distanceMi ?? 0).toFixed(2)} mi | {Math.floor((log.durationSec ?? 0) / 60)}m {(log.durationSec ?? 0) % 60}s
                          </div>
                        )}
                        {isWorkoutKind(routineKind) && <div style={{ opacity: 0.8, marginTop: 2 }}>Sets: {exerciseSetCount}</div>}
                        {isGuidedKind(routineKind) && <div style={{ opacity: 0.8, marginTop: 2 }}>Duration: {Math.round((log.durationSec ?? 0) / 60)} min</div>}
                        {isSessionKind(routineKind) && <div style={{ opacity: 0.8, marginTop: 2 }}>Duration: {Math.round((log.durationSec ?? 0) / 60)} min</div>}
                        {isCompletionKind(routineKind) && log.completionCount ? <div style={{ opacity: 0.8, marginTop: 2 }}>Count: {log.completionCount}</div> : null}
                        {log.notes ? <div style={{ opacity: 0.75, marginTop: 2 }}>{log.notes}</div> : null}
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
                        <Link href={editHref} style={{ padding: "8px 10px", border: "1px solid rgba(128,128,128,0.7)", borderRadius: 10, textDecoration: "none", color: "inherit", background: "rgba(128,128,128,0.12)", fontWeight: 800 }}>
                          Edit
                        </Link>
                        <DeleteLogButton logId={log.id} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
};

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};


