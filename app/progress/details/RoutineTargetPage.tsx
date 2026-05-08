import MetricLineChart from "../MetricLineChart";
import { cardioPerformanceSeries, cardioWorkloadSeries, durationWeeklySeries, getRoutineLogs, routineSubtitle, summarizeRoutineLogs, workoutSessionSeries, workoutWeeklySeries } from "../data";
import { EmptyState, SectionCard, SectionLinkButton, StatGrid, TargetCard, TargetHeader } from "../ui";
import { formatAppDate } from "@/lib/dates";
import { getChartGoalReference, getGoalsOverview, type GoalInsight } from "@/lib/goals";
import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, getRangeFromSearchParam, normalizeProgressTab, rangeChipLabel, resolveProgressTab, startOfYear, type ProgressTab } from "@/lib/progress-v2";
import { formatDuration, formatPace } from "@/lib/progress";
import { getRoutineFrequencyStatus, getRoutineTargetWindow, routineWithFrequencyTarget } from "@/lib/routine-frequency";
import { aggregateSessionMetricHistory, sessionMetricPerformanceSeries } from "@/lib/session-metrics";
import { withSessionMetricConfig } from "@/lib/session-templates";
import ActivityPulseStrip from "./ActivityPulseStrip";
import ActivityGoalsSection from "./ActivityGoalsSection";
import ActivityCoverageHeatmap from "./ActivityCoverageHeatmap";
import { buildStrengthPulse } from "./sport-pulse";
import { applyGoalsToPulseSlots } from "./pulse-goal-slots";
import { buildWeeklyGrid } from "./activity-coverage";

export const dynamic = "force-dynamic";

