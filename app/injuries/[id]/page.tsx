import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BodyMap from "@/app/components/body-map/BodyMap";
import InjuryForm from "@/app/components/injuries/InjuryForm";
import QuickInjuryPainLog from "@/app/components/injuries/QuickInjuryPainLog";
import PainHistoryChart, { type PainHistoryDay } from "@/app/components/injuries/PainHistoryChart";
import InjuryTrainingHeatmap from "@/app/components/injuries/InjuryTrainingHeatmap";
import { getInjuryTrainingHeatmap } from "./training-heatmap";
import PageShell from "@/app/components/PageShell";
import { cardSurface, cardTitle, COLOR, RADIUS } from "@/lib/design-tokens";
import { getInjury, updateInjury } from "../actions";
import InjuryStatusButtons from "./InjuryStatusButtons";
import { prisma } from "@/lib/prisma";
import { formatAppDate, formatAppDateTime, toAppYmd, todayAppYmd, addDaysYmd, diffYmdDays } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Params = { id: string };

const contextLabels: Record<string, string> = {
  AT_REST: "at rest",
  MORNING: "morning",
  AFTER_ACTIVITY: "after activity",
  DURING_ACTIVITY: "during activity",
  GENERAL: "general",
};

const RECENT_LOG_LIMIT = 8;

type AggravatorRow = {
  routineName: string;
  avgLevel: number;
  peakLevel: number;
  logCount: number;
};

function painColor(level: number): string {
  if (level >= 8) return "#F87171";
  if (level >= 5) return "#FBBF24";
  if (level >= 3) return "#A3E635";
  return "rgba(255,255,255,0.55)";
}

function buildPainHistory(
  startedAtYmd: string,
  todayYmd: string,
  rows: Array<{ level: number; loggedAt: Date; context: string }>,
): PainHistoryDay[] {
  const peaks = new Map<string, { peak: number; context: PainHistoryDay["context"] }>();
  for (const row of rows) {
    const ymd = toAppYmd(row.loggedAt);
    const existing = peaks.get(ymd);
    if (!existing || row.level > existing.peak) {
      peaks.set(ymd, { peak: row.level, context: row.context as PainHistoryDay["context"] });
    }
  }
  // diffYmdDays(a, b) = a - b, so we need (today - started) for a positive
  // span. Reversing the args silently capped this at 1 day and hid every
  // pain log older than today.
  const totalDays = Math.max(1, diffYmdDays(todayYmd, startedAtYmd) + 1);
  const days: PainHistoryDay[] = [];
  for (let i = 0; i < totalDays; i++) {
    const ymd = addDaysYmd(startedAtYmd, i);
    const entry = peaks.get(ymd);
    days.push({ ymd, peak: entry?.peak ?? null, context: entry?.context ?? null });
  }
  return days;
}

function buildAggravators(
  rows: Array<{ level: number; routineLog: { routine: { name: string } } | null }>,
): AggravatorRow[] {
  const byRoutine = new Map<string, { sum: number; peak: number; count: number }>();
  for (const row of rows) {
    const routineName = row.routineLog?.routine?.name;
    if (!routineName) continue;
    const current = byRoutine.get(routineName) ?? { sum: 0, peak: 0, count: 0 };
    current.sum += row.level;
    if (row.level > current.peak) current.peak = row.level;
    current.count += 1;
    byRoutine.set(routineName, current);
  }
  return Array.from(byRoutine.entries())
    .map(([routineName, stats]) => ({
      routineName,
      avgLevel: Math.round((stats.sum / stats.count) * 10) / 10,
      peakLevel: stats.peak,
      logCount: stats.count,
    }))
    .sort((a, b) => b.avgLevel - a.avgLevel)
    .slice(0, 5);
}

