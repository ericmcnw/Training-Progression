import MetricLineChart from "../../MetricLineChart";
import { exerciseSessionSeries, exerciseWeeklySeries, getRoutineLogs } from "../../data";
import { EmptyState, PillNav, SectionCard, SectionLinkButton, StatGrid, TabHint } from "../../ui";
import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, getRangeFromSearchParam, incrementWeekMap, normalizeProgressTab, progressRanges, progressSections, progressTabs, rangeChipLabel, trendLabel } from "@/lib/progress-v2";

export const dynamic = "force-dynamic";

type Params = { exerciseId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
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

  const logs = await getRoutineLogs(range, { exerciseIds: [exercise.id] });
  const rows = logs.flatMap((log) =>
    log.exercises
      .filter((entry) => entry.exerciseId === exercise.id)
      .map((entry) => {
        const totalSets = entry.sets.length;
        const totalReps = entry.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
        const totalVolume = entry.sets.reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightLb ?? 0), 0);
        const topMetric =
          exercise.unit === "TIME" && !exercise.supportsWeight
            ? Math.max(0, ...entry.sets.map((set) => set.seconds ?? 0))
            : Math.max(0, ...entry.sets.map((set) => set.weightLb ?? 0));
        return { performedAt: log.performedAt, totalSets, totalReps, totalVolume, topWeight: topMetric };
      })
  );

  const performance = exerciseSessionSeries(rows);
  const workload = exerciseWeeklySeries(rows, range);
  const sessionWeekMap = new Map<string, number>();
  for (const row of rows) incrementWeekMap(sessionWeekMap, row.performedAt, 1);
  const completionSeries = fillWeeklySeries(sessionWeekMap, range);
  const trend = trendLabel(rows.map((row) => row.topWeight));
  const topSetLabel = `${Math.max(0, ...rows.map((row) => row.topWeight)).toFixed(exercise.unit === "TIME" && !exercise.supportsWeight ? 0 : 1)} ${exercise.unit === "TIME" && !exercise.supportsWeight ? "sec" : "lb"}`;
  const overviewPerfChart = (
    <MetricLineChart
      title={exercise.unit === "TIME" && !exercise.supportsWeight ? "Best Time per Session" : "Top Set per Session"}
      yLabel={exercise.unit === "TIME" && !exercise.supportsWeight ? "Time" : "Weight"}
      xLabel="Session"
      points={performance.topWeight}
      unit={exercise.unit === "TIME" && !exercise.supportsWeight ? "sec" : "lb"}
      decimals={exercise.unit === "TIME" && !exercise.supportsWeight ? 0 : 1}
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
              { label: "Top set", value: topSetLabel },
              { label: "Recent trend", value: trend },
              { label: "Total volume", value: rows.reduce((sum, row) => sum + row.totalVolume, 0).toFixed(0) },
              { label: "Total sets", value: String(rows.reduce((sum, row) => sum + row.totalSets, 0)) },
              { label: "Total reps", value: String(rows.reduce((sum, row) => sum + row.totalReps, 0)) },
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
                <MetricLineChart title="Total Volume per Week" yLabel="Volume" xLabel="Week" points={workload.volume} decimals={0} />
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
                <MetricLineChart title="Total Reps per Session" yLabel="Reps" xLabel="Session" points={performance.totalReps} decimals={0} />
                <MetricLineChart title="Total Volume per Session" yLabel="Volume" xLabel="Session" points={performance.totalVolume} decimals={0} />
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
                <MetricLineChart title="Total Reps per Week" yLabel="Reps" xLabel="Week" points={workload.reps} decimals={0} />
                <MetricLineChart title="Total Volume per Week" yLabel="Volume" xLabel="Week" points={workload.volume} decimals={0} />
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