type Params = { routineId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Filters all active goals down to those that point at this routine: per-routine
 * goals (frequency or otherwise), exercise PRs on the routine's exercises, and
 * group-frequency goals whose linked routines include this one.
 */
async function getRoutineRelevantGoals(routineId: string, exerciseIds: string[]): Promise<GoalInsight[]> {
  const allInsights = await getGoalsOverview({ active: "active" });

  // Group-frequency goals carry a goal id like "group-frequency:<freqGoalId>".
  // Their routine list lives on FrequencyGoalRoutine — fetch it once.
  const groupFreqGoalIds = allInsights
    .filter((insight) => insight.goal.id.startsWith("group-frequency:"))
    .map((insight) => insight.goal.id.replace("group-frequency:", ""));
  const includedGroupFreqGoals = new Set<string>();
  if (groupFreqGoalIds.length > 0) {
    const links = await prisma.frequencyGoalRoutine.findMany({
      where: { goalId: { in: groupFreqGoalIds }, routineId },
      select: { goalId: true },
    });
    for (const link of links) includedGroupFreqGoals.add(`group-frequency:${link.goalId}`);
  }

  const exerciseIdSet = new Set(exerciseIds);

  return allInsights.filter((insight) => {
    const goal = insight.goal;
    if (goal.id.startsWith("group-frequency:")) {
      return includedGroupFreqGoals.has(goal.id);
    }
    if (goal.targetType === "ROUTINE" && goal.targetId === routineId) return true;
    if (goal.targetType === "EXERCISE" && exerciseIdSet.has(goal.targetId)) return true;
    return false;
  });
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

  const rawRoutine = await prisma.routine.findUnique({
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
      frequencyGoalRoutines: {
        include: { goal: true },
      },
    },
  });

  if (!rawRoutine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  const routine = routineWithFrequencyTarget(rawRoutine);
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

  // ── Pulse strip + goals + heatmap (WORKOUT only) ──────────────────────────
  // For strength routines, prepend the same hero treatment used by the activity
  // worlds so per-routine progress feels as concrete as per-activity progress.
  let strengthPulseSlots: ReturnType<typeof buildStrengthPulse> | null = null;
  let routineHeatmapWeeks: ReturnType<typeof buildWeeklyGrid> = [];
  let routineGoals: GoalInsight[] = [];

  if (kind === "WORKOUT") {
    const routineExerciseIds = routine.exercises.map((re) => re.exercise.id);

    // All-time per-routine session data, with sets — for streak, PR detection,
    // weekly bucketing. Slim select; range-filtered `logs` covers the charts.
    const [allTimeLogs, fetchedGoals] = await Promise.all([
      prisma.routineLog.findMany({
        where: { routineId: routine.id },
        orderBy: { performedAt: "desc" },
        select: {
          id: true,
          performedAt: true,
          exercises: {
            select: {
              exercise: { select: { name: true } },
              sets: { select: { weightLb: true, reps: true } },
            },
          },
        },
      }),
      getRoutineRelevantGoals(routine.id, routineExerciseIds),
    ]);
    routineGoals = fetchedGoals;

    const now = new Date();
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let thisWeekSets = 0;
    let lastWeekSets = 0;
    let thisWeekSessions = 0;

    let allTimePRSet: { exerciseName: string; weight: number; reps: number } | null = null;
    let recentPRSet: { exerciseName: string; weight: number; reps: number; date: Date } | null = null;
    // Per-exercise running max in chronological order to detect PRs over time.
    const exerciseChronoLogs = new Map<string, Array<{ date: Date; topWeight: number; topReps: number }>>();

    const sessionsAsc = [...allTimeLogs].reverse(); // chronological

    for (const log of sessionsAsc) {
      let logSets = 0;
      let logTopSet: { exerciseName: string; weight: number; reps: number } | null = null;
      for (const ex of log.exercises) {
        let exTopWeight = 0;
        let exTopReps = 0;
        for (const set of ex.sets) {
          const w = set.weightLb ?? 0;
          const r = set.reps ?? 0;
          if (w <= 0 && r <= 0) continue;
          logSets += 1;
          if (w > exTopWeight) {
            exTopWeight = w;
            exTopReps = r;
          }
          if (w > 0 && (!logTopSet || w > logTopSet.weight)) {
            logTopSet = { exerciseName: ex.exercise.name, weight: w, reps: r };
          }
        }
        if (exTopWeight > 0) {
          const list = exerciseChronoLogs.get(ex.exercise.name) ?? [];
          list.push({ date: log.performedAt, topWeight: exTopWeight, topReps: exTopReps });
          exerciseChronoLogs.set(ex.exercise.name, list);
        }
      }

      if (log.performedAt >= thisWeekStart) {
        thisWeekSets += logSets;
        thisWeekSessions += 1;
      } else if (log.performedAt >= lastWeekStart) {
        lastWeekSets += logSets;
      }

      if (logTopSet && (!allTimePRSet || logTopSet.weight > allTimePRSet.weight)) {
        allTimePRSet = logTopSet;
      }
    }

    // Recent PR detection — find the most recent session in last 30d where any
    // exercise's top weight exceeded all prior records for that exercise.
    for (const [exerciseName, history] of exerciseChronoLogs) {
      let priorMax = 0;
      for (const point of history) {
        if (point.date >= thirtyDaysAgo && point.topWeight > priorMax) {
          if (!recentPRSet || point.date > recentPRSet.date) {
            recentPRSet = {
              exerciseName,
              weight: point.topWeight,
              reps: point.topReps,
              date: point.date,
            };
          }
        }
        priorMax = Math.max(priorMax, point.topWeight);
      }
    }

    const sessionDates = sessionsAsc.map((log) => log.performedAt);
    const defaultSlots = buildStrengthPulse(
      {
        sessionDates,
        thisWeekSets,
        lastWeekSets,
        thisWeekSessions,
        recentPR: recentPRSet,
        allTimePR: allTimePRSet,
      },
      now
    );
    strengthPulseSlots = applyGoalsToPulseSlots(defaultSlots, routineGoals);

    routineHeatmapWeeks = buildWeeklyGrid(
      allTimeLogs.map((log) => ({
        id: log.id,
        routineId: routine.id,
        performedAt: log.performedAt,
        routineName: routine.name,
      })),
      [],
      now
    );
  }

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
        {kind === "WORKOUT" && strengthPulseSlots ? (
          <ActivityPulseStrip slots={strengthPulseSlots} />
        ) : null}

        {kind === "WORKOUT" ? (
          <ActivityGoalsSection
            goals={routineGoals}
            activitySlug={`routine-${routine.id}`}
            activityLabel={routine.name}
          />
        ) : null}

        {kind === "WORKOUT" && routineHeatmapWeeks.length > 1 ? (
          <SectionCard
            title="Activity Coverage"
            subtitle={`Sessions of "${routine.name}" over the last 52 weeks. Tap any week to see details.`}
          >
            <ActivityCoverageHeatmap
              weeks={routineHeatmapWeeks}
              sessionLabel="Session"
              sessionRowLabel="Sessions"
              hideTrainingRow
            />
          </SectionCard>
        ) : null}

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
