// Endurance world page — type/family driven view that replaces the
// generic SportsTargetPage rendering for the endurance slug. Tabs flip
// between an Overview (all families side by side) and one tab per family
// (Running, Walking, Cycling, Swimming, Rowing). A sub-filter narrows
// the active family to a specific type.
//
// Stats are computed in-memory from a single bounded query (range filter
// keeps the dataset small). Logs against the synthetic Endurance routine
// + logs against legacy endurance routines both surface via their
// activityType — see getLogDisplayName for the resolution logic.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate, relativeFromNow } from "@/lib/dates";
import { SectionCard, SectionLinkButton, EmptyState } from "@/app/progress/ui";
import ActivityHeader from "@/app/activities/_shared/ActivityHeader";
import { domainColor } from "@/lib/routines";
import { getLogDisplayName } from "@/lib/routine-display";
import { loadEnduranceChartData } from "@/lib/activities/endurance-chart";
import { loadEndurancePaceChart } from "@/lib/activities/endurance-pace";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import PaceLineChart from "@/app/activities/_shared/PaceLineChart";
import ActivityGoalsSection from "@/app/progress/details/ActivityGoalsSection";
import { getDomainGoals, frequencyChipFor } from "@/lib/activity-goals";
import EnduranceQuickLogButton from "@/app/routines/EnduranceQuickLogButton";
import EnduranceFilterBar from "./EnduranceFilterBar";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// Range filter — ONE control that drives the charts AND the stats/lists
// below (4w/12w narrow the charts; "all" widens stats/lists to all-time
// while charts stay at their 12-week max). Yearly evaluation lives on
// /reports, so the old 7d/1y options collapsed into this set; legacy URLs
// normalize.
type RangeFilter = "4w" | "12w" | "all";

const RANGE_DAYS: Record<Exclude<RangeFilter, "all">, number> = {
  "4w": 28,
  "12w": 84,
};

function parseRange(value: string | undefined): RangeFilter {
  if (value === "4w" || value === "12w" || value === "all") return value;
  if (value === "7d") return "4w";
  if (value === "1y") return "all";
  return "4w";
}

function cutoffForRange(range: RangeFilter): Date | null {
  if (range === "all") return null;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  return cutoff;
}

function rangeLabel(range: RangeFilter): string {
  if (range === "4w") return "Last 4 weeks";
  if (range === "12w") return "Last 12 weeks";
  return "All time";
}

function buildHref(params: SearchParams, overrides: Record<string, string | undefined>): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") next[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  const qs = new URLSearchParams(next).toString();
  return `/activities/endurance${qs ? `?${qs}` : ""}`;
}

