// Generic sport world page (golf, basketball, tennis, surfing, skiing, …).
// Self-contained — replaces the old delegation to SportsTargetPage, whose
// TargetHeader chrome, multi-tab branches, StatGrid snapshot, and stack of
// line charts buried the useful information.
//
// Structure follows the established world-page model (climbing/mobility/
// lifestyle set the pattern):
//   - Slim ActivityHeader (sport accent, Log + Map pills)
//   - Compact pulse strip: this wk / 4 wks / 12 wks / all time
//   - Sessions-per-week stacked chart with its own 4w/12w pill
//   - Goals section (goal cards for this sport)
//   - Supporting Training (routines tagged for this sport)
//   - Spots chips (when sessions carry locations)
//   - Recent sessions (10 + ?recent=all expansion)
//   - "More metrics" placeholder — the explicit slot where per-sport
//     metrics (session templates, peak stats) land as they're defined.
//
// Climbing never reaches this page (static /activities/climbing wins
// routing); endurance types live at /activities/endurance.

import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAppDate, relativeFromNow } from "@/lib/dates";
import { formatDuration } from "@/lib/progress";
import { getActivityEntry } from "@/lib/activity-families";
import { getActivitySpotConfig } from "@/lib/activity-spots";
import { getActivityGoals } from "@/lib/activity-goals";
import { sportAccent } from "@/lib/sport-accent";
import { getRoutineIndex, getRoutineLogs, resolveGroupTarget } from "@/app/progress/data";
import { getVirtualSportCategory, isSportGroup, isVirtualSportSlug } from "@/app/progress/sports";
import { loadActivityCoverage } from "@/app/progress/details/activity-coverage-loader";
import ActivityGoalsSection from "@/app/progress/details/ActivityGoalsSection";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import ActivityHeader from "@/app/activities/_shared/ActivityHeader";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { buildSessionsChartData, type SessionChartWeeks } from "@/lib/activities/sessions-chart";
import { formatRoutineSubtype } from "@/lib/routines";

export const dynamic = "force-dynamic";

const RECENT_DEFAULT = 10;
const RECENT_MAX = 100;

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseChartWeeks(value: string | undefined): SessionChartWeeks {
  return value === "4w" ? 4 : 12;
}

function buildHref(slug: string, searchParams: SearchParams, overrides: Record<string, string | undefined>): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") next[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  const qs = new URLSearchParams(next).toString();
  return `/activities/${slug}${qs ? `?${qs}` : ""}`;
}

