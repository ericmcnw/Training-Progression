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
// Shipped in session 2: send rate folded into the pyramid subtitle (gated
// ≥10 attempts so two climbs don't show a meaningless 100%), and moves-
// completed bars on Active Projects rows (render only when the project
// actually has moves data — no noise for climbers who skip those fields).
//
// Still-open expansion notes:
//   - Send-rate TREND chart (sends per attempts, weekly).
//   - Time-on-wall stat from RoutineLog.durationSec.
//   - Tries-to-send average from ClimbAttempt.triesCount.
//   - Area aggregation rollup (most-climbed areas per location).

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAppDate, relativeFromNow } from "@/lib/dates";
import { SectionCard, EmptyState } from "@/app/progress/ui";
import LogSessionCTA from "@/app/activities/_shared/LogSessionCTA";
import WeeklyBarChartWithSessions from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import WeeklyEffortChart from "@/app/activities/_shared/WeeklyEffortChart";
import {
  climbOutcomeColor,
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
  buildProjectRollup,
  type PyramidRow,
} from "@/lib/climb-stats";
import {
  buildClimbingChartData,
  buildClimbingTrainingChartData,
  DISCIPLINE_LABEL,
  DISCIPLINE_ORDER,
  type ClimbingChartWeeks,
} from "@/lib/activities/climbing-chart";
import { effectiveRoutineDomain } from "@/lib/routines";
import { sportAccent } from "@/lib/sport-accent";
import ActivityHeader from "@/app/activities/_shared/ActivityHeader";
import ActivityGoalsSection from "@/app/progress/details/ActivityGoalsSection";
import { getActivityGoals, frequencyChipFor } from "@/lib/activity-goals";
import TrainingTagsPanel from "./TrainingTagsPanel";
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
  // supporting-training logs (violet series on the weekly chart).
  const [attempts, problems, trainingLogs, climbingGoals] = await Promise.all([
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
            effort: true,
            durationSec: true,
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
    // Supporting-training logs — HYBRID matching:
    //   1) routine-level tag (legacy metadataGroups OR supportsSports), or
    //   2) the session contains at least one climbing-tagged exercise
    //      (Exercise.supportsSports) — so a generic Upper day counts on
    //      the sessions where pull-ups / lock-offs actually appeared.
    // SESSION kind excluded (those are the climbing sessions themselves);
    // CARDIO included so a tagged trail run shows as a blue segment.
    prisma.routineLog.findMany({
      where: {
        routine: { isDeleted: false, kind: { not: "SESSION" } },
        OR: [
          { routine: { metadataGroups: { some: { group: { slug: "climbing" } } } } },
          { routine: { supportsSports: { has: "climbing" } } },
          { exercises: { some: { exercise: { supportsSports: { has: "climbing" } } } } },
        ],
      },
      orderBy: { performedAt: "desc" },
      select: {
        id: true,
        performedAt: true,
        routineId: true,
        effort: true,
        durationSec: true,
        routine: {
          select: {
            name: true,
            domain: true,
            kind: true,
            subtype: true,
            supportsSports: true,
            metadataGroups: { select: { group: { select: { slug: true } } } },
          },
        },
        exercises: {
          select: { exercise: { select: { name: true, supportsSports: true } } },
        },
      },
      take: 400,
    }),
    // Goals pointed at climbing — grade PRs, session-frequency goals, and
    // "training FOR climbing" tag goals. Powers the header chip + section.
    getActivityGoals("climbing"),
  ]);

  if (attempts.length === 0) {
    return (
      <div style={pageStyle}>
        <ActivityHeader title="Climbing" accent={ACCENT} />
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
    effort: number | null;
    durationSec: number | null;
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
        effort: sl.effort ?? null,
        durationSec: sl.durationSec ?? null,
      };
      sessionMap.set(a.sessionLogId, s);
    }
    s.attempts += 1;
    s.disciplineCounts[a.discipline] += 1;
    if (SENT_OUTCOMES.has(a.outcome)) {
      s.sends += 1;
      // Track hardest send within the session for the recent-sessions row
      // label. gradeSort indices are only comparable within one grade
      // system — for mixed-discipline sessions, keep the first system
      // encountered and only compare same-system sends against it.
      if (!s.hardestSend) {
        s.hardestSend = a.grade;
        s.hardestSendSystem = a.gradeSystem;
      } else if (
        s.hardestSendSystem === a.gradeSystem &&
        gradeSort(a.grade, a.gradeSystem) > gradeSort(s.hardestSend, a.gradeSystem)
      ) {
        s.hardestSend = a.grade;
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

  // ── Chart 1 — climbing sessions, hue = discipline, shade = venue ────────
  const chartData = buildClimbingChartData(
    sessions.map((s) => ({
      id: s.id,
      date: s.performedAt,
      routineId: s.routineId,
      routineName: s.routineName,
      locationName: s.locationName,
      disciplineCounts: s.disciplineCounts,
      venue: s.venue,
      effort: s.effort,
      durationSec: s.durationSec,
    })),
    { weeks: chartWeeks, now }
  );
  const chartHasData = chartData.series.some((sr) => sr.weeklyValues.some((v) => v > 0));

  // ── Chart 2 — supporting training, stacked by domain ────────────────────
  const trainingChartData = buildClimbingTrainingChartData(
    trainingLogs.map((l) => {
      const routineTagged =
        l.routine.supportsSports.includes("climbing") ||
        l.routine.metadataGroups.some((g) => g.group.slug === "climbing");
      // Surface matched exercises only when the EXERCISE is what made the
      // session qualify — tagged routines count wholesale, no need to
      // explain why.
      const matchedExercises = routineTagged
        ? []
        : l.exercises
            .filter((e) => e.exercise.supportsSports.includes("climbing"))
            .map((e) => e.exercise.name);
      return {
        id: l.id,
        date: l.performedAt,
        routineId: l.routineId,
        routineName: l.routine.name,
        domain: effectiveRoutineDomain(l.routine.domain, l.routine.kind, l.routine.subtype),
        matchedExercises,
        effort: l.effort,
        durationSec: l.durationSec,
      };
    }),
    { weeks: chartWeeks, now }
  );
  const trainingChartHasData = trainingChartData.series.some((sr) => sr.weeklyValues.some((v) => v > 0));

  // Tagged routines + exercises for the "what counts" management panel.
  const [taggedRoutines, taggedExercises, allExerciseNames] = await Promise.all([
    prisma.routine.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        kind: { not: "SESSION" },
        OR: [
          { metadataGroups: { some: { group: { slug: "climbing" } } } },
          { supportsSports: { has: "climbing" } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.exercise.findMany({
      where: { supportsSports: { has: "climbing" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.exercise.findMany({
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // ── Pyramid (filtered by discipline pill, split indoor/outdoor) ─────────
  const pyramidAttempts = disciplineFilter === "all"
    ? attempts
    : attempts.filter((a) => a.discipline === disciplineFilter);
  const pyramidRows = buildPyramidRows(pyramidAttempts);
  const hasBoulder = pyramidRows.boulderRows.length > 0;
  const hasYosemite = pyramidRows.yosemiteRows.length > 0;

  // Indoor/outdoor pyramid split — venue resolves per session, so map the
  // session's venue onto each attempt. The venue stat (session count + %)
  // lives in each pyramid column's header, replacing the separate
  // Indoor-vs-Outdoor card.
  const venueBySessionId = new Map(sessions.map((s) => [s.id, s.venue]));
  const gymPyramidRows = buildPyramidRows(
    pyramidAttempts.filter((a) => venueBySessionId.get(a.sessionLogId) === "GYM")
  );
  const cragPyramidRows = buildPyramidRows(
    pyramidAttempts.filter((a) => venueBySessionId.get(a.sessionLogId) === "CRAG")
  );

  // Send rate — quiet stat folded into the pyramid subtitle. Gated behind
  // a minimum attempt count so it doesn't show a meaningless "100%" after
  // two climbs. Respects the discipline filter so "Boulder only" shows the
  // boulder send rate.
  const SEND_RATE_MIN_ATTEMPTS = 10;
  const pyramidSendCount = pyramidAttempts.filter((a) => SENT_OUTCOMES.has(a.outcome)).length;
  const sendRatePct = pyramidAttempts.length >= SEND_RATE_MIN_ATTEMPTS
    ? Math.round((pyramidSendCount / pyramidAttempts.length) * 100)
    : null;

  // ── Indoor / Outdoor split — feeds the pyramid column headers ───────────
  const gymSessions = sessions.filter((s) => s.venue === "GYM");
  const cragSessions = sessions.filter((s) => s.venue === "CRAG");

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
    // Same-system comparison only — gradeSort indices aren't comparable
    // across V-scale and YDS.
    if (s.hardestSend) {
      if (!row.hardestSend) {
        row.hardestSend = s.hardestSend;
        row.hardestSendSystem = s.hardestSendSystem;
      } else if (
        s.hardestSendSystem === row.hardestSendSystem &&
        gradeSort(s.hardestSend, s.hardestSendSystem!) > gradeSort(row.hardestSend, row.hardestSendSystem!)
      ) {
        row.hardestSend = s.hardestSend;
      }
    }
  }
  const recentLocations = [...locationMap.values()]
    .sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime())
    .slice(0, RECENT_LOCATIONS_LIMIT);

  // ── Recent sessions ─────────────────────────────────────────────────────
  const recentCount = recentExpanded ? RECENT_MAX : RECENT_DEFAULT;
  const recentSessions = sessions.slice(0, recentCount);
  const recentHasMore = !recentExpanded && sessions.length > RECENT_DEFAULT;

  // ── Hub-tile counts ─────────────────────────────────────────────────────
  const tileTotals = {
    climbs: attempts.length,
    projects: activeProjects.length,
    locations: locationMap.size,
  };

  return (
    <div style={pageStyle}>
      <ActivityHeader
        title="Climbing"
        accent={ACCENT}
        frequencyChip={frequencyChipFor(climbingGoals)}
        actions={
          // Opens the climb log sheet directly — this previously opened the
          // NEW-ROUTINE builder, which is the wrong action for "Log session".
          <LogSessionCTA
            slug="climbing"
            label="Climbing"
            buttonLabel="+ Log session"
            style={primaryCtaStyle}
          />
        }
      />

      {/* ── Pulse strip — single compact row, not four padded cards.
          Sessions counts read left-to-right from most recent window to
          all-time. ~40px tall vs the ~76px card row it replaces. */}
      <div style={pulseStripStyle}>
        <PulseStat label="This wk" value={sessionsThisWeek} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="4 wks" value={sessions4w} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="12 wks" value={sessions12w} />
        <span style={pulseDividerStyle} aria-hidden />
        <PulseStat label="All time" value={sessionsAllTime} />
      </div>

      {/* ── Hub navigation tiles ──────────────────────────────────── */}
      <div style={hubTileRowStyle}>
        <HubTile href="/activities/climbing/climbs" label="Climbs" stat={`${tileTotals.climbs} logged`} icon="📋" />
        <HubTile href="/activities/climbing/climbs?outcome=project" label="Projects" stat={`${tileTotals.projects} active`} icon="🎯" />
        <HubTile href="/activities/climbing/map" label="Map" stat={`${tileTotals.locations} location${tileTotals.locations === 1 ? "" : "s"}`} icon="🗺" />
      </div>

      <ActivityGoalsSection
        goals={climbingGoals}
        activitySlug="climbing"
        activityLabel="Climbing"
        showWhenEmpty={false}
      />

      {/* ── Chart range — applies to both weekly charts below ──────── */}
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

      {/* Chart 1 — climbing sessions. Hue = discipline (boulder orange,
          sport lead red, top rope sky), shade = venue (indoor light,
          outdoor deep). Only combos with data render. */}
      {chartHasData ? (
        <WeeklyEffortChart
          title={`Climbing Sessions per Week — Last ${chartWeeks} Weeks`}
          weekLabels={chartData.weekLabels}
          series={chartData.series}
          sessionsByWeek={chartData.sessionsByWeek}
          defaultLens="bars"
        />
      ) : null}

      {/* Chart 2 — supporting training (Fingers, Pull Day, tagged cardio,
          …) stacked by domain so the support mix reads at a glance. */}
      {trainingChartHasData ? (
        <WeeklyBarChartWithSessions
          title={`Climbing Training per Week — Last ${chartWeeks} Weeks`}
          weekLabels={trainingChartData.weekLabels}
          series={trainingChartData.series}
          sessionsByWeek={trainingChartData.sessionsByWeek}
          unit=""
          decimals={0}
          compact={false}
        />
      ) : null}

      {/* Tag management — visible + editable right under the chart it
          drives. Routine tags link out to the routine edit page; exercise
          tags add/remove inline. */}
      <TrainingTagsPanel
        taggedRoutines={taggedRoutines}
        taggedExercises={taggedExercises}
        allExerciseNames={allExerciseNames.map((e) => e.name)}
      />

      {/* ── Pyramid ───────────────────────────────────────────────── */}
      <SectionCard
        title="Grade Pyramid"
        subtitle={
          (disciplineFilter === "all"
            ? "All sends and falls by grade · all time."
            : `${DISCIPLINE_LABEL[disciplineFilter]} only · all time.`) +
          (sendRatePct !== null ? ` ${sendRatePct}% send rate.` : "")
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
          <div style={{ display: "grid", gap: 12 }}>
            <OutcomeLegend showOnsight={hasYosemite && !hasBoulder} />
            {/* Indoor / outdoor columns — venue stats live in the column
                headers so the old separate Indoor-vs-Outdoor card is
                folded in here. Falls back to a single combined pyramid
                when no session has a venue. */}
            {gymPyramidRows.allRows.length > 0 || cragPyramidRows.allRows.length > 0 ? (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {gymPyramidRows.allRows.length > 0 ? (
                  <PyramidSection
                    title="🏠 Indoor"
                    stat={`${gymSessions.length} session${gymSessions.length !== 1 ? "s" : ""} · ${sessions.length > 0 ? Math.round((gymSessions.length / sessions.length) * 100) : 0}%`}
                    rows={gymPyramidRows}
                  />
                ) : null}
                {cragPyramidRows.allRows.length > 0 ? (
                  <PyramidSection
                    title="🪨 Outdoor"
                    stat={`${cragSessions.length} session${cragSessions.length !== 1 ? "s" : ""} · ${sessions.length > 0 ? Math.round((cragSessions.length / sessions.length) * 100) : 0}%`}
                    rows={cragPyramidRows}
                  />
                ) : null}
              </div>
            ) : (
              <PyramidSection title="All sessions" stat={`${sessions.length} session${sessions.length !== 1 ? "s" : ""}`} rows={pyramidRows} />
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Active projects ───────────────────────────────────────── */}
      <SectionCard
        title="Active Projects"
        subtitle={
          activeProjects.length === 0
            ? undefined
            : `Top ${Math.min(ACTIVE_PROJECTS_LIMIT, activeProjects.length)} of ${activeProjects.length} touched in the last 60 days.`
        }
      >
        {topProjects.length === 0 ? (
          <EmptyState message="No active projects. Tag an attempt PROJECT or FELL on a named problem to start tracking." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {topProjects.map((p) => {
              const name = problemNameById.get(p.problemId) ?? "Unnamed";
              const locationId = problemLocationById.get(p.problemId) ?? null;
              const href = locationId
                ? `/activities/climbing/locations/${locationId}`
                : "/activities/climbing/climbs?outcome=project";
              // Moves progress bar only renders when the user actually
              // tracked moves on this project — no bar, no noise for
              // climbers who don't use the moves fields.
              const movesPct = p.bestMoves && p.bestMoves.total > 0
                ? Math.min(100, Math.round((p.bestMoves.completed / p.bestMoves.total) * 100))
                : null;
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
                    {movesPct !== null ? (
                      <div style={movesTrackStyle} aria-hidden>
                        <div style={{ ...movesFillStyle, width: `${movesPct}%` }} />
                      </div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
            {activeProjects.length > ACTIVE_PROJECTS_LIMIT ? (
              <Link href="/activities/climbing/climbs?outcome=project" style={viewAllLinkStyle}>
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

      {/* ── Quick links ───────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/plan#goals" style={quickLinkStyle}>Climbing goals →</Link>
        <Link href="/body" style={quickLinkStyle}>Body status →</Link>
        <Link href="/activities" style={quickLinkStyle}>Back to Activities</Link>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function PulseStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={pulseStatStyle}>
      <div style={{ ...pulseValueStyle, color: ACCENT_TEXT }}>{value}</div>
      <div style={pulseLabelStyle}>{label}</div>
    </div>
  );
}

function HubTile({ href, label, stat, icon }: { href: string; label: string; stat: string; icon: string }) {
  return (
    <Link href={href} style={hubTileStyle}>
      <span aria-hidden>{icon}</span>
      <span style={hubTileLabelStyle}>{label}</span>
      <span style={hubTileStatStyle}>{stat}</span>
    </Link>
  );
}

// One pyramid column (Indoor or Outdoor). The venue stat (session count +
// share %) sits in the header so the split card it replaced isn't missed.
// Bars use SOLID outcome colors — the canonical pyramid look from the old
// climbing world page; segments scale within the column's own max so each
// column fills its width.
function PyramidSection({ title, stat, rows }: { title: string; stat: string; rows: { boulderRows: PyramidRow[]; yosemiteRows: PyramidRow[] } }) {
  const showBoth = rows.boulderRows.length > 0 && rows.yosemiteRows.length > 0;
  const maxTotal = Math.max(
    1,
    ...rows.boulderRows.map((r) => r.total),
    ...rows.yosemiteRows.map((r) => r.total)
  );
  return (
    <div style={{ flex: "1 1 260px", minWidth: 0, display: "grid", gap: 8, alignContent: "start" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={pyramidSubtitleStyle}>{title}</span>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>{stat}</span>
      </div>
      {rows.boulderRows.length > 0 ? (
        <div style={{ display: "grid", gap: 4 }}>
          {showBoth ? <div style={pyramidSystemLabelStyle}>Boulder</div> : null}
          {[...rows.boulderRows].reverse().map((r) => (
            <PyramidBar key={`${r.system}::${r.grade}`} row={r} maxTotal={maxTotal} />
          ))}
        </div>
      ) : null}
      {rows.yosemiteRows.length > 0 ? (
        <div style={{ display: "grid", gap: 4 }}>
          {showBoth ? <div style={pyramidSystemLabelStyle}>Sport / Top rope</div> : null}
          {[...rows.yosemiteRows].reverse().map((r) => (
            <PyramidBar key={`${r.system}::${r.grade}`} row={r} maxTotal={maxTotal} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PyramidBar({ row, maxTotal }: { row: PyramidRow; maxTotal: number }) {
  const BAR_MAX_PCT = 100;
  const barPct = (row.total / maxTotal) * BAR_MAX_PCT;
  const segments = PYRAMID_OUTCOMES
    .map((o) => ({ outcome: o as ClimbOutcome, count: row.counts[o as ClimbOutcome] ?? 0 }))
    .filter((s) => s.count > 0);
  return (
    <div style={pyramidRowStyle}>
      <span style={pyramidGradeStyle}>{row.grade}</span>
      <div style={pyramidBarTrackStyle}>
        {segments.map(({ outcome, count }) => (
          <span
            key={outcome}
            title={`${climbOutcomeLabel(outcome, row.system)} × ${count}`}
            style={{
              width: `${(count / row.total) * barPct}%`,
              background: climbOutcomeColor(outcome),
              minWidth: 4,
              flexShrink: 0,
            }}
          />
        ))}
      </div>
      <span style={pyramidTotalStyle}>{row.total}</span>
    </div>
  );
}

// Shared outcome legend — solid swatches matching the bar segments.
function OutcomeLegend({ showOnsight }: { showOnsight: boolean }) {
  const items: Array<{ outcome: ClimbOutcome; label: string }> = [
    { outcome: showOnsight ? "ONSIGHT" : "FLASH", label: showOnsight ? "Onsight" : "Flash" },
    { outcome: "SEND", label: "Send" },
    { outcome: "PROJECT", label: "Project" },
  ];
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {items.map((item) => (
        <span key={item.outcome} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, opacity: 0.8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: climbOutcomeColor(item.outcome), display: "inline-block" }} />
          {item.label}
        </span>
      ))}
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

// Compact pulse strip — one bordered row, four inline stats with thin
// dividers. Replaces the previous four-card grid that ate ~76px of
// vertical space (worst on mobile where it wrapped to 2x2).
const pulseStripStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 4,
  padding: "8px 12px",
  borderRadius: 12,
  border: `1px solid ${ACCENT_BORDER}`,
  background: `linear-gradient(180deg, ${ACCENT_BG}, rgba(255,255,255,0.02))`,
};

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

// Hub navigation — compact inline pills (icon · label · stat on ONE
// line) instead of stacked tiles. Three fit in a single row even on
// small phones; ~32px tall vs the ~70px tiles they replace.
const hubTileRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const hubTileStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  textDecoration: "none",
  color: "inherit",
  minHeight: 36,
  fontSize: 13,
  flex: "1 1 auto",
  justifyContent: "center",
  whiteSpace: "nowrap",
};

const hubTileLabelStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const hubTileStatStyle: React.CSSProperties = {
  fontSize: 10.5,
  opacity: 0.55,
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

// Solid-segment bar track — gap:1 puts a hairline seam between outcome
// segments so adjacent solid colors stay distinguishable (the old
// climbing world page's pyramid look).
const pyramidBarTrackStyle: React.CSSProperties = {
  display: "flex",
  gap: 1,
  height: 20,
  borderRadius: 5,
  background: "rgba(255,255,255,0.05)",
  overflow: "hidden",
};

const pyramidTotalStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.55,
  textAlign: "left",
};

const pyramidSystemLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.45,
  textTransform: "uppercase",
  letterSpacing: 0.5,
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

const movesTrackStyle: React.CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
  marginTop: 3,
};

const movesFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: ACCENT,
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
