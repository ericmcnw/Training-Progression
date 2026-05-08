import Link from "next/link";
import { notFound } from "next/navigation";
import MetricLineChart from "../MetricLineChart";
import ClimbingWorldPage from "./ClimbingWorldPage";
import ActivityCoverageHeatmap from "./ActivityCoverageHeatmap";
import ActivityGoalsSection from "./ActivityGoalsSection";
import ActivityPulseStrip from "./ActivityPulseStrip";
import { loadActivityCoverage } from "./activity-coverage-loader";
import { buildBoardSportPulse, buildCardioPulse } from "./sport-pulse";
import { applyGoalsToPulseSlots } from "./pulse-goal-slots";
import { getActivityGoals } from "@/lib/activity-goals";
import { getActivityEntry } from "@/lib/activity-families";
import { getRoutineIndex, getRoutineLogs, resolveGroupTarget, summarizeRoutineLogs } from "../data";
import { EmptyState, SectionCard, SectionLinkButton, StatGrid, TargetHeader } from "../ui";
import { formatAppDate } from "@/lib/dates";
import { formatDuration, formatPace } from "@/lib/progress";
import { fillWeeklySeries, getRangeFromSearchParam, incrementWeekMap, normalizeProgressTab, rangeChipLabel, resolveProgressTab, type ProgressRange } from "@/lib/progress-v2";
import { formatRoutineSubtype } from "@/lib/routines";
import { getVirtualSportCategory, isSportGroup, isVirtualSportSlug } from "../sports";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;
type SportLogs = Awaited<ReturnType<typeof getRoutineLogs>>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function sessionPerformanceSeries(logs: SportLogs) {
  return {
    duration: logs
      .filter((log) => Number.isFinite(log.durationSec))
      .map((log) => ({
        label: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
        value: log.durationSec ?? 0,
      })),
    distance: logs
      .filter((log) => Number.isFinite(log.distanceMi))
      .map((log) => ({
        label: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
        value: log.distanceMi ?? 0,
      })),
    elevation: logs
      .filter((log) => Number.isFinite(log.elevationGainFt))
      .map((log) => ({
        label: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
        value: log.elevationGainFt ?? 0,
      })),
    pace: logs
      .filter((log) => Number.isFinite(log.distanceMi) && Number.isFinite(log.durationSec) && (log.distanceMi ?? 0) > 0)
      .map((log) => ({
        label: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
        value: (log.durationSec ?? 0) / (log.distanceMi ?? 1),
      })),
  };
}

function sessionWorkloadSeries(logs: SportLogs, range: ProgressRange) {
  const sessions = new Map<string, number>();
  const duration = new Map<string, number>();
  const distance = new Map<string, number>();
  const elevation = new Map<string, number>();

  for (const log of logs) {
    incrementWeekMap(sessions, log.performedAt, 1);
    incrementWeekMap(duration, log.performedAt, log.durationSec ?? 0);
    incrementWeekMap(distance, log.performedAt, log.distanceMi ?? 0);
    incrementWeekMap(elevation, log.performedAt, log.elevationGainFt ?? 0);
  }

  return {
    sessions: fillWeeklySeries(sessions, range),
    duration: fillWeeklySeries(duration, range),
    distance: fillWeeklySeries(distance, range),
    elevation: fillWeeklySeries(elevation, range),
  };
}

function buildRoutineBreakdown(logs: SportLogs) {
  return Array.from(
    logs.reduce((map, log) => {
      const current = map.get(log.routineId) ?? {
        routineId: log.routineId,
        routineName: log.routine.name,
        sessions: 0,
        durationSec: 0,
        distanceMi: 0,
        elevationGainFt: 0,
        lastSession: null as Date | null,
      };
      current.sessions += 1;
      current.durationSec += log.durationSec ?? 0;
      current.distanceMi += log.distanceMi ?? 0;
      current.elevationGainFt += log.elevationGainFt ?? 0;
      current.lastSession = !current.lastSession || log.performedAt > current.lastSession ? log.performedAt : current.lastSession;
      map.set(log.routineId, current);
      return map;
    }, new Map<string, {
      routineId: string;
      routineName: string;
      sessions: number;
      durationSec: number;
      distanceMi: number;
      elevationGainFt: number;
      lastSession: Date | null;
    }>())
  )
    .map(([, value]) => value)
    .sort((a, b) => b.sessions - a.sessions || b.durationSec - a.durationSec || a.routineName.localeCompare(b.routineName));
}

