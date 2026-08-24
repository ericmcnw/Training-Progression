import type React from "react";
import { notFound } from "next/navigation";
import HistoryBackButton from "@/app/components/HistoryBackButton";
import BodyMap from "@/app/components/body-map/BodyMap";
import InjuryForm from "@/app/components/injuries/InjuryForm";
import LogPainButton from "@/app/components/injuries/LogPainButton";
import DeletePainLogButton from "@/app/components/injuries/DeletePainLogButton";
import EditPainLogButton from "@/app/components/injuries/EditPainLogButton";
import { type PainTrendPoint } from "@/app/components/injuries/PainTrendLine";
import InjuryTrainingLoad from "@/app/components/injuries/InjuryTrainingLoad";
import { getInjuryTrainingHeatmap } from "./training-heatmap";
import { getWeekBoundsSunday } from "@/lib/week";
import PageShell from "@/app/components/PageShell";
import { cardSurface, cardTitle, COLOR, RADIUS } from "@/lib/design-tokens";
import { getInjury, updateInjury, getAggravatingFactorSuggestions } from "../actions";
import InjuryStatusButtons from "./InjuryStatusButtons";
import { prisma } from "@/lib/prisma";
import { addDaysYmd, formatAppDate, formatAppDateTime, toAppYmd, todayAppYmd, diffYmdDays } from "@/lib/dates";
import type { CoverageDetailLog } from "@/app/progress/coverage";

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

const POST_ACTIVITY_CONTEXTS = new Set(["AFTER_ACTIVITY", "DURING_ACTIVITY"]);

type PainLogRow = {
  id: string;
  level: number;
  context: string;
  loggedAt: Date;
  aggravatingFactors: string[];
  routineLog: { routine: { name: string } } | null;
};

function painColor(level: number): string {
  if (level >= 8) return "#F87171";
  if (level >= 5) return "#FBBF24";
  if (level >= 3) return "#A3E635";
  return "rgba(255,255,255,0.55)";
}

// Per-day peak pain, oldest → newest — the point series the trend line draws.
// Each day's representative is its highest-pain log, so tapping a point can
// surface that log's routine + aggravating factors.
function dailyPainPeaks(rows: PainLogRow[]): PainTrendPoint[] {
  const byDay = new Map<string, PainLogRow>();
  for (const row of rows) {
    const ymd = toAppYmd(row.loggedAt);
    const existing = byDay.get(ymd);
    if (!existing || row.level > existing.level) byDay.set(ymd, row);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ymd, log]) => ({
      ymd,
      level: log.level,
      routineName: log.routineLog?.routine?.name ?? null,
      factors: log.aggravatingFactors,
      context: log.context,
    }));
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type FactorCorrelation = { factor: string; avg: number; peak: number; count: number };

// Each saved aggravating factor and the average pain logged when it was present.
function buildFactorCorrelations(rows: PainLogRow[]): FactorCorrelation[] {
  const byFactor = new Map<string, { sum: number; peak: number; count: number }>();
  for (const row of rows) {
    for (const f of row.aggravatingFactors) {
      const cur = byFactor.get(f) ?? { sum: 0, peak: 0, count: 0 };
      cur.sum += row.level;
      cur.peak = Math.max(cur.peak, row.level);
      cur.count += 1;
      byFactor.set(f, cur);
    }
  }
  return [...byFactor.entries()]
    .map(([factor, s]) => ({ factor, avg: Math.round((s.sum / s.count) * 10) / 10, peak: s.peak, count: s.count }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count);
}

type PostSpike = {
  id: string;
  level: number;
  routineName: string | null;
  factors: string[];
  loggedAt: Date;
  delta: number;
};

// Post-activity pain logs whose level sits above the injury's median baseline —
// the sessions that actually flared it, ranked by how high they spiked.
function buildPostActivitySpikes(rows: PainLogRow[], baseline: number): PostSpike[] {
  return rows
    .filter((r) => POST_ACTIVITY_CONTEXTS.has(r.context) && r.level > baseline)
    .sort((a, b) => b.level - a.level || b.loggedAt.getTime() - a.loggedAt.getTime())
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      level: r.level,
      routineName: r.routineLog?.routine?.name ?? null,
      factors: r.aggravatingFactors,
      loggedAt: r.loggedAt,
      delta: Math.round((r.level - baseline) * 10) / 10,
    }));
}

