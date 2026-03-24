import Link from "next/link";
import { formatAppDate, formatAppDateTime, toAppYmd } from "@/lib/dates";
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

export default async function ManualLogPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = resolvedSearchParams?.view === "history" ? "history" : "profile";
  const showHistory = view === "history";

  const [recentLogs, goalCount, routineCount] = await Promise.all([
    prisma.routineLog.findMany({
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      take: 120,
      select: {
        id: true,
        routineId: true,
        performedAt: true,
        notes: true,
        completionCount: true,
        distanceMi: true,
        elevationGainFt: true,
        durationSec: true,
        location: true,
        routine: { select: { id: true, name: true, category: true, kind: true } },
        exercises: { select: { id: true, sets: { select: { id: true } } } },
      },
    }),
    prisma.goal.count({ where: { isActive: true } }),
    prisma.routine.count({ where: { isDeleted: false, isActive: true } }),
  ]);

  const latestLog = recentLogs[0] ?? null;
  const byDate = new Map<string, typeof recentLogs>();
  for (const log of recentLogs) {
    const dateKey = toAppYmd(log.performedAt);
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(log);
  }
  const orderedDates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Training History</h1>
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          Review recent training, jump into the full log archive, and move quickly into progress, routines, and goals.
        </div>
      </div>

      <section style={panel}>
        <div style={panelHeader}>OVERVIEW</div>
        <div style={{ padding: 14, display: "grid", gap: 14 }}>
          <div style={heroCard}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, letterSpacing: 0.5, fontWeight: 900, opacity: 0.74 }}>TRAINING REVIEW</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Keep recent sessions close and the full training archive one tap away.</div>
              <div style={{ fontSize: 13, opacity: 0.76, maxWidth: 620 }}>
                Use this as the review hub for what you logged recently and where to go next.
              </div>
            </div>
            <div style={heroActionRow}>
              <Link href="/manual-log?view=history" style={primaryLinkBtn}>
                Log History
              </Link>
              <Link href="/progress" style={linkBtn}>
                Progress
              </Link>
              <Link href="/routines" style={linkBtn}>
                Routines
              </Link>
              <Link href="/goals" style={linkBtn}>
                Goals
              </Link>
            </div>
          </div>

          <div style={summaryGrid}>
            <div style={summaryCard}>
              <div style={summaryLabel}>Latest Log</div>
              <div style={summaryValue}>{latestLog ? formatAppDate(latestLog.performedAt, { month: "short", day: "numeric" }) : "-"}</div>
              <div style={summaryMeta}>{latestLog ? latestLog.routine.name : "No logs yet"}</div>
            </div>
            <div style={summaryCard}>
              <div style={summaryLabel}>Active Goals</div>
              <div style={summaryValue}>{goalCount}</div>
              <div style={summaryMeta}>Current training targets</div>
            </div>
            <div style={summaryCard}>
              <div style={summaryLabel}>Active Routines</div>
              <div style={summaryValue}>{routineCount}</div>
              <div style={summaryMeta}>Ready to log</div>
            </div>
          </div>
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>RECENT ACTIVITY</div>
        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No logs yet.</div>}
          {recentLogs.slice(0, 5).map((log) => {
            const exerciseSetCount = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
            const routineKind = String(log.routine.kind);
            const typeLabel = formatRoutineTypeLabel(routineKind);
            const categoryLabel = (log.routine.category || "General").trim() || "General";
            return (
              <div key={log.id} style={activityCard}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{log.routine.name}</div>
                  <div style={{ marginTop: 3, fontSize: 12, opacity: 0.76 }}>
                    {categoryLabel} | {typeLabel} | {formatAppDateTime(log.performedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                  {isCardioKind(routineKind) && (
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>
                      {(log.distanceMi ?? 0).toFixed(2)} mi | {Math.floor((log.durationSec ?? 0) / 60)}m {(log.durationSec ?? 0) % 60}s{log.elevationGainFt ? ` | ${log.elevationGainFt} ft` : ""}
                    </div>
                  )}
                  {isWorkoutKind(routineKind) && <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>Sets logged: {exerciseSetCount}</div>}
                  {isGuidedKind(routineKind) && <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>Duration: {Math.round((log.durationSec ?? 0) / 60)} min</div>}
                  {isSessionKind(routineKind) && <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>Duration: {Math.round((log.durationSec ?? 0) / 60)} min</div>}
                  {isCompletionKind(routineKind) && log.completionCount ? (
                    <div style={{ marginTop: 4, fontSize: 12, opacity: 0.72 }}>Count: {log.completionCount}</div>
                  ) : null}
                </div>
              </div>
            );
          })}
          <Link href="/manual-log?view=history" style={linkBtn}>
            Open Full Log History
          </Link>
        </div>
      </section>

      {showHistory ? (
        <section style={panel}>
          <div style={{ ...panelHeader, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>LOG HISTORY</span>
            <Link href="/manual-log" style={miniLinkBtn}>
              Back to History
            </Link>
          </div>
          <div style={{ padding: 12, display: "grid", gap: 14 }}>
            {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No logs yet.</div>}
            {orderedDates.map((dateKey) => {
              const logs = byDate.get(dateKey) ?? [];
              return (
                <div key={dateKey} style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.4, opacity: 0.9 }}>
                    {formatAppDate(`${dateKey}T12:00:00.000Z`, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }).toUpperCase()} ({logs.length})
                  </div>
                  {logs.map((log) => {
                    const exerciseSetCount = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
                    const routineKind = String(log.routine.kind);
                    const typeLabel = formatRoutineTypeLabel(routineKind);
                    const categoryLabel = (log.routine.category || "General").trim() || "General";
                    const historyReturnTo = "/manual-log?view=history";
                    const editHref = `/routines/${log.routineId}/logs/${log.id}/edit?returnTo=${encodeURIComponent(historyReturnTo)}`;

                    return (
                      <div key={log.id} style={historyCard}>
                        <div style={{ fontSize: 13 }}>
                          <div style={{ fontWeight: 800 }}>
                            {log.routine.name} | {categoryLabel} | {typeLabel}
                          </div>
                          <div style={{ opacity: 0.8, marginTop: 2 }}>
                            {formatAppDateTime(log.performedAt, { hour: "numeric", minute: "2-digit" })}
                          </div>
                          {isCardioKind(routineKind) && (
                            <div style={{ opacity: 0.8, marginTop: 2 }}>
                              {(log.distanceMi ?? 0).toFixed(2)} mi | {Math.floor((log.durationSec ?? 0) / 60)}m {(log.durationSec ?? 0) % 60}s{log.elevationGainFt ? ` | ${log.elevationGainFt} ft` : ""}
                            </div>
                          )}
                          {isWorkoutKind(routineKind) && <div style={{ opacity: 0.8, marginTop: 2 }}>Sets: {exerciseSetCount}</div>}
                          {isGuidedKind(routineKind) && <div style={{ opacity: 0.8, marginTop: 2 }}>Duration: {Math.round((log.durationSec ?? 0) / 60)} min</div>}
                          {isSessionKind(routineKind) && <div style={{ opacity: 0.8, marginTop: 2 }}>Duration: {Math.round((log.durationSec ?? 0) / 60)} min</div>}
                          {isCompletionKind(routineKind) && log.completionCount ? <div style={{ opacity: 0.8, marginTop: 2 }}>Count: {log.completionCount}</div> : null}
                          {log.notes ? <div style={{ opacity: 0.75, marginTop: 2 }}>{log.notes}</div> : null}
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "start" }}>
                          <Link href={editHref} style={miniLinkBtn}>
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
      ) : null}
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 16,
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const panelHeader: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(128,128,128,0.14)",
  borderBottom: "1px solid rgba(128,128,128,0.25)",
  fontWeight: 900,
};

const heroCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.26)",
  borderRadius: 16,
  padding: 16,
  background: "linear-gradient(180deg, rgba(128,128,128,0.14), rgba(128,128,128,0.06))",
  display: "grid",
  gap: 14,
};

const heroActionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const summaryCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.24)",
  borderRadius: 14,
  padding: 14,
  background: "rgba(128,128,128,0.07)",
  display: "grid",
  gap: 4,
};

const summaryLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.3,
  opacity: 0.7,
};

const summaryValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
};

const summaryMeta: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
};

const activityCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.24)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.06)",
};

const historyCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 10,
  padding: 10,
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
  background: "rgba(128,128,128,0.06)",
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

const primaryLinkBtn: React.CSSProperties = {
  ...linkBtn,
  background: "rgba(84,203,130,0.18)",
  border: "1px solid rgba(84,203,130,0.75)",
};

const miniLinkBtn: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid rgba(128,128,128,0.7)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  background: "rgba(128,128,128,0.12)",
  fontWeight: 800,
};