function buildRecentSessions(logs: SportLogs) {
  return [...logs]
    .sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())
    .slice(0, 8)
    .map((log) => ({
      id: log.id,
      dateLabel: formatAppDate(log.performedAt, { month: "short", day: "numeric" }),
      routineName: log.routine.name,
      subtypeLabel: log.routine.subtype ? formatRoutineSubtype(log.routine.subtype) : null,
      durationLabel: formatDuration(log.durationSec ?? 0),
      distanceLabel: (log.distanceMi ?? 0) > 0 ? `${(log.distanceMi ?? 0).toFixed(1)} mi` : null,
      elevationLabel: (log.elevationGainFt ?? 0) > 0 ? `${Math.round(log.elevationGainFt ?? 0)} ft` : null,
      note: log.notes?.trim() || null,
      location: log.location?.trim() || null,
    }));
}

function buildTopSpots(logs: SportLogs) {
  return Array.from(
    logs.reduce((map, log) => {
      const key = log.location?.trim();
      if (!key) return map;
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function isBoardSportSlug(slug: string) {
  return slug === "surfing" || slug === "snowboarding";
}

function isEnduranceSportSlug(slug: string) {
  return slug === "running" || slug === "walking" || slug === "hiking" || slug === "biking" || slug === "rowing" || slug === "swimming";
}

export default async function SportsTargetPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const requestedTab = normalizeProgressTab(getParam(searchParams, "tab"));
  const range = getRangeFromSearchParam(getParam(searchParams, "range"));
  const tab = resolveProgressTab(requestedTab);

  let title = "";
  let subtitle = "";
  let eyebrow = "Sport";
  let logs: SportLogs = [];
  let routineCount = 0;
  let subtypeLabel: string | null = null;

  const virtualSport = getVirtualSportCategory(params.slug);
  if (virtualSport) {
    const [routines, allLogs] = await Promise.all([getRoutineIndex(), getRoutineLogs(range)]);
    const routineIds = new Set(
      routines
        .filter((routine) => routine.isActive && routine.kind === "SESSION" && routine.subtype === virtualSport.subtype)
        .map((routine) => routine.id)
    );
    logs = allLogs.filter((log) => routineIds.has(log.routineId));
    title = virtualSport.label;
    subtitle = `${virtualSport.label} sessions, trends, and workload in one sport-specific view.`;
    eyebrow = virtualSport.eyebrow;
    routineCount = routineIds.size;
    subtypeLabel = formatRoutineSubtype(virtualSport.subtype);
  } else {
    const target = await resolveGroupTarget(params.slug, range);
    if (!target || !isSportGroup(target.group)) {
      notFound();
    }
    title = target.group.label;
    subtitle = `${target.group.label} sessions, trends, and workload in one sport-specific view.`;
    eyebrow = target.group.slug === "climbing" ? "Climbing" : target.group.kind === "CARDIO_ACTIVITY" ? "Cardio sport" : "Sport group";
    logs = target.logs;
    routineCount = target.routineIds.length;
  }

  if (!virtualSport && isVirtualSportSlug(params.slug)) {
    notFound();
  }

  const summary = summarizeRoutineLogs(logs, null);
  const performance = sessionPerformanceSeries(logs);
  const workload = sessionWorkloadSeries(logs, range);
  const hasDistance = performance.distance.length > 0 || workload.distance.some((point) => point.value > 0);
  const hasElevation = performance.elevation.length > 0 || workload.elevation.some((point) => point.value > 0);
  const routineBreakdown = buildRoutineBreakdown(logs);
  const recentSessions = buildRecentSessions(logs);
  const topSpots = buildTopSpots(logs);
  const lastSessionLabel = summary.lastSession
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(summary.lastSession)
    : "No activity";

  // ── Activity coverage (all-time) — climbing has its own world page ────────
  const isClimbing = params.slug === "climbing";
  // Virtual sports (surfing/snowboarding) don't have a metadata group at their
  // own slug — they roll up under board-sports. Use that for goal lookup so
  // group-targeted goals attached to either flavor still surface.
  const goalLookupSlug = virtualSport ? "board-sports" : params.slug;
  const [coverage, sportGoals] = await Promise.all([
    isClimbing ? Promise.resolve(null) : loadActivityCoverage(params.slug, virtualSport),
    isClimbing ? Promise.resolve([]) : getActivityGoals(goalLookupSlug),
  ]);

  // ── Pulse slots — family-aware momentum strip for non-climbing sports ──────
  // Endurance activities get the cardio pulse (miles / pace / longest / streak).
  // Virtual board sports get the board-sport pulse (sessions / spot / time / streak).
  // Other sport types (basketball, tennis, golf) skip the pulse strip until
  // we have logs to design around.
  const activityEntry = getActivityEntry(params.slug);
  const defaultPulseSlots =
    !isClimbing && coverage
      ? activityEntry?.family === "endurance"
        ? buildCardioPulse(coverage.allTimeSportLogs, new Date())
        : virtualSport
        ? buildBoardSportPulse(coverage.allTimeSportLogs, new Date())
        : []
      : [];
  // Goals matching one of the four pulse roles take over that slot. Default
  // cards still render for slots without a relevant goal.
  const pulseSlots = applyGoalsToPulseSlots(defaultPulseSlots, sportGoals);

  return (
    <>
      <TargetHeader
        section="sports"
        title={title}
        eyebrow={eyebrow}
        subtitle={subtitle}
        basePath={`/activities/${params.slug}`}
        tab={tab}
        range={range}
        hideTabs={params.slug === "climbing"}
        hideRange={params.slug === "climbing"}
        actions={<SectionLinkButton href="/activities" label="All Activities" />}
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
        {params.slug !== "climbing" && (
          <SectionCard title="Overview Snapshot">
            <StatGrid
              items={[
                { label: "Range", value: rangeChipLabel(range) },
                { label: "Sessions", value: String(summary.sessions) },
                { label: "YTD sessions", value: String(summary.ytd) },
                { label: "Routines", value: String(routineCount) },
                { label: "Last session", value: lastSessionLabel },
                { label: "Total duration", value: formatDuration(summary.totalDurationSec) },
                ...(hasDistance ? [{ label: "Total distance", value: `${summary.totalDistance.toFixed(1)} mi` }] : []),
                ...(hasDistance ? [{ label: "Avg pace", value: formatPace(summary.totalDistance > 0 ? summary.totalDurationSec / summary.totalDistance : null) }] : []),
                ...(hasElevation ? [{ label: "Elevation gain", value: `${summary.totalElevationGainFt.toFixed(0)} ft` }] : []),
              ]}
            />
            {subtypeLabel ? <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.72 }}>Session subtype: {subtypeLabel}</div> : null}
          </SectionCard>
        )}

        {params.slug === "climbing" ? <ClimbingWorldPage /> : null}

        {pulseSlots.length > 0 ? <ActivityPulseStrip slots={pulseSlots} /> : null}

        {!isClimbing ? (
          <ActivityGoalsSection
            goals={sportGoals}
            activitySlug={goalLookupSlug}
            activityLabel={title}
          />
        ) : null}

        {coverage && coverage.weeks.length > 1 ? (
          <SectionCard
            title="Activity Coverage"
            subtitle={`${title} sessions and supporting training — last 52 weeks. Tap any week to see what happened.`}
          >
            <ActivityCoverageHeatmap
              weeks={coverage.weeks}
              sessionLabel={`${title} session`}
              trainingLabel="Training"
              sessionRowLabel={title}
              trainingRowLabel="Training"
            />
          </SectionCard>
        ) : null}

        {coverage && coverage.trainingRoutines.length > 0 ? (
          <SectionCard
            title="Supporting Training"
            subtitle={`Strength, conditioning, and habit work tagged to ${title.toLowerCase()}.`}
            actions={
              <Link
                href="/manual-log"
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  opacity: 0.75,
                  textDecoration: "none",
                  color: "inherit",
                  padding: "4px 9px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                View log
              </Link>
            }
          >
            <div style={{ display: "grid", gap: 18 }}>
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
                        <div
                          style={{
                            height: "100%",
                            width: `${widthPct}%`,
                            borderRadius: 999,
                            background: "rgba(168,85,247,0.75)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {coverage.recentTrainingLogs.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.45, textTransform: "uppercase", letterSpacing: 0.5 }}>Recent</div>
                  {coverage.recentTrainingLogs.map((log) => (
                    <Link
                      key={log.id}
                      href={`/routines/${log.routineId}/logs/${log.id}/details`}
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(168,85,247,0.15)",
                        background: "rgba(168,85,247,0.04)",
                        color: "inherit",
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontWeight: 900, fontSize: 13 }}>{log.routineName}</span>
                        <span style={{ fontSize: 11, opacity: 0.55 }}>{formatAppDate(log.performedAt, { month: "short", day: "numeric" })}</span>
                      </div>
                      {log.exerciseNames.length > 0 ? (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {log.exerciseNames.slice(0, 6).map((name) => (
                            <span
                              key={name}
                              style={{
                                fontSize: 11,
                                padding: "2px 7px",
                                borderRadius: 999,
                                background: "rgba(168,85,247,0.12)",
                                border: "1px solid rgba(168,85,247,0.2)",
                                fontWeight: 700,
                              }}
                            >
                              {name}
                            </span>
                          ))}
                          {log.totalSets > 0 ? (
                            <span style={{ fontSize: 11, opacity: 0.5, alignSelf: "center" }}>{log.totalSets} sets</span>
                          ) : null}
                        </div>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {tab === "overview" && params.slug !== "climbing" ? (
          <>
            <SectionCard title="Completion / Consistency">
              {logs.length === 0 ? (
                <EmptyState message="No sport sessions in this range yet." />
              ) : (
                <MetricLineChart title={`${title}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={workload.sessions} decimals={0} />
              )}
            </SectionCard>
            <SectionCard title="Primary Trend">
              {logs.length === 0 ? (
                <EmptyState message="No sport sessions in this range yet." />
              ) : hasDistance ? (
                <MetricLineChart title={`${title}: Distance per Week`} yLabel="Distance" xLabel="Week" points={workload.distance} unit="mi" decimals={2} />
              ) : (
                <MetricLineChart title={`${title}: Duration per Week`} yLabel="Duration" xLabel="Week" points={workload.duration} unit="sec" decimals={0} format="duration" omitTotal />
              )}
            </SectionCard>
            {isEnduranceSportSlug(params.slug) && logs.length > 0 ? (
              <SectionCard title="Performance Snapshot" subtitle="Use the fastest-changing metrics first for quick review.">
                <div style={{ display: "grid", gap: 10 }}>
                  {hasDistance ? <MetricLineChart title={`${title}: Distance per Session`} yLabel="Distance" xLabel="Session" points={performance.distance} unit="mi" decimals={2} /> : null}
                  {performance.pace.length > 0 ? <MetricLineChart title={`${title}: Pace per Session`} yLabel="Pace" xLabel="Session" points={performance.pace} unit="sec/mi" decimals={0} /> : null}
                  {hasElevation ? <MetricLineChart title={`${title}: Elevation per Session`} yLabel="Elevation" xLabel="Session" points={performance.elevation} unit="ft" decimals={0} /> : null}
                </div>
              </SectionCard>
            ) : null}
            {isBoardSportSlug(params.slug) && logs.length > 0 ? (
              <SectionCard title="Session Rhythm" subtitle="Board sports usually hinge on time-on-board and session frequency more than straight-line distance.">
                <div style={{ display: "grid", gap: 10 }}>
                  <MetricLineChart title={`${title}: Duration per Session`} yLabel="Duration" xLabel="Session" points={performance.duration} unit="sec" decimals={0} format="duration" omitTotal />
                  <MetricLineChart title={`${title}: Duration per Week`} yLabel="Duration" xLabel="Week" points={workload.duration} unit="sec" decimals={0} format="duration" omitTotal />
                </div>
              </SectionCard>
            ) : null}
            {params.slug !== "climbing" ? (
              <>
                <SectionCard title="Routine Mix" subtitle="Which routines are driving this sport page right now.">
                  {routineBreakdown.length === 0 ? (
                    <EmptyState message="No routines have contributed to this sport in the selected range." />
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {routineBreakdown.slice(0, 6).map((row) => (
                        <div key={row.routineId} style={{ display: "grid", gap: 4, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>{row.routineName}</div>
                            <div style={{ fontSize: 12, opacity: 0.72 }}>{row.lastSession ? `Last ${formatAppDate(row.lastSession, { month: "short", day: "numeric" })}` : "No recent activity"}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {[`${row.sessions} sessions`, row.durationSec > 0 ? formatDuration(row.durationSec) : null, row.distanceMi > 0 ? `${row.distanceMi.toFixed(1)} mi` : null, row.elevationGainFt > 0 ? `${Math.round(row.elevationGainFt)} ft` : null]
                              .filter((value): value is string => Boolean(value))
                              .map((chip) => (
                                <span key={chip} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", fontWeight: 700 }}>
                                  {chip}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
                <SectionCard title={isBoardSportSlug(params.slug) ? "Spots" : "Locations"} subtitle={isBoardSportSlug(params.slug) ? "Where these recent sessions happened." : "Saved locations attached to recent sport sessions."}>
                  {topSpots.length === 0 ? (
                    <EmptyState message={isBoardSportSlug(params.slug) ? "No named spots attached to these sessions yet." : "No named locations attached to these sessions yet."} />
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {topSpots.slice(0, 8).map(([name, count]) => (
                        <span key={name} style={{ fontSize: 12, fontWeight: 800, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                          {name} {count}x
                        </span>
                      ))}
                    </div>
                  )}
                </SectionCard>
                <SectionCard title="Recent Sessions" subtitle="Latest sessions contributing to this sport page.">
                  {recentSessions.length === 0 ? (
                    <EmptyState message="No recent sessions for this sport yet." />
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {recentSessions.map((session) => (
                        <div key={session.id} style={{ display: "grid", gap: 4, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>{session.routineName}</div>
                            <div style={{ fontSize: 12, opacity: 0.72 }}>{session.dateLabel}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {[session.subtypeLabel, session.durationLabel, session.distanceLabel, session.elevationLabel, session.location]
                              .filter((value): value is string => Boolean(value))
                              .map((chip) => (
                                <span key={chip} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", fontWeight: 700 }}>
                                  {chip}
                                </span>
                              ))}
                          </div>
                          {session.note ? <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.72 }}>{session.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </>
            ) : null}
          </>
        ) : null}

        {tab === "completion" && params.slug !== "climbing" ? (
          <SectionCard title="Completion">
            {logs.length === 0 ? <EmptyState message="No sport sessions in this range yet." /> : <MetricLineChart title={`${title}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={workload.sessions} decimals={0} />}
          </SectionCard>
        ) : null}

        {tab === "performance" && params.slug !== "climbing" ? (
          <SectionCard title="Performance">
            {logs.length === 0 ? (
              <EmptyState message="No sport sessions in this range yet." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${title}: Duration per Session`} yLabel="Duration" xLabel="Session" points={performance.duration} unit="sec" decimals={0} format="duration" omitTotal />
                {hasDistance ? <MetricLineChart title={`${title}: Distance per Session`} yLabel="Distance" xLabel="Session" points={performance.distance} unit="mi" decimals={2} /> : null}
                {performance.pace.length > 0 ? <MetricLineChart title={`${title}: Pace per Session`} yLabel="Pace" xLabel="Session" points={performance.pace} unit="sec/mi" decimals={0} /> : null}
                {hasElevation ? <MetricLineChart title={`${title}: Elevation per Session`} yLabel="Elevation" xLabel="Session" points={performance.elevation} unit="ft" decimals={0} /> : null}
              </div>
            )}
          </SectionCard>
        ) : null}

        {tab === "workload" && params.slug !== "climbing" ? (
          <SectionCard title="Workload">
            {logs.length === 0 ? (
              <EmptyState message="No sport sessions in this range yet." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${title}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={workload.sessions} decimals={0} />
                <MetricLineChart title={`${title}: Duration per Week`} yLabel="Duration" xLabel="Week" points={workload.duration} unit="sec" decimals={0} format="duration" omitTotal />
                {hasDistance ? <MetricLineChart title={`${title}: Distance per Week`} yLabel="Distance" xLabel="Week" points={workload.distance} unit="mi" decimals={2} /> : null}
                {hasElevation ? <MetricLineChart title={`${title}: Elevation per Week`} yLabel="Elevation" xLabel="Week" points={workload.elevation} unit="ft" decimals={0} /> : null}
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