type Trajectory = { dir: "improving" | "stable" | "worsening"; label: string };

// Least-squares slope of the last two weeks of daily pain peaks → is this
// injury trending better or worse? Needs ≥3 recent points to say anything.
function computeTrajectory(points: PainTrendPoint[], todayYmd: string): Trajectory | null {
  const cutoff = addDaysYmd(todayYmd, -14);
  const recent = points.filter((p) => p.ymd >= cutoff);
  if (recent.length < 3) return null;
  const x0 = Date.parse(`${recent[0].ymd}T00:00:00Z`) / 86_400_000;
  const xs = recent.map((p) => Date.parse(`${p.ymd}T00:00:00Z`) / 86_400_000 - x0);
  const ys = recent.map((p) => p.level);
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const slopePerDay = num / den;
  if (slopePerDay <= -0.08) return { dir: "improving", label: "↓ improving" };
  if (slopePerDay >= 0.08) return { dir: "worsening", label: "↑ worsening" };
  return { dir: "stable", label: "→ stable" };
}

const TRAJECTORY_META: Record<Trajectory["dir"], { bg: string; border: string; color: string }> = {
  improving: { bg: "rgba(134,239,172,0.14)", border: "rgba(134,239,172,0.4)", color: "#86EFAC" },
  stable:    { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.7)" },
  worsening: { bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.42)", color: "#FCA5A5" },
};

type NextMorningRow = {
  logId: string;
  routineName: string;
  performedAtLabel: string;
  metric: string | null;
  reading: number | null;
};

