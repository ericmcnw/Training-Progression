// Climbing world hub — Phase 3.
//
// Replaces the SportsTargetPage indirection (the old /activities/climbing
// route went through app/activities/[slug]/page.tsx → SportsTargetPage,
// which conditionally hid tabs and rendered ClimbingWorldPage inside its
// shell). Static segment `climbing/` here takes routing precedence so
// `/activities/climbing` lands on this page directly.
//
// Structure (top to bottom):
//   - Hero with quick-log CTA
//   - Pulse strip (this week / 4w / 12w / all time sessions)
//   - Hub navigation tiles → Climbs · Projects · Map · Locations
//   - Sessions chart, stacked by climbing discipline, per-chart range pill
//   - Grade pyramid with conditional discipline filter pill (only renders
//     pills for disciplines that have data — boulder-only climbers don't
//     see top-rope/sport-lead clutter)
//   - Indoor / outdoor split card
//   - Active projects (top 3, with "view all" link)
//   - Recent locations (top 5)
//   - Recent sessions (10 default + expand via ?recent=all)
//   - Activity coverage heatmap (52 weeks)
//   - Quick links
//
// Session 2 expansion notes (intentional gaps):
//   - Active projects card could surface moves-completed bars per project
//     using ClimbAttempt.movesCompleted / totalMoves — collected today but
//     not visualized anywhere. See ProjectRollupRow.bestMoves.
//   - Send-rate trend chart (sends per attempts, weekly).
//   - Time-on-wall stat from RoutineLog.durationSec.
//   - Tries-to-send average from ClimbAttempt.triesCount.

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate, relativeFromNow, toAppYmd } from "@/lib/dates";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import {
  climbOutcomeColor,
  climbOutcomeBg,
  climbOutcomeLabel,
  gradeSort,
  PYRAMID_OUTCOMES,
  SENT_OUTCOMES,
  venueOf,
  type ClimbGradeSystem,
  type ClimbOutcome,
  type ClimbingDiscipline,
} from "@/lib/climb-types";
import {
  buildPyramidRows,
  hardestGrade,
  buildProjectRollup,
  type PyramidRow,
} from "@/lib/climb-stats";
import {
  buildClimbingChartData,
  DISCIPLINE_LABEL,
  DISCIPLINE_COLOR,
  DISCIPLINE_ORDER,
  type ClimbingChartWeeks,
} from "@/lib/activities/climbing-chart";
import { sportAccent } from "@/lib/sport-accent";
import ActivityCoverageHeatmap from "@/app/progress/details/ActivityCoverageHeatmap";
import { buildWeeklyGrid, type SessionEventInput } from "@/app/progress/details/activity-coverage";
import { startOfWeekMonday } from "@/lib/week";

export const dynamic = "force-dynamic";

const ACCENT = sportAccent("climbing"); // climbing/sport orange
const ACCENT_BG = "rgba(251,146,60,0.08)";
const ACCENT_BORDER = "rgba(251,146,60,0.28)";
const ACCENT_TEXT = "rgba(253,186,116,0.95)";

// Sky-blue is the app's selection cue (matches mobility/lifestyle pills).
const PILL_SELECT_BG = "rgba(120,190,255,0.15)";
const PILL_SELECT_BORDER = "rgba(120,190,255,0.45)";
const PILL_SELECT_TEXT = "rgba(191,219,254,0.98)";

const RECENT_DEFAULT = 10;
const RECENT_MAX = 100;
const ACTIVE_PROJECTS_LIMIT = 3;
const RECENT_LOCATIONS_LIMIT = 5;

type SearchParams = Record<string, string | string[] | undefined>;
type DisciplineFilter = "all" | ClimbingDiscipline;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseChartWeeks(value: string | undefined): ClimbingChartWeeks {
  return value === "4w" ? 4 : 12;
}

function parseDisciplineFilter(value: string | undefined, active: Set<ClimbingDiscipline>): DisciplineFilter {
  if (value === "BOULDER" || value === "SPORT_LEAD" || value === "TOP_ROPE") {
    return active.has(value) ? value : "all";
  }
  return "all";
}

function buildHref(searchParams: SearchParams, overrides: Record<string, string | undefined>): string {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") next[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  const qs = new URLSearchParams(next).toString();
  return `/activities/climbing${qs ? `?${qs}` : ""}`;
}

