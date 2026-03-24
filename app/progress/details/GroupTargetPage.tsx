import MetricLineChart from "../MetricLineChart";
import { cardioPerformanceSeries, cardioWorkloadSeries, durationWeeklySeries, groupTargetType, guidedItemWeeklySeries, resolveGroupTarget, summarizeRoutineLogs, workoutSessionSeries, workoutWeeklySeries } from "../data";
import { EmptyState, SectionCard, SectionLinkButton, StatGrid, TargetHeader } from "../ui";
import { formatAppDate } from "@/lib/dates";
import { getChartGoalReference } from "@/lib/goals";
import { formatWeekLabel, getRangeFromSearchParam, normalizeProgressTab, rangeChipLabel, resolveProgressTab, weekKey, type ProgressTab } from "@/lib/progress-v2";
import { formatDuration, formatPace } from "@/lib/progress";
import { aggregateSessionMetricHistory, sessionMetricPerformanceSeries } from "@/lib/session-metrics";
import { withSessionMetricConfig } from "@/lib/session-templates";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildWeeklySessionDetailLines(logs: NonNullable<Awaited<ReturnType<typeof resolveGroupTarget>>>["logs"]) {
  const weekMap = new Map<string, Map<string, Map<string, number>>>();

  for (const log of logs) {
    const currentWeekKey = weekKey(log.performedAt);
    const dayLabel = formatAppDate(log.performedAt, { weekday: "short", month: "numeric", day: "numeric" });
    const routineMap = weekMap.get(currentWeekKey) ?? new Map<string, Map<string, number>>();
    const dayRoutineMap = routineMap.get(dayLabel) ?? new Map<string, number>();
    dayRoutineMap.set(log.routine.name, (dayRoutineMap.get(log.routine.name) ?? 0) + 1);
    routineMap.set(dayLabel, dayRoutineMap);
    weekMap.set(currentWeekKey, routineMap);
  }

  return new Map(
    Array.from(weekMap.entries()).map(([currentWeekKey, dayMap]) => [
      formatWeekLabel(currentWeekKey),
      Array.from(dayMap.entries()).flatMap(([dayLabel, routineMap]) => {
        const routineSummary = Array.from(routineMap.entries())
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([routineName, count]) => (count > 1 ? `${routineName} x${count}` : routineName))
          .join(", ");
        return routineSummary ? [`${dayLabel}: ${routineSummary}`] : [];
      }),
    ])
  );
}

