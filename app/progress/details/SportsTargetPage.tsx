import { notFound } from "next/navigation";
import MetricLineChart from "../MetricLineChart";
import ClimbingProgressView from "../ClimbingProgressView";
import { getRoutineIndex, getRoutineLogs, resolveGroupTarget, summarizeRoutineLogs } from "../data";
import { EmptyState, SectionCard, SectionLinkButton, StatGrid, TargetHeader } from "../ui";
import { formatAppDate } from "@/lib/dates";
import { formatDuration, formatPace } from "@/lib/progress";
import { getRangeFromSearchParam, normalizeProgressTab, rangeChipLabel, resolveProgressTab, fillWeeklySeries, incrementWeekMap, type ProgressRange } from "@/lib/progress-v2";
import { formatRoutineSubtype } from "@/lib/routines";
import { getVirtualSportCategory, isSportGroup, isVirtualSportSlug } from "../sports";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function sessionPerformanceSeries(logs: Awaited<ReturnType<typeof getRoutineLogs>>) {
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

function sessionWorkloadSeries(logs: Awaited<ReturnType<typeof getRoutineLogs>>, range: ProgressRange) {
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
  let logs: Awaited<ReturnType<typeof getRoutineLogs>> = [];
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
  const routineNames = Array.from(new Set(logs.map((log) => log.routine.name))).sort((a, b) => a.localeCompare(b)).slice(0, 6);
  const lastSessionLabel = summary.lastSession
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(summary.lastSession)
    : "No activity";

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
          {subtypeLabel ? (
            <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.72 }}>
              Session subtype: {subtypeLabel}
            </div>
          ) : null}
        </SectionCard>

        {params.slug === "climbing" ? <ClimbingProgressView /> : null}

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

        <SectionCard title="Linked Routines" subtitle="Recent routines contributing to this sport page.">
          {routineNames.length === 0 ? (
            <EmptyState message="No routines have contributed to this sport in the selected range." />
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {routineNames.map((name) => (
                <span
                  key={name}
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.05)",
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
