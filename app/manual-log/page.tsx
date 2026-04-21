import Link from "next/link";
import { formatAppDate, formatAppDateTime, toAppYmd } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { resetStimulusPresetSelection, saveStimulusPresetSelection } from "./actions";
import { STIMULUS_EMPHASIS_PRESETS, getStimulusOverviewModel } from "@/lib/stimulus-preferences";
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

  const [recentLogs, goalCount, routineCount, stimulusOverview] = await Promise.all([
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
    getStimulusOverviewModel(),
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
    <div className="mobileManualLogPage mobilePageShell" style={{ maxWidth: 980, margin: "0 auto", padding: 4, display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 className="mobilePageTitle" style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Profile & History</h1>
        <div className="mobilePageSubtitle" style={{ opacity: 0.75, fontSize: 13 }}>
          Keep log history, training emphases, and future profile preferences in one place without adding setup friction.
        </div>
      </div>

      <section className="mobileSectionCard" style={panel}>
        <div className="mobileSectionHeader" style={panelHeader}>OVERVIEW</div>
        <div className="mobileSectionBody" style={{ padding: 14, display: "grid", gap: 14 }}>
          <div className="mobileCard" style={heroCard}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, letterSpacing: 0.5, fontWeight: 900, opacity: 0.74 }}>PROFILE HOME</div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Keep training preferences lightweight and the full log archive close.</div>
              <div style={{ fontSize: 13, opacity: 0.76, maxWidth: 620 }}>
                Use this area as the home for recent review now, then let it grow into profile, account, and preferences later.
              </div>
            </div>
            <div className="mobileManualLogHeroActions mobileActionRow" style={heroActionRow}>
              <Link href="/manual-log" style={primaryLinkBtn}>
                Profile
              </Link>
              <Link href="/manual-log?view=history" style={linkBtn}>
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
              <Link href="/reports/weekly" style={linkBtn}>
                Weekly Report
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

      {!showHistory ? (
        <section className="mobileSectionCard" style={panel}>
          <div className="mobileSectionHeader" style={panelHeader}>TRAINING EMPHASES</div>
          <div className="mobileSectionBody" style={{ padding: 14, display: "grid", gap: 14 }}>
            <div style={{ fontSize: 13, opacity: 0.8, maxWidth: 760 }}>
              Choose any combination that matches what matters right now. The app uses these selections to interpret load stimulus and stretching stimulus without expecting a perfectly balanced split.
            </div>

            <form id="stimulusPresetForm" action={saveStimulusPresetSelection} style={{ display: "grid", gap: 12 }}>
              <div style={presetGrid}>
                {STIMULUS_EMPHASIS_PRESETS.map((preset) => {
                  const selected = stimulusOverview.selectedPresetKeys.includes(preset.key);
                  return (
                    <label key={preset.key} style={presetCard(selected)}>
                      <input
                        type="checkbox"
                        name="presetKey"
                        value={preset.key}
                        defaultChecked={selected}
                        style={{ width: 16, height: 16, marginTop: 2 }}
                      />
                      <div style={{ display: "grid", gap: 5 }}>
                        <div style={{ fontWeight: 800 }}>{preset.label}</div>
                        <div style={{ fontSize: 12, opacity: 0.76 }}>{preset.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </form>

            <div className="mobileActionRow" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" form="stimulusPresetForm" style={primaryButton}>
                Save Emphases
              </button>
              <form action={resetStimulusPresetSelection}>
                <button type="submit" style={secondaryButton}>
                  Reset to Neutral
                </button>
              </form>
              <Link href="/progress" style={linkBtn}>
                View Progress Insights
              </Link>
            </div>

            <div style={summaryGrid}>
              {stimulusOverview.effectivePreferences.map((entry) => (
                <div key={entry.slug} style={summaryCard}>
                  <div style={summaryLabel}>{entry.label}</div>
                  <div style={summaryValue}>{entry.priorityWeight.toFixed(2)}x</div>
                  <div style={summaryMeta}>{entry.isEmphasized ? "Emphasized now" : "Near neutral"}</div>
                </div>
              ))}
            </div>

            {stimulusOverview.inferredSuggestion ? (
              <div style={suggestionCard}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.4, opacity: 0.84 }}>PASSIVE SUGGESTION</div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{stimulusOverview.inferredSuggestion.presetLabel} looks like a likely fit.</div>
                <div style={{ fontSize: 13, opacity: 0.76 }}>
                  {stimulusOverview.inferredSuggestion.reasons.join(" ")}
                </div>
              </div>
            ) : null}

            {stimulusOverview.insights.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.4, opacity: 0.84 }}>CURRENT STIMULUS NOTES</div>
                {stimulusOverview.insights.map((insight) => (
                  <div key={insight} style={insightCard}>
                    {insight}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="mobileSectionCard" style={panel}>
        <div className="mobileSectionHeader" style={panelHeader}>RECENT ACTIVITY</div>
        <div className="mobileSectionBody" style={{ padding: 14, display: "grid", gap: 10 }}>
          {recentLogs.length === 0 && <div style={{ opacity: 0.75 }}>No logs yet.</div>}
          {recentLogs.slice(0, 5).map((log) => {
            const exerciseSetCount = log.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
            const routineKind = String(log.routine.kind);
            const typeLabel = formatRoutineTypeLabel(routineKind);
            const categoryLabel = (log.routine.category || "General").trim() || "General";
            return (
              <div key={log.id} className="mobileCard" style={activityCard}>
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
        <section className="mobileSectionCard" style={panel}>
          <div className="mobileSectionHeader" style={{ ...panelHeader, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>LOG HISTORY</span>
            <Link href="/manual-log" style={miniLinkBtn}>
              Back to Profile
            </Link>
          </div>
          <div className="mobileSectionBody" style={{ padding: 12, display: "grid", gap: 14 }}>
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
                      <div key={log.id} className="mobileManualLogHistoryCard mobileCard" style={historyCard}>
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
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 18,
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
  borderRadius: 18,
  padding: 18,
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

const presetGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

function presetCard(selected: boolean): React.CSSProperties {
  return {
    border: selected ? "1px solid rgba(84,203,130,0.78)" : "1px solid rgba(128,128,128,0.24)",
    borderRadius: 14,
    padding: 14,
    background: selected ? "rgba(84,203,130,0.12)" : "rgba(128,128,128,0.05)",
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    cursor: "pointer",
  };
}

const summaryCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.24)",
  borderRadius: 16,
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
  borderRadius: 16,
  padding: 14,
  background: "rgba(128,128,128,0.06)",
};

const suggestionCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.24)",
  borderRadius: 14,
  padding: 14,
  background: "linear-gradient(180deg, rgba(142,197,255,0.12), rgba(128,128,128,0.06))",
  display: "grid",
  gap: 6,
};

const insightCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.2)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(128,128,128,0.05)",
  fontSize: 13,
  lineHeight: 1.45,
};

const historyCard: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  padding: 14,
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

const primaryButton: React.CSSProperties = {
  ...primaryLinkBtn,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...linkBtn,
  cursor: "pointer",
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