function startOfWeekMonday(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

export default async function SportWorldPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const chartWeeks = parseChartWeeks(getParam(searchParams, "chart"));
  const recentExpanded = getParam(searchParams, "recent") === "all";
  const now = new Date();

  // ── Resolve the sport + load ALL its logs (bilingual) ───────────────────
  type SportLogs = Awaited<ReturnType<typeof getRoutineLogs>>;
  let title = "";
  let logs: SportLogs = [];

  const virtualSport = getVirtualSportCategory(params.slug);
  if (virtualSport) {
    const [routines, allLogs] = await Promise.all([getRoutineIndex(), getRoutineLogs("all")]);
    const routineIds = new Set(
      routines
        .filter((routine) => routine.isActive && routine.kind === "SESSION" && routine.subtype === virtualSport.subtype)
        .map((routine) => routine.id)
    );
    logs = allLogs.filter((log) => routineIds.has(log.routineId));
    title = virtualSport.label;
  } else {
    if (isVirtualSportSlug(params.slug)) notFound();
    const target = await resolveGroupTarget(params.slug, "all");
    if (!target || !isSportGroup(target.group)) {
      notFound();
    }
    title = target.group.label;

    // Bilingual: merge logs against the synthetic per-sport routine —
    // sports logged via the sport-tile flow on /log land there instead
    // of any legacy metadata-tagged routine.
    const { getSyntheticSportRoutineId } = await import("@/lib/synthetic-sport-routines");
    const syntheticId = getSyntheticSportRoutineId(params.slug);
    const allLogs = await getRoutineLogs("all");
    const syntheticLogs = allLogs.filter((l) => l.routineId === syntheticId);
    const seen = new Set<string>(target.logs.map((l) => l.id));
    logs = [
      ...target.logs,
      ...syntheticLogs.filter((l) => !seen.has(l.id)),
    ].sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime());
  }

  const goalLookupSlug = virtualSport ? "board-sports" : params.slug;
  const [coverage, sportGoals] = await Promise.all([
    loadActivityCoverage(params.slug, virtualSport),
    getActivityGoals(goalLookupSlug),
  ]);

  const accent = sportAccent(params.slug);
  const entry = getActivityEntry(params.slug);
  const supportsMap = !!getActivitySpotConfig(params.slug)?.supportsMap;

  // ── Pulse rollups (fixed windows + all time) ────────────────────────────
  const thisWeekStart = startOfWeekMonday(now);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 86_400_000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 86_400_000);
  const sessionsThisWeek = logs.filter((l) => l.performedAt >= thisWeekStart).length;
  const sessions4w = logs.filter((l) => l.performedAt >= fourWeeksAgo).length;
  const sessions12w = logs.filter((l) => l.performedAt >= twelveWeeksAgo).length;

  // ── Chart — sessions per week stacked by routine ────────────────────────
  const chartCutoff = new Date(now.getTime() - chartWeeks * 7 * 86_400_000);
  const chartData = buildSessionsChartData(
    logs
      .filter((l) => l.performedAt >= chartCutoff)
      .map((l) => ({
        id: l.id,
        date: l.performedAt,
        routineId: l.routineId,
        routineName: l.routine.name,
      })),
    { accentFirst: accent, now, weeks: chartWeeks }
  );
  const chartHasData = chartData.series.some((s) => s.weeklyValues.some((v) => v > 0));

  // ── Spots chips ─────────────────────────────────────────────────────────
  const topSpots = Array.from(
    logs.reduce((map, log) => {
      const key = log.location?.trim();
      if (!key) return map;
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  // ── Recent sessions ─────────────────────────────────────────────────────
  const recentCount = recentExpanded ? RECENT_MAX : RECENT_DEFAULT;
  const recentSessions = logs.slice(0, recentCount);
  const recentHasMore = !recentExpanded && logs.length > RECENT_DEFAULT;

  return (
    <div style={pageStyle}>
      <ActivityHeader
        title={title}
        accent={accent}
        actions={
          <>
            <Link href="/log" style={headerPillStyle}>📋 Log</Link>
            {supportsMap ? (
              <Link href={`/activities/${params.slug}/map`} style={headerPillStyle}>🗺 Map</Link>
            ) : null}
          </>
        }
      />

      {/* ── Pulse strip ───────────────────────────────────────────── */}
      <div style={pulseStripStyle(accent)}>
        <PulseStat label="This wk" value={sessionsThisWeek} accent={accent} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="4 wks" value={sessions4w} accent={accent} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="12 wks" value={sessions12w} accent={accent} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="All time" value={logs.length} accent={accent} />
      </div>

      {/* ── Chart + its range pill ────────────────────────────────── */}
      {chartHasData ? (
        <>
          <div style={chartPillRowStyle}>
            <span style={chartPillLabelStyle}>Chart range</span>
            {(["4w", "12w"] as const).map((w) => (
              <Link
                key={w}
                href={buildHref(params.slug, searchParams, { chart: w === "12w" ? undefined : w })}
                style={chartWeeks === (w === "4w" ? 4 : 12) ? pillSelectStyle : pillStyle}
              >
                {w}
              </Link>
            ))}
          </div>
          <WeeklyBarChartWithSessions
            title={`${title} Sessions per Week — Last ${chartWeeks} Weeks`}
            weekLabels={chartData.weekLabels}
            series={chartData.series}
            sessionsByWeek={chartData.sessionsByWeek}
            unit=""
            decimals={0}
            compact={false}
          />
        </>
      ) : null}

      {/* ── Goals ─────────────────────────────────────────────────── */}
      <ActivityGoalsSection goals={sportGoals} activitySlug={goalLookupSlug} activityLabel={title} />

      {/* ── Supporting training ───────────────────────────────────── */}
      {coverage && coverage.trainingRoutines.length > 0 ? (
        <SectionCard
          title="Supporting Training"
          subtitle={`Strength, conditioning, and habit work tagged to ${title.toLowerCase()}.`}
        >
          <div style={{ display: "grid", gap: 8 }}>
            {coverage.trainingRoutines.map((r) => {
              const widthPct = Math.round((r.sessions / coverage.trainingMax) * 100);
              return (
                <div key={r.routineId} style={{ display: "grid", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.9 }}>{r.name}</span>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span style={{ fontSize: 11, opacity: 0.5 }}>last {formatAppDate(r.lastDate, { month: "short", day: "numeric" })}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55 }}>{r.sessions}×</span>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${widthPct}%`, borderRadius: 999, background: "rgba(168,85,247,0.75)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      {/* ── Spots ─────────────────────────────────────────────────── */}
      {topSpots.length > 0 ? (
        <SectionCard title="Spots" subtitle="Where these sessions happened.">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topSpots.slice(0, 8).map(([name, count]) => (
              <span key={name} style={spotChipStyle}>
                {name} <span style={{ opacity: 0.55 }}>{count}×</span>
              </span>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {/* ── Recent sessions ───────────────────────────────────────── */}
      <SectionCard
        title="Recent Sessions"
        subtitle={
          recentSessions.length === 0
            ? undefined
            : recentExpanded
              ? `Showing ${recentSessions.length} of ${logs.length}.`
              : `Last ${recentSessions.length} of ${logs.length}.`
        }
      >
        {recentSessions.length === 0 ? (
          <EmptyState message={`Log a ${title.toLowerCase()} session from the SPORT section on /log to start the timeline.`} />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentSessions.map((log) => {
              const chips = [
                (log.durationSec ?? 0) > 0 ? formatDuration(log.durationSec ?? 0) : null,
                (log.distanceMi ?? 0) > 0 ? `${(log.distanceMi ?? 0).toFixed(1)} mi` : null,
                log.location?.trim() || null,
              ].filter((v): v is string => Boolean(v));
              return (
                <Link
                  key={log.id}
                  href={`/routines/${log.routineId}/logs/${log.id}/details`}
                  style={sessionRowStyle}
                >
                  <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.2 }}>
                      {formatAppDate(log.performedAt, { weekday: "short", month: "short", day: "numeric" })}
                      <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, opacity: 0.55 }}>
                        · {relativeFromNow(log.performedAt, now)}
                      </span>
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.65, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {chips.length > 0 ? chips.join(" · ") : log.routine.subtype ? formatRoutineSubtype(log.routine.subtype) : log.routine.name}
                      {log.notes?.trim() ? ` · ${log.notes.trim()}` : ""}
                    </span>
                  </div>
                </Link>
              );
            })}
            {recentHasMore ? (
              <Link href={buildHref(params.slug, searchParams, { recent: "all" })} style={viewAllLinkStyle}>
                View all {logs.length} sessions →
              </Link>
            ) : null}
            {recentExpanded && logs.length > RECENT_DEFAULT ? (
              <Link href={buildHref(params.slug, searchParams, { recent: undefined })} style={viewAllLinkStyle}>
                Show fewer ↑
              </Link>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* ── Room to grow — explicit slot for future per-sport metrics. ── */}
      <div style={comingSoonStyle}>
        More {title.toLowerCase()} metrics land here as they&apos;re defined — session
        templates with peak stats unlock performance trends and PR cards
        {entry?.eyebrow ? ` for ${entry.eyebrow.toLowerCase()}` : ""}.
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/log" style={quickLinkStyle}>Log a session →</Link>
        <Link href="/activities" style={quickLinkStyle}>Back to Activities</Link>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PulseStat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div style={pulseStatStyle}>
      <div style={{ ...pulseValueStyle, color: accent }}>{value}</div>
      <div style={pulseLabelStyle}>{label}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "18px 14px 60px",
  display: "grid",
  gap: 16,
};

const headerPillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  textDecoration: "none",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  minHeight: 34,
};

function pulseStripStyle(accent: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    padding: "8px 12px",
    borderRadius: 12,
    border: `1px solid ${accent.replace("0.9)", "0.28)")}`,
    background: `linear-gradient(180deg, ${accent.replace("0.9)", "0.08)")}, rgba(255,255,255,0.02))`,
  };
}

const pulseDividerStyle: React.CSSProperties = {
  width: 1,
  alignSelf: "stretch",
  background: "rgba(255,255,255,0.08)",
  flexShrink: 0,
};

const pulseStatStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  textAlign: "center",
  flex: 1,
  minWidth: 0,
};

const pulseLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
  whiteSpace: "nowrap",
};

const pulseValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
};

const chartPillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const chartPillLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.55,
  textTransform: "uppercase",
  marginRight: 4,
};

const pillStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const pillSelectStyle: React.CSSProperties = {
  ...pillStyle,
  background: "rgba(120,190,255,0.15)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "rgba(191,219,254,0.98)",
};

const spotChipStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
};

const sessionRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const viewAllLinkStyle: React.CSSProperties = {
  display: "block",
  textAlign: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  marginTop: 4,
};

const comingSoonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.12)",
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.6,
};

const quickLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};