export default async function EnduranceWorldPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const familySlug = getParam(searchParams, "family") ?? "overview";
  const typeSlug = getParam(searchParams, "type") ?? null;
  const range = parseRange(getParam(searchParams, "range"));

  const cutoff = cutoffForRange(range);
  // Charts follow the range: 4w → 4-week charts; 12w/all → the 12-week max.
  const chartWeeks = range === "4w" ? 4 : 12;

  const [families, logs, chartData, paceData, domainGoals, prPool] = await Promise.all([
    prisma.enduranceFamily.findMany({
      orderBy: [{ sortOrder: "asc" }],
      include: {
        types: { orderBy: [{ sortOrder: "asc" }], select: { id: true, slug: true, name: true } },
      },
    }),
    // Pull every endurance log in the range. "Endurance" here means
    // either a typed log (activityTypeId set) or a legacy log against a
    // CARDIO routine. The display path uses activityType when present.
    prisma.routineLog.findMany({
      where: {
        AND: [
          cutoff ? { performedAt: { gte: cutoff } } : {},
          {
            OR: [
              { activityTypeId: { not: null } },
              { routine: { kind: "CARDIO", isPlaceholder: false } },
            ],
          },
        ],
      },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        routineId: true,
        performedAt: true,
        distanceMi: true,
        durationSec: true,
        elevationGainFt: true,
        activityTypeId: true,
        activityType: { select: { name: true, familyId: true } },
        routine: {
          select: {
            name: true,
            activityType: { select: { name: true, familyId: true } },
          },
        },
      },
    }),
    // Stacked-bar chart data — narrows by the active family/type filter AND
    // the range (4w → 4-week window).
    loadEnduranceChartData({ familySlug, typeSlug, weeks: chartWeeks }),
    // Pace chart — multi-line by type on Overview / family views, switches
    // to per-session points when a specific type is selected.
    loadEndurancePaceChart({ familySlug, typeSlug, weeks: chartWeeks }),
    // Goals pointed at the endurance domain (incl. "Endurance 3×/week"
    // domain goals) — powers the header chip + Active Goals section.
    getDomainGoals("cardio"),
    // All-time slim pool for the Bests tiles — deliberately NOT range
    // filtered (a PR is a PR regardless of the page's range pills).
    prisma.routineLog.findMany({
      where: {
        OR: [
          { activityTypeId: { not: null } },
          { routine: { kind: "CARDIO", isPlaceholder: false } },
        ],
      },
      select: {
        performedAt: true,
        distanceMi: true,
        durationSec: true,
        elevationGainFt: true,
        activityTypeId: true,
        activityType: { select: { familyId: true } },
        routine: { select: { activityType: { select: { familyId: true } } } },
      },
    }),
  ]);

  // Resolve each log's family — prefer log.activityType, fall back to
  // the routine's. Logs with no resolution land in an "Unclassified"
  // bucket so they don't disappear from totals.
  type ResolvedLog = (typeof logs)[number] & { resolvedFamilyId: string | null };
  const resolvedLogs: ResolvedLog[] = logs.map((log) => ({
    ...log,
    resolvedFamilyId:
      log.activityType?.familyId ?? log.routine.activityType?.familyId ?? null,
  }));

  // ── Family-level rollup ─────────────────────────────────────────────────
  type FamilyRollup = {
    id: string;
    slug: string;
    name: string;
    types: Array<{ id: string; slug: string; name: string }>;
    sessions: number;
    distanceMi: number;
    durationSec: number;
    elevationGainFt: number;
    lastSession: Date | null;
  };
  const rollups: FamilyRollup[] = families.map((f) => {
    const familyLogs = resolvedLogs.filter((l) => l.resolvedFamilyId === f.id);
    return {
      id: f.id,
      slug: f.slug,
      name: f.name,
      types: f.types,
      sessions: familyLogs.length,
      distanceMi: familyLogs.reduce((acc, l) => acc + (l.distanceMi ?? 0), 0),
      durationSec: familyLogs.reduce((acc, l) => acc + (l.durationSec ?? 0), 0),
      elevationGainFt: familyLogs.reduce((acc, l) => acc + (l.elevationGainFt ?? 0), 0),
      lastSession: familyLogs[0]?.performedAt ?? null,
    };
  });

  const activeFamily = families.find((f) => f.slug === familySlug) ?? null;
  const activeType = activeFamily?.types.find((t) => t.slug === typeSlug) ?? null;

  // Logs scoped to the active family + optional type for the family tab body.
  const scopedLogs = activeFamily
    ? resolvedLogs.filter((l) => {
        if (l.resolvedFamilyId !== activeFamily.id) return false;
        if (activeType && l.activityTypeId !== activeType.id) return false;
        return true;
      })
    : [];

  // All-time bests for the active family/type slice. Pace requires ≥1 mi so a
  // 0.2-mi jog can't fake a PR.
  type Best = { value: number; date: Date } | null;
  let bestLongest: Best = null;
  let bestPace: Best = null;
  let bestElevation: Best = null;
  if (activeFamily) {
    for (const l of prPool) {
      const famId = l.activityType?.familyId ?? l.routine.activityType?.familyId ?? null;
      if (famId !== activeFamily.id) continue;
      if (activeType && l.activityTypeId !== activeType.id) continue;
      if (l.distanceMi && l.distanceMi > 0 && (!bestLongest || l.distanceMi > bestLongest.value)) {
        bestLongest = { value: l.distanceMi, date: l.performedAt };
      }
      if (l.distanceMi && l.distanceMi >= 1 && l.durationSec && l.durationSec > 0) {
        const pace = l.durationSec / l.distanceMi;
        if (!bestPace || pace < bestPace.value) bestPace = { value: pace, date: l.performedAt };
      }
      if (l.elevationGainFt && l.elevationGainFt > 0 && (!bestElevation || l.elevationGainFt > bestElevation.value)) {
        bestElevation = { value: l.elevationGainFt, date: l.performedAt };
      }
    }
  }
  const bests = { longest: bestLongest, pace: bestPace, elevation: bestElevation };

  return (
    <>
      <div style={{ maxWidth: "var(--app-width-wide)", margin: "0 auto", padding: "14px 14px 20px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, minWidth: 0 }}>
        <ActivityHeader
          title="Endurance"
          accent={domainColor("cardio")}
          frequencyChip={frequencyChipFor(domainGoals)}
          actions={
            <>
              {/* Opens the endurance log drawer directly (type picker inside)
                  instead of detouring through /log. */}
              <EnduranceQuickLogButton label="📋 Log" style={headerLogBtnStyle} />
              <SectionLinkButton href="/activities/endurance/settings" label="⚙ Settings" />
            </>
          }
        />
        {/* ONE filter bar — activity (family+type merged) + range, and the
            range drives the charts too. Replaces the old stacked family-tab
            row + type sub-pill row + separate range row. */}
        <EnduranceFilterBar
          families={rollups.map((r) => ({
            slug: r.slug,
            name: r.name,
            sessions: r.sessions,
            types: r.types.map((t) => ({ slug: t.slug, name: t.name })),
          }))}
          familySlug={familySlug}
          typeSlug={activeType?.slug ?? null}
          range={range}
        />

        {/* Interactive stacked bar chart — follows the activity + range filters. */}
        {chartData.series.length > 0 ? (
          <WeeklyBarChartWithSessions
            title={
              activeType
                ? `Miles per Week — ${activeType.name} · Last ${chartWeeks} Weeks`
                : activeFamily
                ? `Miles per Week — ${activeFamily.name} · Last ${chartWeeks} Weeks`
                : `Miles per Week by Activity — Last ${chartWeeks} Weeks`
            }
            weekLabels={chartData.weekLabels}
            series={chartData.series}
            sessionsByWeek={chartData.sessionsByWeek}
            unit="mi"
            decimals={1}
            primaryLabel="Miles"
            secondaryLabel="Time"
            secondaryUnit="min"
            tertiaryLabel="Elevation"
            tertiaryUnit="ft"
            // Opt out of compact mode — at 760px max-width the chart
            // reads better with the taller (132px) bar track. Compact
            // (96px) makes 12 bars look squat at desktop densities.
            compact={false}
          />
        ) : null}

        {/* Pace chart — follows the same filters. Multi-line when the page
            is unscoped or scoped to a family; one point per session when a
            specific type is selected. */}
        {paceData ? (
          <PaceLineChart
            title={
              paceData.mode === "weekly"
                ? activeFamily
                  ? `Average Pace per Week — ${activeFamily.name} · Last ${chartWeeks} Weeks`
                  : `Average Pace per Week — Last ${chartWeeks} Weeks`
                : `${paceData.typeName} · Pace per Session — Last ${chartWeeks} Weeks`
            }
            subtitle={
              paceData.mode === "weekly"
                ? "Mileage-weighted average per activity type. Lower on the chart = faster."
                : `${paceData.points.length} session${paceData.points.length === 1 ? "" : "s"} · dot size reflects distance.`
            }
            data={paceData}
          />
        ) : null}

        <ActivityGoalsSection
          goals={domainGoals}
          activitySlug="endurance"
          activityLabel="Endurance"
          showWhenEmpty={false}
          collapsible
        />

        {/* Overview tab: side-by-side family cards */}
        {familySlug === "overview" ? (
          <SectionCard
            title="By family"
            subtitle={`${resolvedLogs.length} session${resolvedLogs.length === 1 ? "" : "s"} · ${rangeLabel(range).toLowerCase()}`}
          >
            {rollups.every((r) => r.sessions === 0) ? (
              <EmptyState message="No endurance logged in this range." />
            ) : (
              <div className="climbing-detail-grid">
                {rollups
                  .filter((r) => r.sessions > 0)
                  .map((r) => (
                    <FamilyStatCard key={r.id} rollup={r} href={buildHref(searchParams, { family: r.slug, type: undefined })} />
                  ))}
              </div>
            )}
          </SectionCard>
        ) : activeFamily ? (
          <FamilyDetailView
            family={activeFamily}
            rollup={rollups.find((r) => r.id === activeFamily.id)!}
            activeTypeId={activeType?.id ?? null}
            activeTypeSlug={activeType?.slug ?? null}
            logs={scopedLogs}
            searchParams={searchParams}
            range={range}
            bests={bests}
          />
        ) : (
          <SectionCard title="Family not found">
            <EmptyState message="Pick a family from the tabs above." />
          </SectionCard>
        )}
      </div>
    </>
  );
}

// ── Chip components ─────────────────────────────────────────────────────────

function FamilyStatCard({
  rollup,
  href,
}: {
  rollup: {
    name: string;
    sessions: number;
    distanceMi: number;
    durationSec: number;
    elevationGainFt: number;
    lastSession: Date | null;
  };
  href: string;
}) {
  return (
    <Link href={href} style={statCardStyle}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>{rollup.name}</div>
        <div style={statRowStyle}>
          <Stat label="Sessions" value={String(rollup.sessions)} />
          <Stat label="Distance" value={`${rollup.distanceMi.toFixed(1)} mi`} />
          <Stat label="Time" value={formatHM(rollup.durationSec)} />
          {rollup.elevationGainFt > 0 && (
            <Stat label="Elev" value={`${Math.round(rollup.elevationGainFt)} ft`} />
          )}
        </div>
        {rollup.lastSession && (
          <div style={{ fontSize: 11, opacity: 0.55 }}>
            Last · {formatAppDate(rollup.lastSession, { month: "short", day: "numeric" })} · {relativeFromNow(rollup.lastSession)}
          </div>
        )}
      </div>
    </Link>
  );
}

function FamilyDetailView({
  family,
  rollup,
  activeTypeId,
  activeTypeSlug,
  logs,
  searchParams,
  range,
  bests,
}: {
  family: { id: string; slug: string; name: string; types: Array<{ id: string; slug: string; name: string }> };
  rollup: { sessions: number; distanceMi: number; durationSec: number; elevationGainFt: number };
  activeTypeId: string | null;
  activeTypeSlug: string | null;
  logs: Array<{
    id: string;
    routineId: string;
    performedAt: Date;
    distanceMi: number | null;
    durationSec: number | null;
    elevationGainFt: number | null;
    activityTypeId: string | null;
    activityType: { name: string; familyId: string } | null;
    routine: { name: string; activityType: { name: string; familyId: string } | null };
  }>;
  searchParams: SearchParams;
  range: RangeFilter;
  bests: {
    longest: { value: number; date: Date } | null;
    pace: { value: number; date: Date } | null;
    elevation: { value: number; date: Date } | null;
  };
}) {
  // Scoped stats reflect the active type filter (if set), otherwise the
  // whole family.
  const scopedStats = {
    sessions: logs.length,
    distanceMi: logs.reduce((acc, l) => acc + (l.distanceMi ?? 0), 0),
    durationSec: logs.reduce((acc, l) => acc + (l.durationSec ?? 0), 0),
    elevationGainFt: logs.reduce((acc, l) => acc + (l.elevationGainFt ?? 0), 0),
  };

  void rollup; // family-level rollup is the unfiltered version — kept for future use

  // activeTypeSlug + searchParams are now consumed only by the page-level
  // type sub-filter above; keep them in the props for parity with the
  // FamilyDetailView contract.
  void activeTypeSlug;
  void searchParams;

  const hasBests = bests.longest || bests.pace || bests.elevation;

  return (
    <>
      {/* All-time bests — independent of the range filter. */}
      {hasBests ? (
        <SectionCard
          title={activeTypeId ? `Bests · ${family.types.find((t) => t.id === activeTypeId)?.name ?? ""}` : `Bests · All ${family.name}`}
          subtitle="all time"
        >
          <div style={statRowStyle}>
            {bests.longest ? (
              <Stat
                label="Longest"
                value={`${bests.longest.value.toFixed(1)} mi`}
                sub={formatAppDate(bests.longest.date, { month: "short", day: "numeric", year: "numeric" })}
              />
            ) : null}
            {bests.pace ? (
              <Stat
                label="Fastest pace"
                value={formatPaceSec(bests.pace.value)}
                sub={formatAppDate(bests.pace.date, { month: "short", day: "numeric", year: "numeric" })}
              />
            ) : null}
            {bests.elevation ? (
              <Stat
                label="Most elevation"
                value={`${Math.round(bests.elevation.value)} ft`}
                sub={formatAppDate(bests.elevation.date, { month: "short", day: "numeric", year: "numeric" })}
              />
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {/* Stats */}
      <SectionCard
        title={activeTypeId ? `Stats · ${family.types.find((t) => t.id === activeTypeId)?.name ?? ""}` : `Stats · All ${family.name}`}
        subtitle={`${rangeLabel(range).toLowerCase()}`}
      >
        <div style={statRowStyle}>
          <Stat label="Sessions" value={String(scopedStats.sessions)} />
          <Stat label="Distance" value={`${scopedStats.distanceMi.toFixed(1)} mi`} />
          <Stat label="Time" value={formatHM(scopedStats.durationSec)} />
          {scopedStats.elevationGainFt > 0 && (
            <Stat label="Elevation" value={`${Math.round(scopedStats.elevationGainFt)} ft`} />
          )}
        </div>
      </SectionCard>

      {/* Recent sessions */}
      <SectionCard title="Recent sessions" subtitle={logs.length === 0 ? "Nothing logged for this slice yet." : undefined}>
        {logs.length === 0 ? (
          <EmptyState message={`No ${activeTypeId ? family.types.find((t) => t.id === activeTypeId)?.name : family.name} sessions in this range.`} />
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {logs.slice(0, 30).map((log) => (
              <Link
                key={log.id}
                href={`/routines/${log.routineId}/logs/${log.id}/details`}
                style={logRowStyle}
              >
                <div style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{getLogDisplayName(log)}</span>
                  <span style={{ fontSize: 11, opacity: 0.65 }}>
                    {formatAppDate(log.performedAt, { weekday: "short", month: "short", day: "numeric" })} · {relativeFromNow(log.performedAt)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, fontSize: 11.5, opacity: 0.8 }}>
                  {log.distanceMi != null && <span>{log.distanceMi.toFixed(1)} mi</span>}
                  {log.durationSec != null && <span>· {formatHM(log.durationSec)}</span>}
                  {log.elevationGainFt && log.elevationGainFt > 0 && <span>· {Math.round(log.elevationGainFt)} ft</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={statBoxStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
      {sub ? <div style={{ fontSize: 10, opacity: 0.5, fontWeight: 700, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function formatPaceSec(secPerMi: number): string {
  const m = Math.floor(secPerMi / 60);
  const s = Math.round(secPerMi % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function formatHM(totalSec: number): string {
  if (!totalSec || !Number.isFinite(totalSec) || totalSec <= 0) return "—";
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Styles ──────────────────────────────────────────────────────────────────

// Mirrors app/progress/ui's SectionLinkButton pill so the Log button sits
// visually identical next to the Settings link.
const headerLogBtnStyle: React.CSSProperties = {
  padding: "6px 11px",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 999,
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  background: "rgba(255,255,255,0.06)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  fontFamily: "inherit",
};

const statCardStyle: React.CSSProperties = {
  display: "block",
  padding: 14,
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  textDecoration: "none",
  color: "inherit",
  cursor: "pointer",
};

const statRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const statBoxStyle: React.CSSProperties = {
  flex: "1 1 90px",
  minWidth: 70,
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const logRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  color: "inherit",
  textDecoration: "none",
};
