import type React from "react";
import { notFound } from "next/navigation";
import HistoryBackButton from "@/app/components/HistoryBackButton";
import BodyMap from "@/app/components/body-map/BodyMap";
import InjuryForm from "@/app/components/injuries/InjuryForm";
import LogPainButton from "@/app/components/injuries/LogPainButton";
import DeletePainLogButton from "@/app/components/injuries/DeletePainLogButton";
import EditPainLogButton from "@/app/components/injuries/EditPainLogButton";
import PainTrendLine, { type PainTrendPoint } from "@/app/components/injuries/PainTrendLine";
import InjuryTrainingLoad from "@/app/components/injuries/InjuryTrainingLoad";
import { getInjuryTrainingHeatmap } from "./training-heatmap";
import PageShell from "@/app/components/PageShell";
import { cardSurface, cardTitle, COLOR, RADIUS } from "@/lib/design-tokens";
import { getInjury, updateInjury, getAggravatingFactorSuggestions } from "../actions";
import InjuryStatusButtons from "./InjuryStatusButtons";
import { prisma } from "@/lib/prisma";
import { formatAppDate, formatAppDateTime, toAppYmd, todayAppYmd, diffYmdDays } from "@/lib/dates";

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

// Per-day peak pain, oldest → newest — the point series the trend line draws.
function dailyPainPeaks(rows: Array<{ level: number; loggedAt: Date }>): PainTrendPoint[] {
  const peak = new Map<string, number>();
  for (const row of rows) {
    const ymd = toAppYmd(row.loggedAt);
    peak.set(ymd, Math.max(peak.get(ymd) ?? 0, row.level));
  }
  return [...peak.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ymd, level]) => ({ ymd, level }));
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

const STATUS_META: Record<string, { label: string; bg: string; border: string; color: string }> = {
  ACTIVE:     { label: "Active",     bg: "rgba(248,113,113,0.16)", border: "rgba(248,113,113,0.42)", color: "#FCA5A5" },
  FLARED:     { label: "Flared",     bg: "rgba(251,146,60,0.16)",  border: "rgba(251,146,60,0.42)",  color: "#FED7AA" },
  RECOVERING: { label: "Recovering", bg: "rgba(147,197,253,0.16)", border: "rgba(147,197,253,0.36)", color: "#DBEAFE" },
  RESOLVED:   { label: "Resolved",   bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.62)" },
};

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

function PainStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={statChip}>
      <div style={statChipLabel}>{label}</div>
      <div style={{ ...statChipValue, color: value !== null ? painColor(value) : COLOR.textFaint }}>
        {value !== null ? `${value}/10` : "—"}
      </div>
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
  const affectedMuscleSlugs = Array.from(
    new Set(
      injury.zones
        .map((entry) => entry.zone.metadataGroupSlug)
        .filter((slug): slug is string => Boolean(slug)),
    ),
  );

  const [zones, factorSuggestions, painLogs, trainingHeatmap] = await Promise.all([
    prisma.bodyZone.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], select: { slug: true, label: true } }),
    getAggravatingFactorSuggestions(),
    prisma.painLog.findMany({
      where: { zoneId: { in: zoneIds }, loggedAt: { gte: injury.startedAt } },
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
  const trendPoints = dailyPainPeaks(painLogs);
  const aggravators = buildAggravators(painLogs);
  const recentLogs = painLogs.slice(0, RECENT_LOG_LIMIT);
  const olderLogCount = Math.max(0, painLogs.length - recentLogs.length);
  const daysInjured = Math.max(0, diffYmdDays(today, startedYmd));
  const startedLabel = formatAppDate(injury.startedAt, { month: "short", day: "numeric", year: "numeric" });
  const isResolved = injury.status === "RESOLVED";
  const status = STATUS_META[injury.status] ?? STATUS_META.ACTIVE;

  return (
    <PageShell
      eyebrow="Injury"
      title={injury.name}
      toolbar={<HistoryBackButton fallbackHref="/body" label="← Back" style={linkStyle} />}
    >
      {/* ── Hero: identity, state, map, factors, actions ─────────────────── */}
      <section style={heroCard}>
        <div style={chipRow}>
          <span style={{ ...statusPill, background: status.bg, borderColor: status.border, color: status.color }}>{status.label}</span>
          <span style={metaChip}>{"●".repeat(injury.severity)}{"○".repeat(Math.max(0, 5 - injury.severity))} severity</span>
          <span style={metaChip}>{daysInjured === 0 ? "started today" : `${daysInjured} day${daysInjured === 1 ? "" : "s"}`}</span>
          <span style={metaChip}>since {startedLabel}</span>
        </div>

        <BodyMap
          zones={zoneSlugs.map((slug) => ({ slug, freshness: isResolved ? "RECOVERING" : "INJURED" }))}
          selectedSlugs={zoneSlugs}
          size="md"
        />

        {injury.aggravatingFactors.length > 0 ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={miniLabel}>Aggravating factors</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {injury.aggravatingFactors.map((f) => (
                <span key={f} style={factorChip}>{f}</span>
              ))}
            </div>
          </div>
        ) : null}

        {injury.notes ? <div style={muted}>{injury.notes}</div> : null}

        {!isResolved && (
          <LogPainButton zones={painZones} factorSuggestions={factorSuggestions} style={logPainButtonStyle} />
        )}
        <InjuryStatusButtons id={injury.id} />
      </section>

      {/* ── Pain trend ───────────────────────────────────────────────────── */}
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={cardTitle}>Pain trend</div>
          {painLogs.length > 0 && (
            <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>{painLogs.length} log{painLogs.length === 1 ? "" : "s"}</div>
          )}
        </div>
        {painLogs.length > 0 && (
          <div style={statChipRow}>
            <PainStat label="Most recent" value={recentPainLevel} />
            <PainStat label="Average" value={avgPainLevel} />
            <PainStat label="Peak" value={peakPainLevel} />
          </div>
        )}
        <PainTrendLine trend={trendPoints} size="lg" />
      </section>

      {/* ── Aggravators ──────────────────────────────────────────────────── */}
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

      {/* ── Recent logs ──────────────────────────────────────────────────── */}
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={cardTitle}>Recent logs</div>
          {olderLogCount > 0 && (
            <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>
              {olderLogCount} earlier log{olderLogCount === 1 ? "" : "s"} in the trend above
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
                <div style={{ display: "grid", gap: 6, minWidth: 120, justifyItems: "end" }}>
                  <PainBar level={log.level} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <EditPainLogButton
                      log={{
                        id: log.id,
                        zoneSlug: log.zone.slug,
                        level: log.level,
                        context: log.context,
                        notes: log.notes ?? "",
                        aggravatingFactors: log.aggravatingFactors,
                      }}
                      zones={zones}
                      factorSuggestions={factorSuggestions}
                    />
                    <DeletePainLogButton id={log.id} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Training load ────────────────────────────────────────────────── */}
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={cardTitle}>Training load on affected muscle group{affectedMuscleSlugs.length === 1 ? "" : "s"}</div>
          <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>last 8 weeks</div>
        </div>
        <InjuryTrainingLoad data={trainingHeatmap} />
      </section>

      {/* ── Edit (collapsed) ─────────────────────────────────────────────── */}
      <details style={panel}>
        <summary style={detailsSummary}>
          <span style={cardTitle}>Edit details</span>
          <span style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>Name, severity, status, zones, notes</span>
        </summary>
        <div style={{ marginTop: 12 }}>
          <InjuryForm
            zones={zones}
            factorSuggestions={factorSuggestions}
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
              aggravatingFactors: injury.aggravatingFactors,
            }}
          />
        </div>
      </details>
    </PageShell>
  );
}

const panel: React.CSSProperties = { ...cardSurface, gap: 14 };
const heroCard: React.CSSProperties = { ...cardSurface, gap: 14 };
const muted: React.CSSProperties = { fontSize: 13, color: COLOR.textDim, lineHeight: 1.45 };

const chipRow: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" };

const statusPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 11px",
  borderRadius: RADIUS.pill,
  border: "1px solid",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.3,
};

const metaChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
  fontSize: 11.5,
  fontWeight: 700,
  color: COLOR.textDim,
};

const miniLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};

const factorChip: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(251,146,60,0.4)",
  background: "rgba(251,146,60,0.10)",
  color: "#FED7AA",
};

const statChipRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const statChip: React.CSSProperties = {
  flex: "1 1 90px",
  minWidth: 90,
  padding: "8px 12px",
  borderRadius: RADIUS.control,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
};
const statChipLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};
const statChipValue: React.CSSProperties = { fontSize: 22, fontWeight: 900, lineHeight: 1.15, marginTop: 2 };

const logPainButtonStyle: React.CSSProperties = {
  width: "100%",
  justifyContent: "center",
  minHeight: 46,
  fontSize: 14,
  fontWeight: 900,
  borderRadius: 12,
  border: "1px solid rgba(248,113,113,0.5)",
  background: "rgba(248,113,113,0.14)",
  color: "#FECACA",
};

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
