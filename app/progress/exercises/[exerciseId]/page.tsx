import MetricLineChart from "../../MetricLineChart";
import { getRoutineLogs } from "../../data";
import { EmptyState, PillNav, SectionCard, SectionLinkButton, StatGrid, TabHint } from "../../ui";
import { formatAppDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, getRangeFromSearchParam, incrementWeekMap, normalizeProgressTab, progressRanges, progressSections, progressTabs, rangeChipLabel, trendLabel } from "@/lib/progress-v2";

export const dynamic = "force-dynamic";

type Params = { exerciseId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 sec";
  const rounded = Math.round(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes <= 0) return `${seconds} sec`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export default async function ExerciseTargetPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const tab = normalizeProgressTab(getParam(searchParams, "tab"));
  const range = getRangeFromSearchParam(getParam(searchParams, "range"));
  const exerciseId = params.exerciseId;

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: {
      metadataGroups: {
        include: { group: true },
      },
    },
  });

  if (!exercise) return <div style={{ padding: 20 }}>Exercise not found.</div>;

  const isTimeExercise = exercise.unit === "TIME";

  const logs = await getRoutineLogs(range, { exerciseIds: [exercise.id] });
  const rows = logs.flatMap((log) =>
    log.exercises
      .filter((entry) => entry.exerciseId === exercise.id)
      .map((entry) => {
        const totalSets = entry.sets.length;
        const totalReps = entry.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
        const totalVolume = entry.sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightLb ?? 0), 0);
        const setSeconds = entry.sets.map((set) => set.seconds ?? 0);
        const totalSeconds = setSeconds.reduce((sum, value) => sum + value, 0);
        const avgSecondsPerSet = totalSets > 0 ? totalSeconds / totalSets : 0;
        const topMetric = isTimeExercise
          ? Math.max(0, ...setSeconds)
          : Math.max(0, ...entry.sets.map((set) => set.weightLb ?? 0));

        return {
          performedAt: log.performedAt,
          totalSets,
          totalReps,
          totalVolume,
          totalSeconds,
          avgSecondsPerSet,
          topMetric,
          setDurationLines: entry.sets.map((set, index) => `Set ${index + 1}: ${formatSeconds(set.seconds ?? 0)}`),
        };
      })
  );

  const performance = {
    topMetric: rows.map((row) => ({
      label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }),
      value: row.topMetric,
      detailLines: isTimeExercise ? row.setDurationLines : undefined,
    })),
    totalReps: rows.map((row) => ({ label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }), value: row.totalReps })),
    totalVolume: rows.map((row) => ({ label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }), value: row.totalVolume })),
    totalSets: rows.map((row) => ({ label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }), value: row.totalSets })),
    totalSeconds: rows.map((row) => ({
      label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }),
      value: row.totalSeconds,
      detailLines: row.setDurationLines,
    })),
    avgSecondsPerSet: rows.map((row) => ({
      label: formatAppDate(row.performedAt, { month: "short", day: "numeric" }),
      value: row.avgSecondsPerSet,
      detailLines: row.setDurationLines,
    })),
  };

  const weeklySetsMap = new Map<string, number>();
  const weeklyRepsMap = new Map<string, number>();
  const weeklyVolumeMap = new Map<string, number>();
  const weeklySecondsMap = new Map<string, number>();
  const sessionWeekMap = new Map<string, number>();
  for (const row of rows) {
    incrementWeekMap(sessionWeekMap, row.performedAt, 1);
    incrementWeekMap(weeklySetsMap, row.performedAt, row.totalSets);
    incrementWeekMap(weeklyRepsMap, row.performedAt, row.totalReps);
    incrementWeekMap(weeklyVolumeMap, row.performedAt, row.totalVolume);
    incrementWeekMap(weeklySecondsMap, row.performedAt, row.totalSeconds);
  }
  const workload = {
    sets: fillWeeklySeries(weeklySetsMap, range),
    reps: fillWeeklySeries(weeklyRepsMap, range),
    volume: fillWeeklySeries(weeklyVolumeMap, range),
    totalSeconds: fillWeeklySeries(weeklySecondsMap, range),
  };
  const completionSeries = fillWeeklySeries(sessionWeekMap, range);
  const trend = trendLabel(rows.map((row) => (isTimeExercise ? row.avgSecondsPerSet : row.topMetric)));
  const topSetValue = Math.max(0, ...rows.map((row) => row.topMetric));
  const averageTimePerSet =
    rows.reduce((sum, row) => sum + row.totalSeconds, 0) / Math.max(1, rows.reduce((sum, row) => sum + row.totalSets, 0));
  const topSetLabel = isTimeExercise ? formatSeconds(topSetValue) : `${topSetValue.toFixed(1)} lb`;
  const overviewPerfChart = (
    <MetricLineChart
      title={isTimeExercise ? "Average Time per Set" : "Top Set per Session"}
      yLabel={isTimeExercise ? "Time" : "Weight"}
      xLabel="Session"
      points={isTimeExercise ? performance.avgSecondsPerSet : performance.topMetric}
      unit={isTimeExercise ? "sec" : "lb"}
      decimals={isTimeExercise ? 0 : 1}
      valueLabel={isTimeExercise ? "Avg time/set" : undefined}
    />
  );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{exercise.name}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Exercise target | {exercise.unit}
            {exercise.supportsWeight ? " | Weighted" : ""}
          </div>
        </div>
        <SectionLinkButton href="/progress/exercises" label="Back to Exercises" />
      </div>

      <PillNav items={progressSections().map((item) => ({ ...item, active: item.key === "exercises" }))} />
      <PillNav items={progressTabs(`/progress/exercises/${exercise.id}`, range).map((item) => ({ ...item, active: item.key === tab }))} />
      <PillNav items={progressRanges(`/progress/exercises/${exercise.id}`, tab).map((item) => ({ ...item, active: item.key === range }))} />
      <TabHint tab={tab} />

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        <SectionCard title="Overview Snapshot">
          <StatGrid
            items={[
              { label: "Range", value: rangeChipLabel(range) },
              { label: isTimeExercise ? "Longest set" : "Top set", value: topSetLabel },
              { label: "Recent trend", value: trend },
              { label: isTimeExercise ? "Total time" : "Total volume", value: isTimeExercise ? formatSeconds(rows.reduce((sum, row) => sum + row.totalSeconds, 0)) : rows.reduce((sum, row) => sum + row.totalVolume, 0).toFixed(0) },
              { label: "Total sets", value: String(rows.reduce((sum, row) => sum + row.totalSets, 0)) },
              { label: isTimeExercise ? "Avg time / set" : "Total reps", value: isTimeExercise ? formatSeconds(averageTimePerSet) : String(rows.reduce((sum, row) => sum + row.totalReps, 0)) },
            ]}
          />
          {exercise.metadataGroups.length > 0 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {exercise.metadataGroups.map((entry) => (
                <span key={entry.group.id} style={chip}>
                  {entry.group.label}
                </span>
              ))}
            </div>
          ) : null}
        </SectionCard>

        {tab === "overview" ? (
          <>
            <SectionCard title="Performance Snapshot">
              {rows.length === 0 ? <EmptyState message="No exercise sessions in this range." /> : overviewPerfChart}
            </SectionCard>
            <SectionCard title="Workload Snapshot">
              {rows.length === 0 ? (
                <EmptyState message="No exercise sessions in this range." />
              ) : (
                <MetricLineChart
                  title={isTimeExercise ? "Total Time per Week" : "Total Volume per Week"}
                  yLabel={isTimeExercise ? "Time" : "Volume"}
                  xLabel="Week"
                  points={isTimeExercise ? workload.totalSeconds : workload.volume}
                  unit={isTimeExercise ? "sec" : ""}
                  decimals={0}
                />
              )}
            </SectionCard>
          </>
        ) : null}

        {tab === "completion" ? (
          <SectionCard title="Completion">
            {rows.length === 0 ? <EmptyState message="No exercise sessions in this range." /> : <MetricLineChart title="Sessions per Week" yLabel="Sessions" xLabel="Week" points={completionSeries} decimals={0} />}
          </SectionCard>
        ) : null}

        {tab === "performance" ? (
          <SectionCard title="Performance">
            {rows.length === 0 ? (
              <EmptyState message="No exercise sessions in this range." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {overviewPerfChart}
                {isTimeExercise ? (
                  <MetricLineChart
                    title="Total Time per Session"
                    yLabel="Time"
                    xLabel="Session"
                    points={performance.totalSeconds}
                    unit="sec"
                    decimals={0}
                  />
                ) : (
                  <>
                    <MetricLineChart title="Total Reps per Session" yLabel="Reps" xLabel="Session" points={performance.totalReps} decimals={0} />
                    <MetricLineChart title="Total Volume per Session" yLabel="Volume" xLabel="Session" points={performance.totalVolume} decimals={0} />
                  </>
                )}
              </div>
            )}
          </SectionCard>
        ) : null}

        {tab === "workload" ? (
          <SectionCard title="Workload">
            {rows.length === 0 ? (
              <EmptyState message="No exercise sessions in this range." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title="Total Sets per Week" yLabel="Sets" xLabel="Week" points={workload.sets} decimals={0} />
                {isTimeExercise ? (
                  <MetricLineChart title="Total Time per Week" yLabel="Time" xLabel="Week" points={workload.totalSeconds} unit="sec" decimals={0} />
                ) : (
                  <>
                    <MetricLineChart title="Total Reps per Week" yLabel="Reps" xLabel="Week" points={workload.reps} decimals={0} />
                    <MetricLineChart title="Total Volume per Week" yLabel="Volume" xLabel="Week" points={workload.volume} decimals={0} />
                  </>
                )}
              </div>
            )}
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
