import MetricLineChart from "../MetricLineChart";
import { cardioPerformanceSeries, cardioWorkloadSeries, durationWeeklySeries, getRoutineLogs, routineSubtitle, summarizeRoutineLogs, workoutSessionSeries, workoutWeeklySeries } from "../data";
import { EmptyState, SectionCard, SectionLinkButton, StatGrid, TargetCard, TargetHeader } from "../ui";
import { formatAppDate } from "@/lib/dates";
import { getChartGoalReference } from "@/lib/goals";
import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, getRangeFromSearchParam, normalizeProgressTab, rangeChipLabel, resolveProgressTab, startOfYear, type ProgressTab } from "@/lib/progress-v2";
import { formatDuration, formatPace } from "@/lib/progress";
import { getRoutineFrequencyStatus, getRoutineTargetWindow } from "@/lib/routine-frequency";
import { aggregateSessionMetricHistory, sessionMetricPerformanceSeries } from "@/lib/session-metrics";
import { withSessionMetricConfig } from "@/lib/session-templates";

export const dynamic = "force-dynamic";

type Params = { routineId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatSecondsShort(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 sec";
  const rounded = Math.round(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes <= 0) return `${seconds} sec`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export default async function RoutineTargetPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const requestedTab = normalizeProgressTab(getParam(searchParams, "tab"));
  const range = getRangeFromSearchParam(getParam(searchParams, "range"));
  const routineId = params.routineId;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    include: {
      exercises: {
        include: {
          exercise: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      metadataGroups: {
        include: { group: true },
      },
      tagAssignments: {
        include: { tag: true },
      },
      sessionDetails: {
        include: {
          template: {
            include: {
              metricDefinitions: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  const kind = routine.kind;
  const availableTabs: ProgressTab[] =
    kind === "COMPLETION"
      ? ["overview", "completion"]
      : kind === "GUIDED"
      ? ["overview", "completion", "workload"]
      : ["overview", "completion", "performance", "workload"];
  const tab = resolveProgressTab(requestedTab, availableTabs);

  const [completionGoalLine, weeklyDistanceGoalLine, sessionDistanceGoalLine, weeklyElevationGoalLine, sessionElevationGoalLine, durationGoalLine, setsGoalLine, repsGoalLine, volumeGoalLine, ytdCount, last8RawLogs] = await Promise.all([
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "SESSIONS",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "DISTANCE",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "DISTANCE",
      timeframe: "ONE_TIME",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "ELEVATION_GAIN",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "ELEVATION_GAIN",
      timeframe: "ONE_TIME",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "DURATION",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "SETS",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "REPS",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "ROUTINE", targetId: routine.id }],
      metricType: "VOLUME",
      timeframe: "WEEK",
    }),
    prisma.routineLog.count({
      where: { routineId: routine.id, performedAt: { gte: startOfYear(new Date()) } },
    }),
    prisma.routineLog.findMany({
      where: { routineId: routine.id },
      orderBy: { performedAt: "desc" },
      take: 8,
      include: {
        exercises: {
          include: { sets: true },
        },
      },
    }),
  ]);
  const last8Logs = [...last8RawLogs].reverse();

  const logs = (await getRoutineLogs(range, { routineIds: [routine.id] })).filter((log) => log.routineId === routine.id);
  const frequencyWindowStart = getRoutineTargetWindow(routine)?.start;
  const frequencyLogs =
    frequencyWindowStart
      ? await prisma.routineLog.findMany({
          where: {
            routineId: routine.id,
            performedAt: { gte: frequencyWindowStart },
          },
          select: { performedAt: true },
        })
      : [];
  const frequencySummary = getRoutineFrequencyStatus({
    target: routine,
    logs: frequencyLogs,
  });
  const summary = summarizeRoutineLogs(logs, routine.timesPerWeek);
  const completionSeries = fillWeeklySeries(summary.sessionWeekMap, range);
  const cardioPerf = cardioPerformanceSeries(logs);
  const cardioWorkload = cardioWorkloadSeries(logs, range);
  const workoutPerf = workoutSessionSeries(logs);
  const workoutWorkload = workoutWeeklySeries(logs, range);
  const durationWorkload = durationWeeklySeries(logs, range);
  const targetLabel = routine.name;
  const sessionMetricDefinitions = routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig).filter((definition) => definition.showInProgress) ?? [];
  const sessionPerformanceCharts = sessionMetricDefinitions
    .map((definition) => ({
      definition,
      points: sessionMetricPerformanceSeries(logs, definition),
    }))
    .filter((entry) => entry.points.length > 0);
  const sessionWorkloadCharts = sessionMetricDefinitions
    .filter((definition) => definition.valueType === "INTEGER" || definition.valueType === "DECIMAL" || definition.config?.input === "grade")
    .map((definition) => ({
      definition,
      points: aggregateSessionMetricHistory(
        logs,
        definition.id,
        range,
        tab === "performance" || definition.config?.input === "grade" ? "max" : "sum"
      ),
    }))
    .filter((entry) => entry.points.some((point) => point.value > 0));
  const lastCompletedLabel = summary.lastSession
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(summary.lastSession)
    : "-";
  const routineExercisePerformance = routine.exercises.map((routineExercise) => {
    const sessionRows = logs.flatMap((log) =>
      log.exercises
        .filter((entry) => entry.exerciseId === routineExercise.exercise.id)
        .map((entry) => {
          const topWeight = Math.max(0, ...entry.sets.map((set) => set.weightLb ?? 0));
          const topReps = Math.max(0, ...entry.sets.map((set) => set.reps ?? 0));
          const topSeconds = Math.max(0, ...entry.sets.map((set) => set.seconds ?? 0));
          const hasRecordedWeight = topWeight > 0;
          const label = formatAppDate(log.performedAt, { month: "short", day: "numeric" });

          return {
            label,
            topWeight,
            topReps,
            topSeconds,
            hasRecordedWeight,
            detailLines: entry.sets.map((set, index) => {
              const weightPart = set.weightLb && set.weightLb > 0 ? `${set.weightLb.toFixed(1)} lb` : null;
              const repsPart = set.reps && set.reps > 0 ? `${set.reps} reps` : null;
              const secondsPart = set.seconds && set.seconds > 0 ? formatSecondsShort(set.seconds) : null;
              const parts = [weightPart, repsPart, secondsPart].filter(Boolean);
              return `Set ${index + 1}: ${parts.length > 0 ? parts.join(" | ") : "No metric recorded"}`;
            }),
          };
        })
    );

    const useWeightMetric = routineExercise.exercise.supportsWeight && sessionRows.some((row) => row.hasRecordedWeight);
    const useTimeMetric = !useWeightMetric && routineExercise.exercise.unit === "TIME";

    return {
      exercise: routineExercise.exercise,
      metricLabel: useWeightMetric ? "Top weight" : useTimeMetric ? "Top time" : "Top reps",
      unit: useWeightMetric ? "lb" : useTimeMetric ? "sec" : "",
      decimals: useWeightMetric ? 1 : 0,
      yLabel: useWeightMetric ? "Weight" : useTimeMetric ? "Time" : "Reps",
      title: useWeightMetric
        ? `${routineExercise.exercise.name}: Top Weight per Session`
        : useTimeMetric
        ? `${routineExercise.exercise.name}: Top Time per Session`
        : `${routineExercise.exercise.name}: Top Reps per Session`,
      points: sessionRows.map((row) => ({
        label: row.label,
        value: useWeightMetric ? row.topWeight : useTimeMetric ? row.topSeconds : row.topReps,
        detailLines: row.detailLines,
      })),
    };
  }).filter((entry) => entry.points.length > 0);

  // Per-exercise per-session charts (workout routines) — aligned to the shared last-8 timeline.
  // Every chart uses the same x-axis (all sessions in last8Logs). If an exercise wasn't done
  // in a particular session, a skipped point is emitted so dates stay aligned across charts.
  const routineExerciseSessionData = kind === "WORKOUT"
    ? routine.exercises.map((routineExercise) => {
        const exercise = routineExercise.exercise;
        // Fall back to reps if the exercise supports weight but none has been recorded
        const anyWeightRecorded = last8Logs.some((log) =>
          log.exercises
            .filter((e) => e.exerciseId === exercise.id)
            .some((e) => e.sets.some((s) => (s.weightLb ?? 0) > 0))
        );
        const isWeighted = exercise.supportsWeight && anyWeightRecorded;
        const isTime = !isWeighted && exercise.unit === "TIME";

        const points = last8Logs.map((log) => {
          const label = formatAppDate(log.performedAt, { month: "short", day: "numeric" });
          const entry = log.exercises.find((e) => e.exerciseId === exercise.id);
          if (!entry || entry.sets.length === 0) {
            return { label, value: 0, skipped: true as const };
          }

          const value = isWeighted
            ? entry.sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightLb ?? 0), 0)
            : isTime
            ? entry.sets.reduce((sum, set) => sum + (set.seconds ?? 0), 0)
            : entry.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);

          const detailLines = entry.sets.map((set, idx) => {
            if (isWeighted) {
              const w = set.weightLb && set.weightLb > 0 ? `${set.weightLb.toFixed(1)} lb` : null;
              const r = set.reps && set.reps > 0 ? `${set.reps} reps` : null;
              return `Set ${idx + 1}: ${[w, r].filter(Boolean).join(" × ") || "—"}`;
            }
            if (isTime) return `Set ${idx + 1}: ${formatSecondsShort(set.seconds ?? 0)}`;
            return `Set ${idx + 1}: ${set.reps ?? 0} reps`;
          });

          return { label, value, detailLines, skipped: false as const };
        });

        // Skip exercise if it was never done in any of these sessions
        if (points.every((p) => p.skipped)) return null;
        // Skip exercise if all actual values are 0
        if (points.filter((p) => !p.skipped).every((p) => p.value === 0)) return null;

        return {
          exercise,
          points,
          title: isWeighted
            ? `${exercise.name}: Volume per Session`
            : isTime
            ? `${exercise.name}: Time per Session`
            : `${exercise.name}: Reps per Session`,
          yLabel: isWeighted ? "Volume" : isTime ? "Time" : "Reps",
          unit: isWeighted ? "lb" : "",
          decimals: 0,
          format: isTime ? "duration" as const : undefined,
          omitTotal: isTime,
        };
      }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];

  const overviewSecondaryChart =
    kind === "CARDIO" ? (
      <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={cardioWorkload.distance} unit="mi" decimals={2} targetValue={weeklyDistanceGoalLine?.targetValue} targetLabel={weeklyDistanceGoalLine?.label} targetUnit={weeklyDistanceGoalLine?.unit} targetDecimals={weeklyDistanceGoalLine?.decimals} />
    ) : kind === "WORKOUT" ? (
      routineExerciseSessionData.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {routineExerciseSessionData.slice(0, 4).map((entry) => (
            <MetricLineChart key={entry.exercise.id} title={entry.title} yLabel={entry.yLabel} xLabel="Session" points={entry.points} unit={entry.unit} decimals={entry.decimals} format={entry.format} omitTotal={entry.omitTotal} compact />
          ))}
        </div>
      ) : (
        <MetricLineChart title={`${targetLabel}: Volume per Week`} yLabel="Volume" xLabel="Week" points={workoutWorkload.volume} decimals={0} targetValue={volumeGoalLine?.targetValue} targetLabel={volumeGoalLine?.label} targetUnit={volumeGoalLine?.unit} targetDecimals={volumeGoalLine?.decimals} />
      )
    ) : (
      <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} format="duration" omitTotal targetValue={durationGoalLine?.targetValue} targetLabel={durationGoalLine?.label} targetUnit={durationGoalLine?.unit} targetDecimals={durationGoalLine?.decimals} />
    );

  const performanceContent =
    logs.length === 0 ? (
      <EmptyState message="No routine logs in this range." />
    ) : kind === "CARDIO" ? (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Distance per Session`} yLabel="Distance" xLabel="Session" points={cardioPerf.distancePoints} unit="mi" decimals={2} targetValue={sessionDistanceGoalLine?.targetValue} targetLabel={sessionDistanceGoalLine?.label} targetUnit={sessionDistanceGoalLine?.unit} targetDecimals={sessionDistanceGoalLine?.decimals} />
        <MetricLineChart title={`${targetLabel}: Elevation per Session`} yLabel="Elevation" xLabel="Session" points={cardioPerf.elevationPoints} unit="ft" decimals={0} targetValue={sessionElevationGoalLine?.targetValue} targetLabel={sessionElevationGoalLine?.label} targetUnit={sessionElevationGoalLine?.unit} targetDecimals={sessionElevationGoalLine?.decimals} />
        <MetricLineChart title={`${targetLabel}: Pace per Session`} yLabel="Pace" xLabel="Session" points={cardioPerf.pacePoints} unit="sec/mi" decimals={0} />
      </div>
    ) : kind === "WORKOUT" ? (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Volume per Session`} yLabel="Volume" xLabel="Session" points={workoutPerf.totalVolume} decimals={0} />
        {routineExercisePerformance.map((entry) => (
          <MetricLineChart
            key={entry.exercise.id}
            title={entry.title}
            yLabel={entry.yLabel}
            xLabel="Session"
            points={entry.points}
            unit={entry.unit}
            decimals={entry.decimals}
            valueLabel={entry.metricLabel}
          />
        ))}
      </div>
    ) : (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart
          title={`${targetLabel}: Duration per Session`}
          yLabel="Duration"
          xLabel="Session"
          points={logs.map((log) => ({
            label: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(log.performedAt),
            value: log.durationSec ?? 0,
          }))}
          unit="sec"
          decimals={0}
          format="duration"
          omitTotal
        />
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
    );

  const workloadContent =
    logs.length === 0 ? (
      <EmptyState message="No routine logs in this range." />
    ) : kind === "CARDIO" ? (
        <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={cardioWorkload.sessions} decimals={0} targetValue={completionGoalLine?.targetValue} targetLabel={completionGoalLine?.label} targetUnit={completionGoalLine?.unit} targetDecimals={completionGoalLine?.decimals} />
        <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={cardioWorkload.distance} unit="mi" decimals={2} targetValue={weeklyDistanceGoalLine?.targetValue} targetLabel={weeklyDistanceGoalLine?.label} targetUnit={weeklyDistanceGoalLine?.unit} targetDecimals={weeklyDistanceGoalLine?.decimals} />
        <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={cardioWorkload.duration} unit="sec" decimals={0} format="duration" omitTotal targetValue={durationGoalLine?.targetValue} targetLabel={durationGoalLine?.label} targetUnit={durationGoalLine?.unit} targetDecimals={durationGoalLine?.decimals} />
        <MetricLineChart title={`${targetLabel}: Elevation per Week`} yLabel="Elevation" xLabel="Week" points={cardioWorkload.elevation} unit="ft" decimals={0} targetValue={weeklyElevationGoalLine?.targetValue} targetLabel={weeklyElevationGoalLine?.label} targetUnit={weeklyElevationGoalLine?.unit} targetDecimals={weeklyElevationGoalLine?.decimals} />
      </div>
    ) : kind === "WORKOUT" ? (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Sets per Week`} yLabel="Sets" xLabel="Week" points={workoutWorkload.sets} decimals={0} targetValue={setsGoalLine?.targetValue} targetLabel={setsGoalLine?.label} targetUnit={setsGoalLine?.unit} targetDecimals={setsGoalLine?.decimals} />
        <MetricLineChart title={`${targetLabel}: Reps per Week`} yLabel="Reps" xLabel="Week" points={workoutWorkload.reps} decimals={0} targetValue={repsGoalLine?.targetValue} targetLabel={repsGoalLine?.label} targetUnit={repsGoalLine?.unit} targetDecimals={repsGoalLine?.decimals} />
        <MetricLineChart title={`${targetLabel}: Volume per Week`} yLabel="Volume" xLabel="Week" points={workoutWorkload.volume} decimals={0} targetValue={volumeGoalLine?.targetValue} targetLabel={volumeGoalLine?.label} targetUnit={volumeGoalLine?.unit} targetDecimals={volumeGoalLine?.decimals} />
        {routineExerciseSessionData.map((entry) => (
          <MetricLineChart key={entry.exercise.id} title={entry.title} yLabel={entry.yLabel} xLabel="Session" points={entry.points} unit={entry.unit} decimals={entry.decimals} format={entry.format} omitTotal={entry.omitTotal} />
        ))}
      </div>
    ) : (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={durationWorkload.sessions} decimals={0} targetValue={completionGoalLine?.targetValue} targetLabel={completionGoalLine?.label} targetUnit={completionGoalLine?.unit} targetDecimals={completionGoalLine?.decimals} />
        <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} format="duration" omitTotal targetValue={durationGoalLine?.targetValue} targetLabel={durationGoalLine?.label} targetUnit={durationGoalLine?.unit} targetDecimals={durationGoalLine?.decimals} />
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
    );

  return (
    <>
      <TargetHeader
        section="routines"
        title={routine.name}
        subtitle={routineSubtitle(routine)}
        eyebrow={
          kind === "WORKOUT" ? "Workout Routine"
          : kind === "CARDIO" ? "Cardio Routine"
          : kind === "COMPLETION" ? "Completion Routine"
          : kind === "GUIDED" ? "Guided Routine"
          : kind === "SESSION" ? "Session Routine"
          : "Routine"
        }
        basePath={`/progress/routines/${routine.id}`}
        tab={tab}
        range={range}
        availableTabs={availableTabs}
        actions={<SectionLinkButton href="/progress?section=routines" label="Back to Routines" />}
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
        <SectionCard title="Overview Snapshot">
          <StatGrid
            items={[
              { label: "Range", value: rangeChipLabel(range) },
              { label: "Sessions", value: String(summary.sessions) },
              { label: "YTD sessions", value: String(ytdCount) },
              { label: "Target", value: frequencySummary.summaryLabel },
              {
                label: "Status",
                value: frequencySummary.shortStatusLabel,
                accent: frequencySummary.status === "behind"
                  ? "rgba(251,113,133,0.95)"
                  : frequencySummary.status === "ahead" || frequencySummary.status === "on_track"
                  ? "rgba(84,203,130,0.95)"
                  : undefined,
              },
              { label: "Last completed", value: lastCompletedLabel },
              { label: "Total duration", value: formatDuration(summary.totalDurationSec) },
            ]}
          />
          <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.78 }}>{frequencySummary.detailLabel}</div>
          {routine.metadataGroups.length > 0 || routine.tagAssignments.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {routine.metadataGroups.map((entry) => (
                <span key={entry.group.id} style={chip}>
                  {entry.group.label}
                </span>
              ))}
              {routine.tagAssignments.map((entry) => (
                <span key={entry.tag.id} style={chip}>
                  #{entry.tag.name}
                </span>
              ))}
              {routine.sessionDetails?.template ? (
                <span style={chip}>Template: {routine.sessionDetails.template.name}</span>
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        {tab === "overview" ? (
          <>
            <SectionCard title="Completion Trend">
              {logs.length === 0 ? (
                <EmptyState message="No routine logs in this range." />
              ) : (
                <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={completionSeries} decimals={0} targetValue={completionGoalLine?.targetValue} targetLabel={completionGoalLine?.label} targetUnit={completionGoalLine?.unit} targetDecimals={completionGoalLine?.decimals} />
              )}
            </SectionCard>
            <SectionCard title={kind === "CARDIO" ? "Workload Snapshot" : kind === "WORKOUT" ? "Workload Snapshot" : "Session Snapshot"}>
              {logs.length === 0 ? <EmptyState message="No routine logs in this range." /> : overviewSecondaryChart}
            </SectionCard>
          </>
        ) : null}

        {tab === "completion" ? <SectionCard title="Completion">{logs.length === 0 ? <EmptyState message="No routine logs in this range." /> : <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={completionSeries} decimals={0} targetValue={completionGoalLine?.targetValue} targetLabel={completionGoalLine?.label} targetUnit={completionGoalLine?.unit} targetDecimals={completionGoalLine?.decimals} />}</SectionCard> : null}
        {tab === "performance" ? <SectionCard title="Performance">{performanceContent}</SectionCard> : null}
        {tab === "workload" ? <SectionCard title="Workload">{workloadContent}</SectionCard> : null}

        {kind === "WORKOUT" && routine.exercises.length > 0 ? (
          <SectionCard title="Jump to Exercises">
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {routine.exercises.map((entry) => (
                <TargetCard
                  key={entry.exercise.id}
                  href={`/progress/exercises/${entry.exercise.id}?tab=overview&range=${range}`}
                  title={entry.exercise.name}
                  subtitle={
                    entry.exercise.supportsWeight
                      ? "Weighted strength exercise"
                      : entry.exercise.unit === "TIME"
                      ? "Time-based exercise"
                      : "Bodyweight exercise"
                  }
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        {kind === "CARDIO" && logs.length > 0 ? (
          <SectionCard title="Cardio Snapshot">
            <StatGrid
              items={[
                { label: "Total distance", value: `${summary.totalDistance.toFixed(1)} mi` },
                { label: "Elevation gain", value: `${summary.totalElevationGainFt.toFixed(0)} ft` },
                { label: "Avg pace", value: formatPace(summary.totalDistance > 0 ? summary.totalDurationSec / summary.totalDistance : null) },
                { label: "Last session", value: lastCompletedLabel },
              ]}
            />
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}

const chip: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  background: "rgba(128,128,128,0.08)",
};