export default async function GroupTargetPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const requestedTab = normalizeProgressTab(getParam(searchParams, "tab"));
  const range = getRangeFromSearchParam(getParam(searchParams, "range"));

  const target = await resolveGroupTarget(params.slug, range);
  if (!target) return <div style={{ padding: 20 }}>Group not found.</div>;

  const [sessionsGoalLine, weeklyDistanceGoalLine, durationGoalLine, weeklyVolumeGoalLine, weeklyRepsGoalLine, weeklySetsGoalLine] = await Promise.all([
    getChartGoalReference({
      candidates: [{ targetType: "GROUP", targetId: target.group.id }],
      metricType: "SESSIONS",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "GROUP", targetId: target.group.id }],
      metricType: "DISTANCE",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "GROUP", targetId: target.group.id }],
      metricType: "DURATION",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "GROUP", targetId: target.group.id }],
      metricType: "VOLUME",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "GROUP", targetId: target.group.id }],
      metricType: "REPS",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "GROUP", targetId: target.group.id }],
      metricType: "SETS",
      timeframe: "WEEK",
    }),
  ]);

  const summary = summarizeRoutineLogs(target.logs, null);
  const targetType = groupTargetType(target.logs);
  const availableTabs: ProgressTab[] =
    targetType === "mixed" ? ["overview", "completion", "workload"] : ["overview", "completion", "performance", "workload"];
  const tab = resolveProgressTab(requestedTab, availableTabs);
  const targetLabel = target.group.label;
  const sessionMetricDefinitions = Array.from(
    new Map(
      target.logs
        .flatMap((log) => log.sessionMetricValues.map((value) => [value.metricDefinition.id, withSessionMetricConfig(value.metricDefinition)] as const))
    ).values()
  ).filter((definition) => definition.showInProgress);
  const sessionPerformanceCharts = sessionMetricDefinitions
    .map((definition) => ({
      definition,
      points: sessionMetricPerformanceSeries(target.logs, definition),
    }))
    .filter((entry) => entry.points.length > 0);
  const sessionWorkloadCharts = sessionMetricDefinitions
    .filter((definition) => definition.valueType === "INTEGER" || definition.valueType === "DECIMAL" || definition.config?.input === "grade")
    .map((definition) => ({
      definition,
      points: aggregateSessionMetricHistory(target.logs, definition.id, range, definition.config?.input === "grade" ? "max" : "sum"),
    }))
    .filter((entry) => entry.points.some((point) => point.value > 0));
  const cardioPerf = cardioPerformanceSeries(target.logs);
  const cardioWorkload = cardioWorkloadSeries(target.logs, range);
  const weeklySessionDetailLines = buildWeeklySessionDetailLines(target.logs);
  const sessionsSeries = cardioWorkload.sessions.map((point) => ({
    ...point,
    detailLines: weeklySessionDetailLines.get(point.label) ?? [],
  }));
  const workoutPerf = workoutSessionSeries(target.logs);
  const workoutWorkload = workoutWeeklySeries(target.logs, range);
  const durationWorkload = durationWeeklySeries(target.logs, range);
  const guidedWorkload = guidedItemWeeklySeries(target.logs, range, {
    guidedStepIds: target.guidedStepIds,
    guidedExerciseIds: target.guidedExerciseIds,
  });
  const hasGuidedWorkload =
    guidedWorkload.completions.some((point) => point.value > 0) ||
    guidedWorkload.duration.some((point) => point.value > 0);

  const overviewSecondary =
    targetType === "cardio" ? (
      <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={cardioWorkload.distance} unit="mi" decimals={2} targetValue={weeklyDistanceGoalLine?.targetValue} targetLabel={weeklyDistanceGoalLine?.label} targetUnit={weeklyDistanceGoalLine?.unit} targetDecimals={weeklyDistanceGoalLine?.decimals} />
    ) : targetType === "workout" ? (
      <MetricLineChart title={`${targetLabel}: Volume per Week`} yLabel="Volume" xLabel="Week" points={workoutWorkload.volume} decimals={0} targetValue={weeklyVolumeGoalLine?.targetValue} targetLabel={weeklyVolumeGoalLine?.label} targetUnit={weeklyVolumeGoalLine?.unit} targetDecimals={weeklyVolumeGoalLine?.decimals} />
    ) : targetType === "session" && sessionWorkloadCharts.length > 0 ? (
      <MetricLineChart
        title={`${targetLabel}: ${sessionWorkloadCharts[0].definition.label} per Week`}
        yLabel={sessionWorkloadCharts[0].definition.label}
        xLabel="Week"
        points={sessionWorkloadCharts[0].points}
        unit={sessionWorkloadCharts[0].definition.unit ?? undefined}
        decimals={sessionWorkloadCharts[0].definition.valueType === "DECIMAL" ? 1 : 0}
      />
    ) : (
      <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} targetValue={durationGoalLine?.targetValue} targetLabel={durationGoalLine?.label} targetUnit={durationGoalLine?.unit} targetDecimals={durationGoalLine?.decimals} />
    );

  return (
    <>
      <TargetHeader
        section="groups"
        title={target.group.label}
        subtitle={`Group rollup | ${target.group.kind.replaceAll("_", " ")}`}
        basePath={`/progress/groups/${target.group.slug}`}
        tab={tab}
        range={range}
        availableTabs={availableTabs}
        actions={<SectionLinkButton href="/progress?section=groups" label="Back to Groups" />}
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
        <SectionCard title="Overview Snapshot">
          <StatGrid
            items={[
              { label: "Range", value: rangeChipLabel(range) },
              { label: "Sessions", value: String(summary.sessions) },
              { label: "YTD sessions", value: String(summary.ytd) },
              { label: "Routines", value: String(target.routineIds.length) },
              { label: "Exercises", value: String(target.exerciseIds.length) },
              ...(hasGuidedWorkload ? [{ label: "Guided items", value: String(target.guidedStepIds.length + target.guidedExerciseIds.length) }] : []),
              { label: targetType === "cardio" ? "Avg pace" : "Total duration", value: targetType === "cardio" ? formatPace(summary.totalDistance > 0 ? summary.totalDurationSec / summary.totalDistance : null) : formatDuration(summary.totalDurationSec) },
            ]}
          />
        </SectionCard>

        {tab === "overview" ? (
          <>
            <SectionCard title="Completion / Consistency">
              {target.logs.length === 0 ? <EmptyState message="No activity in this group for the selected range." /> : <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={sessionsSeries} decimals={0} targetValue={sessionsGoalLine?.targetValue} targetLabel={sessionsGoalLine?.label} targetUnit={sessionsGoalLine?.unit} targetDecimals={sessionsGoalLine?.decimals} />}
            </SectionCard>
            <SectionCard title={targetType === "mixed" ? "Workload Snapshot" : "Primary Trend"}>
              {target.logs.length === 0 ? <EmptyState message="No activity in this group for the selected range." /> : overviewSecondary}
            </SectionCard>
            {targetType === "cardio" ? (
              <SectionCard title="Performance Snapshot">
                <MetricLineChart title={`${targetLabel}: Pace per Session`} yLabel="Pace" xLabel="Session" points={cardioPerf.pacePoints} unit="sec/mi" decimals={0} />
              </SectionCard>
            ) : null}
          </>
        ) : null}

        {tab === "completion" ? (
          <SectionCard title="Completion">
            {target.logs.length === 0 ? <EmptyState message="No activity in this group for the selected range." /> : <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={sessionsSeries} decimals={0} targetValue={sessionsGoalLine?.targetValue} targetLabel={sessionsGoalLine?.label} targetUnit={sessionsGoalLine?.unit} targetDecimals={sessionsGoalLine?.decimals} />}
          </SectionCard>
        ) : null}

        {tab === "performance" ? (
          <SectionCard title="Performance">
            {target.logs.length === 0 ? (
              <EmptyState message="No activity in this group for the selected range." />
            ) : targetType === "cardio" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Distance per Session`} yLabel="Distance" xLabel="Session" points={cardioPerf.distancePoints} unit="mi" decimals={2} />
                <MetricLineChart title={`${targetLabel}: Pace per Session`} yLabel="Pace" xLabel="Session" points={cardioPerf.pacePoints} unit="sec/mi" decimals={0} />
              </div>
            ) : targetType === "workout" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Volume per Session`} yLabel="Volume" xLabel="Session" points={workoutPerf.totalVolume} decimals={0} />
                <MetricLineChart title={`${targetLabel}: Reps per Session`} yLabel="Reps" xLabel="Session" points={workoutPerf.totalReps} decimals={0} />
              </div>
            ) : targetType === "session" ? (
              sessionPerformanceCharts.length > 0 ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {sessionPerformanceCharts.map((entry) => (
                    <MetricLineChart
                      key={entry.definition.id}
                      title={`${targetLabel}: ${entry.definition.label}`}
                      yLabel={entry.definition.label}
                      xLabel="Session"
                      points={entry.points}
                      unit={entry.definition.unit ?? undefined}
                      decimals={entry.definition.valueType === "DECIMAL" ? 1 : 0}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState message="No structured session metrics in this group yet." />
              )
            ) : (
              <EmptyState message="This group mixes training types, so performance is intentionally minimized here. Use completion and workload first." />
            )}
          </SectionCard>
        ) : null}

        {tab === "workload" ? (
          <SectionCard title="Workload">
            {target.logs.length === 0 ? (
              <EmptyState message="No activity in this group for the selected range." />
            ) : targetType === "cardio" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={sessionsSeries} decimals={0} targetValue={sessionsGoalLine?.targetValue} targetLabel={sessionsGoalLine?.label} targetUnit={sessionsGoalLine?.unit} targetDecimals={sessionsGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={cardioWorkload.distance} unit="mi" decimals={2} targetValue={weeklyDistanceGoalLine?.targetValue} targetLabel={weeklyDistanceGoalLine?.label} targetUnit={weeklyDistanceGoalLine?.unit} targetDecimals={weeklyDistanceGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={cardioWorkload.duration} unit="sec" decimals={0} targetValue={durationGoalLine?.targetValue} targetLabel={durationGoalLine?.label} targetUnit={durationGoalLine?.unit} targetDecimals={durationGoalLine?.decimals} />
              </div>
            ) : targetType === "workout" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Sets per Week`} yLabel="Sets" xLabel="Week" points={workoutWorkload.sets} decimals={0} targetValue={weeklySetsGoalLine?.targetValue} targetLabel={weeklySetsGoalLine?.label} targetUnit={weeklySetsGoalLine?.unit} targetDecimals={weeklySetsGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Reps per Week`} yLabel="Reps" xLabel="Week" points={workoutWorkload.reps} decimals={0} targetValue={weeklyRepsGoalLine?.targetValue} targetLabel={weeklyRepsGoalLine?.label} targetUnit={weeklyRepsGoalLine?.unit} targetDecimals={weeklyRepsGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Volume per Week`} yLabel="Volume" xLabel="Week" points={workoutWorkload.volume} decimals={0} targetValue={weeklyVolumeGoalLine?.targetValue} targetLabel={weeklyVolumeGoalLine?.label} targetUnit={weeklyVolumeGoalLine?.unit} targetDecimals={weeklyVolumeGoalLine?.decimals} />
              </div>
            ) : targetType === "session" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={sessionsSeries} decimals={0} targetValue={sessionsGoalLine?.targetValue} targetLabel={sessionsGoalLine?.label} targetUnit={sessionsGoalLine?.unit} targetDecimals={sessionsGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} targetValue={durationGoalLine?.targetValue} targetLabel={durationGoalLine?.label} targetUnit={durationGoalLine?.unit} targetDecimals={durationGoalLine?.decimals} />
                {sessionWorkloadCharts.map((entry) => (
                  <MetricLineChart
                    key={entry.definition.id}
                    title={`${targetLabel}: ${entry.definition.label} per Week`}
                    yLabel={entry.definition.label}
                    xLabel="Week"
                    points={entry.points}
                    unit={entry.definition.unit ?? undefined}
                    decimals={entry.definition.valueType === "DECIMAL" ? 1 : 0}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={sessionsSeries} decimals={0} targetValue={sessionsGoalLine?.targetValue} targetLabel={sessionsGoalLine?.label} targetUnit={sessionsGoalLine?.unit} targetDecimals={sessionsGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} targetValue={durationGoalLine?.targetValue} targetLabel={durationGoalLine?.label} targetUnit={durationGoalLine?.unit} targetDecimals={durationGoalLine?.decimals} />
                {hasGuidedWorkload ? (
                  <>
                    <MetricLineChart title={`${targetLabel}: Guided item completions per Week`} yLabel="Completions" xLabel="Week" points={guidedWorkload.completions} decimals={0} />
                    <MetricLineChart title={`${targetLabel}: Guided item time per Week`} yLabel="Duration" xLabel="Week" points={guidedWorkload.duration} unit="sec" decimals={0} />
                  </>
                ) : null}
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