export default async function ClimbingHubPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const chartWeeks = parseChartWeeks(getParam(searchParams, "chart"));
  const recentExpanded = getParam(searchParams, "recent") === "all";
  const disciplineFilterParam = getParam(searchParams, "discipline");

  const now = new Date();

  // ── Data loading ────────────────────────────────────────────────────────
  // Parallel: all attempts + named-problem rows (for project rollup) +
  // training-log overlay (for the 52-week coverage heatmap).
  const [attempts, problems, trainingLogs] = await Promise.all([
    prisma.climbAttempt.findMany({
      orderBy: { sessionLog: { performedAt: "desc" } },
      select: {
        id: true,
        grade: true,
        gradeSystem: true,
        outcome: true,
        discipline: true,
        sessionLogId: true,
        problemId: true,
        movesCompleted: true,
        totalMoves: true,
        notes: true,
        sessionLog: {
          select: {
            performedAt: true,
            routineId: true,
            climbLocation: { select: { id: true, name: true, type: true } },
            routine: {
              select: {
                name: true,
                sessionDetails: { select: { template: { select: { key: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.climbProblem.findMany({
      select: { id: true, name: true, grade: true, gradeSystem: true, locationId: true },
    }),
    prisma.routineLog.findMany({
      where: {
        routine: {
          isDeleted: false,
          kind: { notIn: ["SESSION", "CARDIO"] },
          metadataGroups: { some: { group: { slug: "climbing" } } },
        },
      },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        performedAt: true,
        routineId: true,
        routine: { select: { name: true } },
      },
      take: 400,
    }),
  ]);

  if (attempts.length === 0) {
    return (
      <div style={pageStyle}>
        <Link href="/activities" style={backLinkStyle}>← Activities</Link>
        <header style={{ display: "grid", gap: 6 }}>
          <div style={eyebrowStyle}>Activity world</div>
          <h1 style={{ ...titleStyle, color: ACCENT }}>Climbing</h1>
          <p style={subtitleStyle}>Bouldering, sport, top rope — your sends and projects.</p>
        </header>
        <SectionCard title="No climbs yet" subtitle="Log a climbing session to start seeing pyramids, projects, and locations here.">
          <EmptyState message="Tap log to record your first session." />
        </SectionCard>
      </div>
    );
  }

  // ── Derive: sessions, location rollups ───────────────────────────────────
  type SessionRollup = {
    id: string;
    performedAt: Date;
    routineId: string;
    routineName: string;
    locationId: string | null;
    locationName: string | null;
    venue: "GYM" | "CRAG" | null;
    disciplineCounts: Record<ClimbingDiscipline, number>;
    attempts: number;
    sends: number;
    hardestSend: string | null;
    hardestSendSystem: ClimbGradeSystem | null;
  };
  const sessionMap = new Map<string, SessionRollup>();
  for (const a of attempts) {
    const sl = a.sessionLog;
    const venue = venueOf(
      sl.routine.sessionDetails?.template?.key,
      sl.climbLocation?.type ?? null
    );
    let s = sessionMap.get(a.sessionLogId);
    if (!s) {
      s = {
        id: a.sessionLogId,
        performedAt: sl.performedAt,
        routineId: sl.routineId,
        routineName: sl.routine.name,
        locationId: sl.climbLocation?.id ?? null,
        locationName: sl.climbLocation?.name ?? null,
        venue,
        disciplineCounts: { BOULDER: 0, SPORT_LEAD: 0, TOP_ROPE: 0 },
        attempts: 0,
        sends: 0,
        hardestSend: null,
        hardestSendSystem: null,
      };
      sessionMap.set(a.sessionLogId, s);
    }
    s.attempts += 1;
    s.disciplineCounts[a.discipline] += 1;
    if (SENT_OUTCOMES.has(a.outcome)) {
      s.sends += 1;
      // Track hardest send within the session for the recent-sessions row label
      if (!s.hardestSend || gradeSort(a.grade, a.gradeSystem) > gradeSort(s.hardestSend, s.hardestSendSystem ?? a.gradeSystem)) {
        s.hardestSend = a.grade;
        s.hardestSendSystem = a.gradeSystem;
      }
    }
  }
  const sessions = [...sessionMap.values()].sort(
    (a, b) => b.performedAt.getTime() - a.performedAt.getTime()
  );

  // ── Pulse rollups (fixed windows) ───────────────────────────────────────
  const thisWeekStart = startOfWeekMonday(now);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);

  const sessionsThisWeek = sessions.filter((s) => s.performedAt >= thisWeekStart).length;
  const sessions4w = sessions.filter((s) => s.performedAt >= fourWeeksAgo).length;
  const sessions12w = sessions.filter((s) => s.performedAt >= twelveWeeksAgo).length;
  const sessionsAllTime = sessions.length;

  // ── Active disciplines (in window for the chart, AND all-time for pyramid filter) ──
  const activeDisciplinesAllTime = new Set<ClimbingDiscipline>();
  for (const s of sessions) {
    for (const d of DISCIPLINE_ORDER) {
      if (s.disciplineCounts[d] > 0) activeDisciplinesAllTime.add(d);
    }
  }
  const disciplineFilter = parseDisciplineFilter(disciplineFilterParam, activeDisciplinesAllTime);

  // ── Chart data ──────────────────────────────────────────────────────────
  const chartData = buildClimbingChartData(
    sessions.map((s) => ({
      id: s.id,
      date: s.performedAt,
      routineId: s.routineId,
      routineName: s.routineName,
      locationName: s.locationName,
      disciplineCounts: s.disciplineCounts,
    })),
    { weeks: chartWeeks, now }
  );
  const chartHasData = chartData.series.some((sr) => sr.weeklyValues.some((v) => v > 0));

  // ── Pyramid (filtered by discipline pill) ───────────────────────────────
  const pyramidAttempts = disciplineFilter === "all"
    ? attempts
    : attempts.filter((a) => a.discipline === disciplineFilter);
  const pyramidRows = buildPyramidRows(pyramidAttempts);
  const hasBoulder = pyramidRows.boulderRows.length > 0;
  const hasYosemite = pyramidRows.yosemiteRows.length > 0;

  // ── Indoor / Outdoor split ──────────────────────────────────────────────
  const gymSessions = sessions.filter((s) => s.venue === "GYM");
  const cragSessions = sessions.filter((s) => s.venue === "CRAG");
  const unknownVenueSessions = sessions.filter((s) => s.venue === null);

  // ── Active projects (top 3) ─────────────────────────────────────────────
  const projectAttemptsInput = attempts
    .filter((a) => a.problemId)
    .map((a) => ({
      id: a.id,
      problemId: a.problemId,
      outcome: a.outcome,
      grade: a.grade,
      gradeSystem: a.gradeSystem,
      movesCompleted: a.movesCompleted ?? null,
      totalMoves: a.totalMoves ?? null,
      notes: a.notes ?? null,
      performedAt: a.sessionLog.performedAt,
    }));
  const projectsAll = buildProjectRollup(projectAttemptsInput, { now });
  // Only include "active" — touched in the last 60 days. Dormant projects
  // belong on /projects.
  const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
  const activeCutoff = new Date(now.getTime() - SIXTY_DAYS_MS);
  const activeProjects = projectsAll.filter((p) => p.lastAttempt >= activeCutoff);
  const topProjects = activeProjects.slice(0, ACTIVE_PROJECTS_LIMIT);
  const problemNameById = new Map(problems.map((p) => [p.id, p.name]));
  const problemLocationById = new Map(problems.map((p) => [p.id, p.locationId]));

  // ── Recent locations (top 5 by most-recent activity) ────────────────────
  type LocationRollup = {
    id: string;
    name: string;
    type: "GYM" | "CRAG";
    sessions: number;
    lastVisit: Date;
    sends: number;
    hardestSend: string | null;
    hardestSendSystem: ClimbGradeSystem | null;
  };
  const locationMap = new Map<string, LocationRollup>();
  for (const s of sessions) {
    if (!s.locationId || !s.locationName || !s.venue) continue;
    let row = locationMap.get(s.locationId);
    if (!row) {
      row = {
        id: s.locationId,
        name: s.locationName,
        type: s.venue,
        sessions: 0,
        lastVisit: s.performedAt,
        sends: 0,
        hardestSend: null,
        hardestSendSystem: null,
      };
      locationMap.set(s.locationId, row);
    }
    row.sessions += 1;
    if (s.performedAt > row.lastVisit) row.lastVisit = s.performedAt;
    row.sends += s.sends;
    if (s.hardestSend && (!row.hardestSend || gradeSort(s.hardestSend, s.hardestSendSystem ?? "BOULDER_V") > gradeSort(row.hardestSend, row.hardestSendSystem ?? "BOULDER_V"))) {
      row.hardestSend = s.hardestSend;
      row.hardestSendSystem = s.hardestSendSystem;
    }
  }
  const recentLocations = [...locationMap.values()]
    .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime())
    .slice(0, RECENT_LOCATIONS_LIMIT);

  // ── Recent sessions ─────────────────────────────────────────────────────
  const recentCount = recentExpanded ? RECENT_MAX : RECENT_DEFAULT;
  const recentSessions = sessions.slice(0, recentCount);
  const recentHasMore = !recentExpanded && sessions.length > RECENT_DEFAULT;

  // ── Coverage heatmap (52 weeks) ─────────────────────────────────────────
  const sessionEvents: SessionEventInput[] = sessions.map((s) => ({
    id: s.id,
    routineId: s.routineId,
    performedAt: s.performedAt,
    routineName: s.routineName,
    venueLabel: s.venue === "GYM" ? "Indoor" : s.venue === "CRAG" ? "Outdoor" : null,
  }));
  const heatmapWeeks = buildWeeklyGrid(
    sessionEvents,
    trainingLogs.map((l) => ({
      id: l.id,
      routineId: l.routineId,
      performedAt: l.performedAt,
      routineName: l.routine.name,
    })),
    now
  );

  // ── Hub-tile counts ─────────────────────────────────────────────────────
  const tileTotals = {
    climbs: attempts.length,
    projects: activeProjects.length,
    locations: locationMap.size,
  };

  return (
    <div style={pageStyle}>
      <Link href="/activities" style={backLinkStyle}>← Activities</Link>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={eyebrowStyle}>Activity world</div>
        <h1 style={{ ...titleStyle, color: ACCENT }}>Climbing</h1>
        <p style={subtitleStyle}>Bouldering, sport, top rope — your sends, projects, and locations.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <NewRoutineDrawerButton presetDomain="sport" style={primaryCtaStyle}>
            + New climbing session
          </NewRoutineDrawerButton>
        </div>
      </header>

      {/* ── Pulse strip ───────────────────────────────────────────── */}
      <div style={pulseRowStyle}>
        <PulseStat label="This week" value={sessionsThisWeek} sublabel="sessions" />
        <PulseStat label="Last 4 weeks" value={sessions4w} sublabel="sessions" />
        <PulseStat label="Last 12 weeks" value={sessions12w} sublabel="sessions" />
        <PulseStat label="All time" value={sessionsAllTime} sublabel="sessions" />
      </div>

      {/* ── Hub navigation tiles ──────────────────────────────────── */}
      <div style={hubTileRowStyle}>
        <HubTile href="/activities/climbing/climbs" label="Climbs" stat={`${tileTotals.climbs} logged`} icon="📋" />
        <HubTile href="/activities/climbing/projects" label="Projects" stat={`${tileTotals.projects} active`} icon="🎯" />
        <HubTile href="/activities/climbing/map" label="Map" stat={`${tileTotals.locations} location${tileTotals.locations === 1 ? "" : "s"}`} icon="🗺" />
        <HubTile href="/activities/climbing/map" label="Locations" stat="Browse all" icon="📍" />
      </div>

      {/* ── Per-chart range pill ─────────────────────────────────── */}
      <div style={chartPillRowStyle}>
        <span style={chartPillLabelStyle}>Chart range</span>
        {(["4w", "12w"] as const).map((w) => (
          <Link
            key={w}
            href={buildHref(searchParams, { chart: w === "12w" ? undefined : w })}
            style={chartWeeks === (w === "4w" ? 4 : 12) ? pillSelectStyle : pillStyle}
          >
            {w}
          </Link>
        ))}
      </div>

      {chartHasData ? (
        <WeeklyBarChartWithSessions
          title={`Sessions per Week — Last ${chartWeeks} Weeks`}
          weekLabels={chartData.weekLabels}
          series={chartData.series}
          sessionsByWeek={chartData.sessionsByWeek}
          unit=""
          decimals={0}
          compact={false}
        />
      ) : null}

      {/* ── Pyramid ───────────────────────────────────────────────── */}
      <SectionCard
        title="Grade Pyramid"
        subtitle={
          disciplineFilter === "all"
            ? "All sends and falls by grade · all time."
            : `${DISCIPLINE_LABEL[disciplineFilter]} only · all time.`
        }
      >
        {/* Discipline filter pill row — only shows pills for disciplines
            with data so a boulder-only climber doesn't see TR/sport clutter. */}
        {activeDisciplinesAllTime.size > 1 ? (
          <div style={disciplinePillRowStyle}>
            <Link
              href={buildHref(searchParams, { discipline: undefined })}
              style={disciplineFilter === "all" ? pillSelectStyle : pillStyle}
            >
              All
            </Link>
            {DISCIPLINE_ORDER.filter((d) => activeDisciplinesAllTime.has(d)).map((d) => (
              <Link
                key={d}
                href={buildHref(searchParams, { discipline: disciplineFilter === d ? undefined : d })}
                style={disciplineFilter === d ? pillSelectStyle : pillStyle}
              >
                {DISCIPLINE_LABEL[d]}
              </Link>
            ))}
          </div>
        ) : null}

        {!hasBoulder && !hasYosemite ? (
          <EmptyState message="No climbs in this discipline yet." />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {hasBoulder ? <PyramidBlock title="Bouldering" rows={pyramidRows.boulderRows} /> : null}
            {hasYosemite ? <PyramidBlock title="Sport / Top rope" rows={pyramidRows.yosemiteRows} /> : null}
          </div>
        )}
      </SectionCard>

      {/* ── Indoor / Outdoor split ────────────────────────────────── */}
      {(gymSessions.length > 0 || cragSessions.length > 0) ? (
        <SectionCard title="Indoor vs Outdoor" subtitle="Where you're climbing · all time.">
          <div style={venueSplitRowStyle}>
            <VenueCard label="🏠 Indoor" count={gymSessions.length} accent={ACCENT} total={sessions.length} />
            <VenueCard label="🪨 Outdoor" count={cragSessions.length} accent="rgba(132,204,22,0.9)" total={sessions.length} />
            {unknownVenueSessions.length > 0 ? (
              <VenueCard label="? Unknown" count={unknownVenueSessions.length} accent="rgba(148,163,184,0.7)" total={sessions.length} />
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {/* ── Active projects ───────────────────────────────────────── */}
      <SectionCard
        title="Active Projects"
        subtitle={
          activeProjects.length === 0
            ? undefined
            : `Top ${Math.min(ACTIVE_PROJECTS_LIMIT, activeProjects.length)} of ${activeProjects.length} touched in the last 60 days.`
        }
      >
        {/* TODO(session 2): surface movesCompleted/totalMoves as a small
            progress bar per project (e.g., "8/10 moves · last attempt 3d
            ago"). ProjectRollupRow.bestMoves already carries the data. */}
        {topProjects.length === 0 ? (
          <EmptyState message="No active projects. Tag an attempt PROJECT or FELL on a named problem to start tracking." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {topProjects.map((p) => {
              const name = problemNameById.get(p.problemId) ?? "Unnamed";
              const locationId = problemLocationById.get(p.problemId) ?? null;
              const href = locationId
                ? `/activities/climbing/locations/${locationId}`
                : "/activities/climbing/projects";
              return (
                <Link key={p.problemId} href={href} style={projectRowStyle}>
                  <div style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ color: ACCENT_TEXT, marginRight: 6 }}>{p.grade}</span>
                      {name}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
                      {p.attemptCount} attempt{p.attemptCount === 1 ? "" : "s"} · last {relativeFromNow(p.lastAttempt)}
                      {p.bestMoves ? ` · ${p.bestMoves.completed}/${p.bestMoves.total} moves` : ""}
                    </span>
                  </div>
                </Link>
              );
            })}
            {activeProjects.length > ACTIVE_PROJECTS_LIMIT ? (
              <Link href="/activities/climbing/projects" style={viewAllLinkStyle}>
                View all {activeProjects.length} active projects →
              </Link>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* ── Recent locations ──────────────────────────────────────── */}
      {recentLocations.length > 0 ? (
        <SectionCard title="Recent Locations" subtitle={`Last ${recentLocations.length} of ${locationMap.size} visited.`}>
          <div style={{ display: "grid", gap: 8 }}>
            {recentLocations.map((loc) => (
              <Link key={loc.id} href={`/activities/climbing/locations/${loc.id}`} style={locationRowStyle}>
                <div style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {loc.type === "GYM" ? "🏠 " : "🪨 "}{loc.name}
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 700 }}>
                    {loc.sessions} session{loc.sessions === 1 ? "" : "s"} · {loc.sends} send{loc.sends === 1 ? "" : "s"}
                    {loc.hardestSend ? ` · hardest ${loc.hardestSend}` : ""} · {relativeFromNow(loc.lastVisit)}
                  </span>
                </div>
              </Link>
            ))}
            {locationMap.size > RECENT_LOCATIONS_LIMIT ? (
              <Link href="/activities/climbing/map" style={viewAllLinkStyle}>
                View all on the map →
              </Link>
            ) : null}
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
              ? `Showing ${recentSessions.length} of ${sessions.length}.`
              : `Last ${recentSessions.length} of ${sessions.length}.`
        }
      >
        {recentSessions.length === 0 ? (
          <EmptyState message="No sessions logged yet." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recentSessions.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
            {recentHasMore ? (
              <Link href={buildHref(searchParams, { recent: "all" })} style={viewAllLinkStyle}>
                View all {sessions.length} sessions →
              </Link>
            ) : null}
            {recentExpanded && sessions.length > RECENT_DEFAULT ? (
              <Link href={buildHref(searchParams, { recent: undefined })} style={viewAllLinkStyle}>
                Show fewer ↑
              </Link>
            ) : null}
            {recentExpanded && sessions.length > RECENT_MAX ? (
              <div style={{ fontSize: 11, opacity: 0.55, textAlign: "center", paddingTop: 4 }}>
                Showing the {RECENT_MAX} most recent. Older sessions are still in the all-time count.
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* ── Activity coverage heatmap ─────────────────────────────── */}
      {heatmapWeeks.length > 1 ? (
        <SectionCard title="Activity Coverage" subtitle="Climbing sessions + supporting training · last 52 weeks. Tap any week to expand.">
          <ActivityCoverageHeatmap
            weeks={heatmapWeeks}
            sessionLabel="Climb session"
            trainingLabel="Training"
          />
        </SectionCard>
      ) : null}

      {/* ── Quick links ───────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/plan?tab=goals" style={quickLinkStyle}>Climbing goals →</Link>
        <Link href="/body" style={quickLinkStyle}>Body status →</Link>
        <Link href="/activities" style={quickLinkStyle}>Back to Activities</Link>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PulseStat({ label, value, sublabel }: { label: string; value: number; sublabel: string }) {
  return (
    <div style={pulseStatStyle}>
      <div style={pulseLabelStyle}>{label}</div>
      <div style={{ ...pulseValueStyle, color: ACCENT_TEXT }}>{value}</div>
      <div style={pulseSubStyle}>{sublabel}</div>
    </div>
  );
}

function HubTile({ href, label, stat, icon }: { href: string; label: string; stat: string; icon: string }) {
  return (
    <Link href={href} style={hubTileStyle}>
      <span style={hubTileIconStyle} aria-hidden>{icon}</span>
      <span style={hubTileLabelStyle}>{label}</span>
      <span style={hubTileStatStyle}>{stat}</span>
    </Link>
  );
}

function PyramidBlock({ title, rows }: { title: string; rows: PyramidRow[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.total));
  // Render top-down: hardest grades first so the pyramid reads from peak down.
  const reversed = [...rows].reverse();
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={pyramidSubtitleStyle}>{title}</div>
      <div style={{ display: "grid", gap: 4 }}>
        {reversed.map((r) => (
          <div key={`${r.system}::${r.grade}`} style={pyramidRowStyle}>
            <span style={pyramidGradeStyle}>{r.grade}</span>
            <div style={pyramidBarTrackStyle}>
              {PYRAMID_OUTCOMES.map((outcome) => {
                const count = r.counts[outcome as ClimbOutcome] ?? 0;
                if (count === 0) return null;
                const width = (count / max) * 100;
                return (
                  <span
                    key={outcome}
                    title={`${climbOutcomeLabel(outcome as ClimbOutcome, r.system)} × ${count}`}
                    style={{
                      width: `${width}%`,
                      background: climbOutcomeBg(outcome as ClimbOutcome),
                      borderRight: `1px solid ${climbOutcomeColor(outcome as ClimbOutcome)}`,
                      color: climbOutcomeColor(outcome as ClimbOutcome),
                      fontSize: 10,
                      fontWeight: 900,
                      padding: "2px 4px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {count}
                  </span>
                );
              })}
            </div>
            <span style={pyramidTotalStyle}>{r.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueCard({ label, count, accent, total }: { label: string; count: number; accent: string; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={venueCardStyle}>
      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: accent, marginTop: 4 }}>{count}</div>
      <div style={{ fontSize: 10, opacity: 0.55, fontWeight: 700, marginTop: 2 }}>{pct}% of sessions</div>
    </div>
  );
}

function SessionRow({ session }: { session: {
  id: string;
  routineId: string;
  performedAt: Date;
  locationName: string | null;
  venue: "GYM" | "CRAG" | null;
  attempts: number;
  sends: number;
  hardestSend: string | null;
} }) {
  const venueGlyph = session.venue === "GYM" ? "🏠" : session.venue === "CRAG" ? "🪨" : "•";
  const dateLabel = formatAppDate(session.performedAt, { weekday: "short", month: "short", day: "numeric" });
  return (
    <Link href={`/routines/${session.routineId}/logs/${session.id}/details`} style={sessionRowStyle}>
      <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {venueGlyph} {session.locationName ?? "Unknown location"}
        </span>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>
          {dateLabel} · {session.attempts} attempt{session.attempts === 1 ? "" : "s"}
          {session.sends > 0 ? ` · ${session.sends} send${session.sends === 1 ? "" : "s"}` : ""}
          {session.hardestSend ? ` · top ${session.hardestSend}` : ""}
        </span>
      </div>
    </Link>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "18px 14px 60px",
  display: "grid",
  gap: 18,
};

const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: -0.4,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  opacity: 0.72,
  lineHeight: 1.5,
};

const pulseRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
  gap: 8,
};

const pulseStatStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "12px 10px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
  textAlign: "center",
};

const pulseLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.62,
};

const pulseValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
};

const pulseSubStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  fontWeight: 700,
};

// Hub navigation tiles — compact so 4 fit in one row on tablet+ and
// collapse to 2x2 on phone-class screens. The 130px minmax leaves room
// for an icon, label, and short stat without crowding.
const hubTileRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 8,
};

const hubTileStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 3,
  padding: "12px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
  textAlign: "center",
};

const hubTileIconStyle: React.CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
};

const hubTileLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.2,
  marginTop: 3,
};

const hubTileStatStyle: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.6,
  fontWeight: 700,
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
  background: PILL_SELECT_BG,
  borderColor: PILL_SELECT_BORDER,
  color: PILL_SELECT_TEXT,
};

const disciplinePillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 12,
};

const pyramidSubtitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.6,
  textTransform: "uppercase",
};

const pyramidRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr 28px",
  gap: 8,
  alignItems: "center",
};

const pyramidGradeStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  textAlign: "right",
  opacity: 0.85,
};

const pyramidBarTrackStyle: React.CSSProperties = {
  display: "flex",
  height: 18,
  borderRadius: 6,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const pyramidTotalStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.55,
  textAlign: "left",
};

const venueSplitRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
  gap: 8,
};

const venueCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "12px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
  textAlign: "center",
};

const projectRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const locationRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.025)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};

const sessionRowStyle: React.CSSProperties = {
  display: "flex",
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

const primaryCtaStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: 10,
  border: `1px solid ${ACCENT_BORDER}`,
  background: ACCENT_BG,
  color: ACCENT_TEXT,
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  minHeight: 44,
};