function PainBar({ level }: { level: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${level * 10}%`, height: "100%", borderRadius: 4, background: painColor(level), transition: "width 0.2s" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 900, color: painColor(level), minWidth: 32, textAlign: "right" }}>{level}/10</span>
    </div>
  );
}

export default async function InjuryDetailPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const injury = await getInjury(params.id);
  if (!injury) notFound();

  const zoneIds = injury.zones.map((entry) => entry.zoneId);
  const zoneSlugs = injury.zones.map((entry) => entry.zone.slug);
  const painZones = injury.zones.map((entry) => ({ slug: entry.zone.slug, label: entry.zone.label }));
  // Affected zones may map to one or more metadata groups (e.g. left + right
  // hamstring both → "hamstrings"). Dedupe so the heatmap shows each group
  // once.
  const affectedMuscleSlugs = Array.from(
    new Set(
      injury.zones
        .map((entry) => entry.zone.metadataGroupSlug)
        .filter((slug): slug is string => Boolean(slug)),
    ),
  );

  const [zones, painLogs, trainingHeatmap] = await Promise.all([
    prisma.bodyZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { slug: true, label: true } }),
    prisma.painLog.findMany({
      where: {
        zoneId: { in: zoneIds },
        loggedAt: { gte: injury.startedAt },
      },
      orderBy: { loggedAt: "desc" },
      include: {
        zone: { select: { label: true, slug: true } },
        routineLog: { select: { id: true, routine: { select: { name: true } } } },
      },
    }),
    getInjuryTrainingHeatmap(affectedMuscleSlugs),
  ]);

  const recentPainLevel = painLogs.length > 0 ? painLogs[0].level : null;
  const avgPainLevel =
    painLogs.length > 0
      ? Math.round((painLogs.reduce((sum, l) => sum + l.level, 0) / painLogs.length) * 10) / 10
      : null;
  const peakPainLevel =
    painLogs.length > 0 ? painLogs.reduce((max, l) => (l.level > max ? l.level : max), 0) : null;

  const startedYmd = toAppYmd(injury.startedAt);
  const today = todayAppYmd();
  const painHistoryDays = buildPainHistory(startedYmd, today, painLogs);
  const aggravators = buildAggravators(painLogs);
  const recentLogs = painLogs.slice(0, RECENT_LOG_LIMIT);
  const olderLogCount = Math.max(0, painLogs.length - recentLogs.length);
  const daysInjured = Math.max(0, diffYmdDays(today, startedYmd));
  const startedLabel = formatAppDate(injury.startedAt, { month: "short", day: "numeric", year: "numeric" });
  const subtitle =
    `${injury.status.toLowerCase()} · severity ${injury.severity}/5 · ${daysInjured === 0 ? "started today" : `${daysInjured} days`} · since ${startedLabel}`;

  return (
    <PageShell
      eyebrow="Injury"
      title={injury.name}
      subtitle={subtitle}
      toolbar={<Link href="/injuries" style={linkStyle}>Back</Link>}
    >
      {/* Quick log + summary stats */}
      {injury.status !== "RESOLVED" && (
        <section style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={cardTitle}>Log pain</div>
            {painLogs.length > 0 && (
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {recentPainLevel !== null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={statLabel}>Most recent</div>
                    <div style={{ ...statValue, color: painColor(recentPainLevel) }}>{recentPainLevel}/10</div>
                  </div>
                )}
                {avgPainLevel !== null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={statLabel}>Avg ({painLogs.length})</div>
                    <div style={{ ...statValue, color: painColor(avgPainLevel) }}>{avgPainLevel}/10</div>
                  </div>
                )}
                {peakPainLevel !== null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={statLabel}>Peak</div>
                    <div style={{ ...statValue, color: painColor(peakPainLevel) }}>{peakPainLevel}/10</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <QuickInjuryPainLog zones={painZones} />
        </section>
      )}

      {/* Body map + status */}
      <section style={panel}>
        <BodyMap
          zones={zoneSlugs.map((slug) => ({ slug, freshness: injury.status === "RESOLVED" ? "RECOVERING" : "INJURED" }))}
          selectedSlugs={zoneSlugs}
          size="md"
        />
        {injury.notes ? <div style={muted}>{injury.notes}</div> : null}
        <InjuryStatusButtons id={injury.id} />
      </section>

      {/* Pain history chart */}
      <section style={panel}>
        <div style={cardTitle}>Pain history</div>
        <PainHistoryChart days={painHistoryDays} />
      </section>

      {/* Aggravators rollup */}
      {aggravators.length > 0 && (
        <section style={panel}>
          <div style={cardTitle}>Aggravators</div>
          <div style={muted}>Routines where this injury flared the most, ranked by average level logged on the same session.</div>
          <div style={{ display: "grid", gap: 8 }}>
            {aggravators.map((row) => (
              <div key={row.routineName} style={aggravatorRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{row.routineName}</div>
                  <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700, marginTop: 2 }}>
                    {row.logCount} log{row.logCount === 1 ? "" : "s"} · peak {row.peakLevel}/10
                  </div>
                </div>
                <div style={{ minWidth: 110 }}>
                  <PainBar level={Math.round(row.avgLevel)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent logs */}
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={cardTitle}>Recent logs</div>
          {olderLogCount > 0 && (
            <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>
              {olderLogCount} earlier log{olderLogCount === 1 ? "" : "s"} in the chart above
            </div>
          )}
        </div>
        {recentLogs.length === 0 ? (
          <div style={muted}>No pain logs since this injury started.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentLogs.map((log) => (
              <div key={log.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{log.zone.label}</span>
                    <span style={{ fontSize: 12, color: COLOR.textDim, fontWeight: 700 }}>
                      {contextLabels[log.context] ?? log.context}
                    </span>
                    {log.routineLog?.routine && (
                      <span style={{ fontSize: 12, color: COLOR.textDim, fontWeight: 700 }}>· {log.routineLog.routine.name}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: COLOR.textDim, marginTop: 2 }}>
                    {formatAppDateTime(log.loggedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                  {log.notes ? (
                    <div style={{ fontSize: 13, marginTop: 5, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${COLOR.border}`, lineHeight: 1.45 }}>
                      {log.notes}
                    </div>
                  ) : null}
                </div>
                <div style={{ minWidth: 120 }}>
                  <PainBar level={log.level} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Training load — heatmap of weekly sessions on the affected muscle
          group, click a row to see the routines that contributed. */}
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={cardTitle}>Training load on affected muscle group{affectedMuscleSlugs.length === 1 ? "" : "s"}</div>
          <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>last 8 weeks</div>
        </div>
        <InjuryTrainingHeatmap data={trainingHeatmap} />
      </section>

      {/* Edit — collapsed since most visits are about reviewing the trend, not editing */}
      <details style={panel}>
        <summary style={detailsSummary}>
          <span style={cardTitle}>Edit details</span>
          <span style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>Name, severity, status, zones, notes</span>
        </summary>
        <div style={{ marginTop: 12 }}>
          <InjuryForm
            zones={zones}
            submitLabel="Save injury"
            action={updateInjury.bind(null, injury.id)}
            initial={{
              id: injury.id,
              name: injury.name,
              severity: injury.severity,
              status: injury.status,
              startedAt: toAppYmd(injury.startedAt),
              resolvedAt: injury.resolvedAt ? toAppYmd(injury.resolvedAt) : "",
              notes: injury.notes ?? "",
              zoneSlugs,
            }}
          />
        </div>
      </details>
    </PageShell>
  );
}

const panel: React.CSSProperties = { ...cardSurface, gap: 14 };
const muted: React.CSSProperties = { fontSize: 13, color: COLOR.textDim, lineHeight: 1.45 };
const row: React.CSSProperties = {
  border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.control,
  padding: "10px 12px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  background: "rgba(255,255,255,0.03)",
};
const statLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: COLOR.textFaint, letterSpacing: 0.5, textTransform: "uppercase" };
const statValue: React.CSSProperties = { fontSize: 24, fontWeight: 900, lineHeight: 1.1, marginTop: 2 };
const aggravatorRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  borderRadius: RADIUS.control,
  border: "1px solid rgba(248,113,113,0.18)",
  background: "rgba(248,113,113,0.04)",
};
const detailsSummary: React.CSSProperties = {
  cursor: "pointer",
  listStyle: "none",
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};
const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  minHeight: 36,
  alignItems: "center",
  border: `1px solid ${COLOR.borderStrong}`,
  borderRadius: RADIUS.control,
  padding: "8px 14px",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};
