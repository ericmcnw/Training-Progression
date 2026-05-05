import { notFound } from "next/navigation";
import MetricLineChart from "../MetricLineChart";
import ClimbingProgressView from "../ClimbingProgressView";
import { getRoutineIndex, getRoutineLogs, resolveGroupTarget, summarizeRoutineLogs } from "../data";
import { EmptyState, SectionCard, SectionLinkButton, StatGrid, TargetHeader } from "../ui";
import { formatAppDate } from "@/lib/dates";
import { formatDuration, formatPace } from "@/lib/progress";
import { fillWeeklySeries, getRangeFromSearchParam, incrementWeekMap, normalizeProgressTab, rangeChipLabel, resolveProgressTab, type ProgressRange } from "@/lib/progress-v2";
import { formatRoutineSubtype } from "@/lib/routines";
import { getVirtualSportCategory, isSportGroup, isVirtualSportSlug } from "../sports";
import { prisma } from "@/lib/prisma";
import { climbOutcomeBg, climbOutcomeLabel } from "@/lib/climb-types";
import type { ClimbOutcome, ClimbGradeSystem } from "@/lib/climb-types";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;
type SportLogs = Awaited<ReturnType<typeof getRoutineLogs>>;

type ClimbSessionDetail = {
  id: string;
  performedAt: Date;
  routineName: string;
  templateKey: string | null;
  locationName: string | null;
  locationType: "GYM" | "CRAG" | null;
  attempts: Array<{
    grade: string;
    gradeSystem: ClimbGradeSystem;
    outcome: ClimbOutcome;
  }>;
};

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

async function getClimbingSessionDetails(logIds: string[]) {
  if (logIds.length === 0) return [];
  return prisma.routineLog.findMany({
    where: { id: { in: logIds } },
    orderBy: { performedAt: "desc" },
    select: {
      id: true,
      performedAt: true,
      routine: {
        select: {
          name: true,
          sessionDetails: {
            select: {
              template: {
                select: {
                  key: true,
                },
              },
            },
          },
        },
      },
      climbLocation: {
        select: {
          name: true,
          type: true,
        },
      },
      climbAttempts: {
        orderBy: { attemptOrder: "asc" },
        select: {
          grade: true,
          gradeSystem: true,
          outcome: true,
        },
      },
    },
  }).then((rows) =>
    rows.map((row) => ({
      id: row.id,
      performedAt: row.performedAt,
      routineName: row.routine.name,
      templateKey: row.routine.sessionDetails?.template?.key ?? null,
      locationName: row.climbLocation?.name ?? null,
      locationType: row.climbLocation?.type ?? null,
      attempts: row.climbAttempts,
    }))
  );
}

function climbingVenueLabel(session: ClimbSessionDetail) {
  const templateKey = session.templateKey ?? "";
  if (templateKey.startsWith("indoor-")) return "Indoor";
  if (templateKey.startsWith("outdoor-")) return "Outdoor";
  if (session.locationType === "GYM") return "Indoor";
  if (session.locationType === "CRAG") return "Outdoor";
  return "Unknown";
}

