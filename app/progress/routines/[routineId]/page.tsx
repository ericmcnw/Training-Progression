import MetricLineChart from "../../MetricLineChart";
import { cardioPerformanceSeries, cardioWorkloadSeries, durationWeeklySeries, getRoutineLogs, routineSubtitle, summarizeRoutineLogs, workoutSessionSeries, workoutWeeklySeries } from "../../data";
import { EmptyState, PillNav, SectionCard, SectionLinkButton, StatGrid, TabHint, TargetCard } from "../../ui";
import { formatAppDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, getRangeFromSearchParam, normalizeProgressTab, progressRanges, progressSections, progressTabs, rangeChipLabel } from "@/lib/progress-v2";
import { formatDuration, formatPace } from "@/lib/progress";

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
  const tab = normalizeProgressTab(getParam(searchParams, "tab"));
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
    },
  });

  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;

  const logs = (await getRoutineLogs(range, { routineIds: [routine.id] })).filter((log) => log.routineId === routine.id);
  const summary = summarizeRoutineLogs(logs, routine.timesPerWeek);
  const completionSeries = fillWeeklySeries(summary.sessionWeekMap, range);
  const cardioPerf = cardioPerformanceSeries(logs);
  const cardioWorkload = cardioWorkloadSeries(logs, range);
  const workoutPerf = workoutSessionSeries(logs);
  const workoutWorkload = workoutWeeklySeries(logs, range);
  const durationWorkload = durationWeeklySeries(logs, range);
  const kind = routine.kind;
  const targetLabel = routine.name;
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

  const overviewSecondaryChart =
    kind === "CARDIO" ? (
      <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={cardioWorkload.distance} unit="mi" decimals={2} />
    ) : kind === "WORKOUT" ? (
      <MetricLineChart title={`${targetLabel}: Volume per Week`} yLabel="Volume" xLabel="Week" points={workoutWorkload.volume} decimals={0} />
    ) : (
      <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} />
    );

  const performanceContent =
    logs.length === 0 ? (
      <EmptyState message="No routine logs in this range." />
    ) : kind === "CARDIO" ? (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Distance per Session`} yLabel="Distance" xLabel="Session" points={cardioPerf.distancePoints} unit="mi" decimals={2} />
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
      />
    );

  const workloadContent =
    logs.length === 0 ? (
      <EmptyState message="No routine logs in this range." />
    ) : kind === "CARDIO" ? (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={cardioWorkload.sessions} decimals={0} />
        <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={cardioWorkload.distance} unit="mi" decimals={2} />
        <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={cardioWorkload.duration} unit="sec" decimals={0} />
      </div>
    ) : kind === "WORKOUT" ? (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Sets per Week`} yLabel="Sets" xLabel="Week" points={workoutWorkload.sets} decimals={0} />
        <MetricLineChart title={`${targetLabel}: Reps per Week`} yLabel="Reps" xLabel="Week" points={workoutWorkload.reps} decimals={0} />
        <MetricLineChart title={`${targetLabel}: Volume per Week`} yLabel="Volume" xLabel="Week" points={workoutWorkload.volume} decimals={0} />
      </div>
    ) : (
      <div style={{ display: "grid", gap: 10 }}>
        <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={durationWorkload.sessions} decimals={0} />
        <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} />
      </div>
    );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{routine.name}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routineSubtitle(routine)}</div>
        </div>
        <SectionLinkButton href="/progress/routines" label="Back to Routines" />
      </div>

      <PillNav items={progressSections().map((item) => ({ ...item, active: item.key === "routines" }))} />
      <PillNav items={progressTabs(`/progress/routines/${routine.id}`, range).map((item) => ({ ...item, active: item.key === tab }))} />
      <PillNav items={progressRanges(`/progress/routines/${routine.id}`, tab).map((item) => ({ ...item, active: item.key === range }))} />
      <TabHint tab={tab} />

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        <SectionCard title="Overview Snapshot">
          <StatGrid
            items={[
              { label: "Range", value: rangeChipLabel(range) },
              { label: "Sessions", value: String(summary.sessions) },
              { label: "YTD sessions", value: String(summary.ytd) },
              { label: "Weeks goal met", value: String(summary.weeksGoalMet) },
              { label: "Last completed", value: lastCompletedLabel },
              { label: "Total duration", value: formatDuration(summary.totalDurationSec) },
            ]}
          />
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
            </div>
          ) : null}
        </SectionCard>

        {tab === "overview" ? (
          <>
            <SectionCard title="Completion Trend">
              {logs.length === 0 ? (
                <EmptyState message="No routine logs in this range." />
              ) : (
                <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={completionSeries} decimals={0} />
              )}
            </SectionCard>
            <SectionCard title={kind === "CARDIO" ? "Workload Snapshot" : kind === "WORKOUT" ? "Workload Snapshot" : "Session Snapshot"}>
              {logs.length === 0 ? <EmptyState message="No routine logs in this range." /> : overviewSecondaryChart}
            </SectionCard>
          </>
        ) : null}

        {tab === "completion" ? <SectionCard title="Completion">{logs.length === 0 ? <EmptyState message="No routine logs in this range." /> : <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={completionSeries} decimals={0} />}</SectionCard> : null}
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
                  subtitle="Exercise target"
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
                { label: "Avg pace", value: formatPace(summary.totalDistance > 0 ? summary.totalDurationSec / summary.totalDistance : null) },
                { label: "Last session", value: lastCompletedLabel },
              ]}
            />
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}

const chip: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  background: "rgba(128,128,128,0.08)",
};