// Recent zone-loading sessions × the NEXT morning's reading — the monitored-
// loading rule ("load is OK if it settles by the next morning") as a list.
// Prefers an explicit MORNING-context log the following day, else that day's
// earliest reading.
function buildNextMorningRows(
  heatmapCategories: Array<{ domains: Array<{ contributingLogs: CoverageDetailLog[] }> }>,
  painRows: Array<{ level: number; context: string; loggedAt: Date }>,
): NextMorningRow[] {
  const seen = new Set<string>();
  const pooled: CoverageDetailLog[] = [];
  for (const cat of heatmapCategories)
    for (const dr of cat.domains)
      for (const dl of dr.contributingLogs) {
        if (seen.has(dl.logId)) continue;
        seen.add(dl.logId);
        pooled.push(dl);
      }
  pooled.sort((a, b) => b.performedAt.localeCompare(a.performedAt));

  const byYmd = new Map<string, Array<{ level: number; context: string; loggedAt: Date }>>();
  for (const l of [...painRows].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime())) {
    const ymd = toAppYmd(l.loggedAt);
    const arr = byYmd.get(ymd) ?? [];
    arr.push(l);
    byYmd.set(ymd, arr);
  }

  return pooled.slice(0, 6).map((dl) => {
    const nextYmd = addDaysYmd(toAppYmd(new Date(dl.performedAt)), 1);
    const dayLogs = byYmd.get(nextYmd) ?? [];
    const reading = dayLogs.find((l) => l.context === "MORNING") ?? dayLogs[0] ?? null;
    const metric =
      dl.distanceMi && dl.distanceMi > 0
        ? `${dl.distanceMi >= 10 ? dl.distanceMi.toFixed(0) : dl.distanceMi.toFixed(1)} mi`
        : dl.durationSec && dl.durationSec > 0
          ? `${Math.round(dl.durationSec / 60)}m`
          : null;
    return {
      logId: dl.logId,
      routineName: dl.routineName,
      performedAtLabel: dl.performedAtLabel,
      metric,
      reading: reading ? reading.level : null,
    };
  });
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
  // Pain + load share this window: the Sunday of the injury's first week,
  // naturally capped to the 12-week cache by the timeline component.
  const loadWindowStartYmd = getWeekBoundsSunday(injury.startedAt).startYmd;
  const trendPoints = dailyPainPeaks(painLogs);
  const baselineMedian = median(painLogs.map((l) => l.level));
  const trajectory = computeTrajectory(trendPoints, today);
  const nextMorningRows = buildNextMorningRows(trainingHeatmap.categories, painLogs);
  const factorCorrelations = buildFactorCorrelations(painLogs);
  const postSpikes = buildPostActivitySpikes(painLogs, baselineMedian);
  const hasAggravatorData = factorCorrelations.length > 0 || postSpikes.length > 0;
  const recentLogs = painLogs.slice(0, RECENT_LOG_LIMIT);
  const olderLogCount = Math.max(0, painLogs.length - recentLogs.length);
  const daysInjured = Math.max(0, diffYmdDays(today, startedYmd));
  const startedLabel = formatAppDate(injury.startedAt, { month: "short", day: "numeric", year: "numeric" });
  const isResolved = injury.status === "RESOLVED";
  const status = STATUS_META[injury.status] ?? STATUS_META.ACTIVE;

  // Open the body map on the side that actually shows the injury — front-only
  // injuries default to the front view, back-only to the back, mixed (or a
  // both-sided zone) to both. The user can still toggle.
  const injuredViews = new Set(injury.zones.map((entry) => entry.zone.bodyView));
  const defaultBodyView: "front" | "back" | "both" =
    injuredViews.has("BOTH") || (injuredViews.has("FRONT") && injuredViews.has("BACK"))
      ? "both"
      : injuredViews.has("BACK")
        ? "back"
        : "front";

  return (
    <PageShell
      eyebrow="Injury"
      title={injury.name}
      toolbar={<HistoryBackButton fallbackHref="/profile/health" label="← Back" style={linkStyle} />}
    >
      {/* ── Hero: slim daily strip. A returning user needs "how is it +
          log today's reading" first — the identity block (map, factors,
          notes, status changes) collapses below since they already know
          their own injury. ─────────────────────────────────────────────── */}
      <section style={heroCard}>
        <div style={chipRow}>
          <span style={{ ...statusPill, background: status.bg, borderColor: status.border, color: status.color }}>{status.label}</span>
          {trajectory ? (
            <span
              style={{
                ...statusPill,
                background: TRAJECTORY_META[trajectory.dir].bg,
                borderColor: TRAJECTORY_META[trajectory.dir].border,
                color: TRAJECTORY_META[trajectory.dir].color,
              }}
              title="Trend of the last 2 weeks of daily pain readings"
            >
              {trajectory.label}
            </span>
          ) : null}
          <span style={metaChip}>{"●".repeat(injury.severity)}{"○".repeat(Math.max(0, 5 - injury.severity))} severity</span>
          <span style={metaChip}>{daysInjured === 0 ? "started today" : `${daysInjured} day${daysInjured === 1 ? "" : "s"}`}</span>
          <span style={metaChip}>since {startedLabel}</span>
        </div>

        {!isResolved && (
          <LogPainButton zones={painZones} factorSuggestions={factorSuggestions} style={logPainButtonStyle} />
        )}

        <details style={heroDetails}>
          <summary style={heroDetailsSummary}>Details, body map &amp; status</summary>
          <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
            <BodyMap
              zones={zoneSlugs.map((slug) => ({ slug, freshness: isResolved ? "RECOVERING" : "INJURED" }))}
              selectedSlugs={zoneSlugs}
              view={defaultBodyView}
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

            <InjuryStatusButtons id={injury.id} />
          </div>
        </details>
      </section>

      {/* ── Pain + training load (shared timeline) ───────────────────────── */}
      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div style={cardTitle}>Pain &amp; training load</div>
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
        <InjuryTrainingLoad
          data={trainingHeatmap}
          painPoints={trendPoints}
          windowStartYmd={loadWindowStartYmd}
        />
      </section>

      {/* ── Next-morning response — the monitored-loading rule as a list ── */}
      {nextMorningRows.length > 0 && painLogs.length > 0 && (
        <section style={panel}>
          <div style={cardTitle}>Next-morning response</div>
          <div style={{ fontSize: 12, color: COLOR.textDim, fontWeight: 600, lineHeight: 1.45 }}>
            Load is OK if it settles by the next morning. Each recent session that hit this area, against the
            following morning&rsquo;s reading (baseline {baselineMedian}/10).
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {nextMorningRows.map((row) => (
              <div key={row.logId} style={nextMorningRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.routineName}
                  </div>
                  <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700, marginTop: 2 }}>
                    {row.performedAtLabel}{row.metric ? ` · ${row.metric}` : ""}
                  </div>
                </div>
                {row.reading == null ? (
                  <span style={verdictNone}>no reading</span>
                ) : row.reading <= baselineMedian ? (
                  <span style={verdictSettled}>settled · {row.reading}/10</span>
                ) : (
                  <span style={verdictElevated}>↑ {row.reading}/10</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── What aggravates it ───────────────────────────────────────────── */}
      {hasAggravatorData && (
        <section style={panel}>
          <div style={cardTitle}>What aggravates it</div>

          {factorCorrelations.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={miniLabel}>Logged factors · average pain when present</div>
              {factorCorrelations.map((fc) => (
                <div key={fc.factor} style={aggravatorRow}>
                  <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                    <span style={{ ...factorChip, justifySelf: "start" }}>{fc.factor}</span>
                    <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700 }}>
                      {fc.count} log{fc.count === 1 ? "" : "s"} · peak {fc.peak}/10
                    </div>
                  </div>
                  <div style={{ minWidth: 110 }}>
                    <PainBar level={Math.round(fc.avg)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {postSpikes.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={miniLabel}>High pain after activity · above your median ({baselineMedian}/10)</div>
              {postSpikes.map((s) => (
                <div key={s.id} style={aggravatorRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 14 }}>{s.routineName ?? "After activity"}</div>
                    <div style={{ fontSize: 11, color: COLOR.textFaint, fontWeight: 700, marginTop: 2 }}>
                      {formatAppDate(s.loggedAt, { month: "short", day: "numeric" })} · +{s.delta} vs median
                    </div>
                    {s.factors.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
                        {s.factors.map((f) => (
                          <span key={f} style={factorChipSm}>{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 110 }}>
                    <PainBar level={s.level} />
                  </div>
                </div>
              ))}
            </div>
          )}
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

const heroDetails: React.CSSProperties = {
  border: `1px solid ${COLOR.border}`,
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.02)",
};
const heroDetailsSummary: React.CSSProperties = {
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 13,
  color: COLOR.textDim,
};

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

const factorChipSm: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid rgba(251,146,60,0.4)",
  background: "rgba(251,146,60,0.10)",
  color: "#FED7AA",
};

const statChipRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const nextMorningRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.02)",
};

const verdictBase: React.CSSProperties = {
  flexShrink: 0,
  fontSize: 11.5,
  fontWeight: 900,
  padding: "4px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};
const verdictSettled: React.CSSProperties = {
  ...verdictBase,
  border: "1px solid rgba(134,239,172,0.4)",
  background: "rgba(134,239,172,0.10)",
  color: "#86EFAC",
};
const verdictElevated: React.CSSProperties = {
  ...verdictBase,
  border: "1px solid rgba(248,113,113,0.42)",
  background: "rgba(248,113,113,0.12)",
  color: "#FCA5A5",
};
const verdictNone: React.CSSProperties = {
  ...verdictBase,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
  color: COLOR.textFaint,
};

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