function ClimbingOverview({
  sessions,
}: {
  sessions: ClimbSessionDetail[];
}) {
  const allAttempts = sessions.flatMap((session) => session.attempts);
  const indoorSessions = sessions.filter((session) => climbingVenueLabel(session) === "Indoor");
  const outdoorSessions = sessions.filter((session) => climbingVenueLabel(session) === "Outdoor");
  const sends = allAttempts.filter((attempt) => attempt.outcome === "SEND" || attempt.outcome === "REDPOINT").length;
  const flashes = allAttempts.filter((attempt) => attempt.outcome === "FLASH" || attempt.outcome === "ONSIGHT").length;
  const projects = allAttempts.filter((attempt) => attempt.outcome === "PROJECT").length;
  const falls = allAttempts.filter((attempt) => attempt.outcome === "FELL").length;
  const locationCounts = Array.from(
    sessions.reduce((map, session) => {
      if (!session.locationName) return map;
      map.set(session.locationName, (map.get(session.locationName) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <>
      <SectionCard title="Climbing Snapshot">
        <StatGrid
          items={[
            { label: "Indoor sessions", value: String(indoorSessions.length) },
            { label: "Outdoor sessions", value: String(outdoorSessions.length) },
            { label: "Attempts", value: String(allAttempts.length) },
            { label: "Flashes / Onsights", value: String(flashes), accent: "rgba(251,191,36,0.9)" },
            { label: "Sends", value: String(sends), accent: "rgba(74,222,128,0.9)" },
            { label: "Projects", value: String(projects), accent: "rgba(167,139,250,0.9)" },
            { label: "Falls", value: String(falls), accent: "rgba(248,113,113,0.9)" },
          ]}
        />
      </SectionCard>

      <ClimbingProgressView />

      <SectionCard title="Recent Climbing Sessions" subtitle="Latest climbing logs with venue, routine, and outcome mix.">
        {sessions.length === 0 ? (
          <EmptyState message="No climbing sessions in this range yet." />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {sessions.slice(0, 8).map((session) => {
              const sendCount = session.attempts.filter((attempt) => attempt.outcome === "SEND" || attempt.outcome === "REDPOINT").length;
              const flashCount = session.attempts.filter((attempt) => attempt.outcome === "FLASH" || attempt.outcome === "ONSIGHT").length;
              const projectCount = session.attempts.filter((attempt) => attempt.outcome === "PROJECT").length;
              return (
                <div
                  key={session.id}
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>{session.routineName}</div>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>{formatAppDate(session.performedAt, { month: "short", day: "numeric" })}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[climbingVenueLabel(session), session.locationName, `${session.attempts.length} attempts`, flashCount > 0 ? `${flashCount} flash/onsight` : null, sendCount > 0 ? `${sendCount} send` : null, projectCount > 0 ? `${projectCount} project` : null]
                      .filter((value): value is string => Boolean(value))
                      .map((chip) => (
                        <span key={chip} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", fontWeight: 700 }}>
                          {chip}
                        </span>
                      ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Array.from(
                      session.attempts.reduce((map, attempt) => {
                        const key = `${attempt.gradeSystem}-${attempt.grade}-${attempt.outcome}`;
                        const current = map.get(key) ?? { attempt, count: 0 };
                        current.count += 1;
                        map.set(key, current);
                        return map;
                      }, new Map<string, { attempt: ClimbSessionDetail["attempts"][number]; count: number }>())
                    )
                      .slice(0, 6)
                      .map(([key, value]) => (
                        <span
                          key={key}
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 999,
                            background: climbOutcomeBg(value.attempt.outcome),
                            border: "1px solid rgba(255,255,255,0.09)",
                            fontWeight: 700,
                          }}
                        >
                          {value.attempt.grade} {climbOutcomeLabel(value.attempt.outcome, value.attempt.gradeSystem)}
                          {value.count > 1 ? ` x${value.count}` : ""}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Top Venues" subtitle="Where your recent climbing sessions were logged.">
        {locationCounts.length === 0 ? (
          <EmptyState message="No climb locations attached to these sessions yet." />
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {locationCounts.slice(0, 8).map(([name, count]) => (
              <span key={name} style={{ fontSize: 12, fontWeight: 800, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" }}>
                {name} {count}x
              </span>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
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
  const climbingSessions = params.slug === "climbing" ? await getClimbingSessionDetails(logs.map((log) => log.id)) : [];

  return (
    <>
      <TargetHeader
        section="sports"
        title={title}
        eyebrow={eyebrow}
        subtitle={subtitle}
        basePath={`/progress/sports/${params.slug}`}
        tab={tab}
        range={range}
        actions={<SectionLinkButton href="/progress/sports" label="Back to Sports" />}
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
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

        {params.slug === "climbing" && tab === "overview" ? <ClimbingOverview sessions={climbingSessions} /> : null}

        {tab === "overview" ? (
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

        {tab === "completion" ? (
          <SectionCard title="Completion">
            {logs.length === 0 ? <EmptyState message="No sport sessions in this range yet." /> : <MetricLineChart title={`${title}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={workload.sessions} decimals={0} />}
          </SectionCard>
        ) : null}

        {tab === "performance" ? (
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

        {tab === "workload" ? (
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
