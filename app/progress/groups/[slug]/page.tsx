import MetricLineChart from "../../MetricLineChart";
import { cardioPerformanceSeries, cardioWorkloadSeries, durationWeeklySeries, groupTargetType, resolveGroupTarget, summarizeRoutineLogs, workoutSessionSeries, workoutWeeklySeries } from "../../data";
import { EmptyState, PillNav, SectionCard, SectionLinkButton, StatGrid, TabHint } from "../../ui";
import { getRangeFromSearchParam, normalizeProgressTab, progressRanges, progressSections, progressTabs, rangeChipLabel } from "@/lib/progress-v2";
import { formatDuration, formatPace } from "@/lib/progress";

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function GroupTargetPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const tab = normalizeProgressTab(getParam(searchParams, "tab"));
  const range = getRangeFromSearchParam(getParam(searchParams, "range"));

  const target = await resolveGroupTarget(params.slug, range);
  if (!target) return <div style={{ padding: 20 }}>Group not found.</div>;

  const summary = summarizeRoutineLogs(target.logs, null);
  const targetType = groupTargetType(target.logs);
  const cardioPerf = cardioPerformanceSeries(target.logs);
  const cardioWorkload = cardioWorkloadSeries(target.logs, range);
  const workoutPerf = workoutSessionSeries(target.logs);
  const workoutWorkload = workoutWeeklySeries(target.logs, range);
  const durationWorkload = durationWeeklySeries(target.logs, range);

  const overviewSecondary =
    targetType === "cardio" ? (
      <MetricLineChart title="Distance per Week" yLabel="Distance" xLabel="Week" points={cardioWorkload.distance} unit="mi" decimals={2} />
    ) : targetType === "workout" ? (
      <MetricLineChart title="Volume per Week" yLabel="Volume" xLabel="Week" points={workoutWorkload.volume} decimals={0} />
    ) : (
      <MetricLineChart title="Duration per Week" yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} />
    );

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{target.group.label}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Group rollup | {target.group.kind.replaceAll("_", " ")}
          </div>
        </div>
        <SectionLinkButton href="/progress/groups" label="Back to Groups" />
      </div>

      <PillNav items={progressSections().map((item) => ({ ...item, active: item.key === "groups" }))} />
      <PillNav items={progressTabs(`/progress/groups/${target.group.slug}`, range).map((item) => ({ ...item, active: item.key === tab }))} />
      <PillNav items={progressRanges(`/progress/groups/${target.group.slug}`, tab).map((item) => ({ ...item, active: item.key === range }))} />
      <TabHint tab={tab} />

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        <SectionCard title="Overview Snapshot">
          <StatGrid
            items={[
              { label: "Range", value: rangeChipLabel(range) },
              { label: "Sessions", value: String(summary.sessions) },
              { label: "YTD sessions", value: String(summary.ytd) },
              { label: "Routines", value: String(target.routineIds.length) },
              { label: "Exercises", value: String(target.exerciseIds.length) },
              { label: targetType === "cardio" ? "Avg pace" : "Total duration", value: targetType === "cardio" ? formatPace(summary.totalDistance > 0 ? summary.totalDurationSec / summary.totalDistance : null) : formatDuration(summary.totalDurationSec) },
            ]}
          />
        </SectionCard>

        {tab === "overview" ? (
          <>
            <SectionCard title="Completion / Consistency">
              {target.logs.length === 0 ? <EmptyState message="No activity in this group for the selected range." /> : <MetricLineChart title="Sessions per Week" yLabel="Sessions" xLabel="Week" points={cardioWorkload.sessions} decimals={0} />}
            </SectionCard>
            <SectionCard title={targetType === "mixed" ? "Workload Snapshot" : "Primary Trend"}>
              {target.logs.length === 0 ? <EmptyState message="No activity in this group for the selected range." /> : overviewSecondary}
            </SectionCard>
            {targetType === "cardio" ? (
              <SectionCard title="Performance Snapshot">
                <MetricLineChart title="Pace per Session" yLabel="Pace" xLabel="Session" points={cardioPerf.pacePoints} unit="sec/mi" decimals={0} />
              </SectionCard>
            ) : null}
          </>
        ) : null}

        {tab === "completion" ? (
          <SectionCard title="Completion">
            {target.logs.length === 0 ? <EmptyState message="No activity in this group for the selected range." /> : <MetricLineChart title="Sessions per Week" yLabel="Sessions" xLabel="Week" points={cardioWorkload.sessions} decimals={0} />}
          </SectionCard>
        ) : null}

        {tab === "performance" ? (
          <SectionCard title="Performance">
            {target.logs.length === 0 ? (
              <EmptyState message="No activity in this group for the selected range." />
            ) : targetType === "cardio" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title="Distance per Session" yLabel="Distance" xLabel="Session" points={cardioPerf.distancePoints} unit="mi" decimals={2} />
                <MetricLineChart title="Pace per Session" yLabel="Pace" xLabel="Session" points={cardioPerf.pacePoints} unit="sec/mi" decimals={0} />
              </div>
            ) : targetType === "workout" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title="Volume per Session" yLabel="Volume" xLabel="Session" points={workoutPerf.totalVolume} decimals={0} />
                <MetricLineChart title="Reps per Session" yLabel="Reps" xLabel="Session" points={workoutPerf.totalReps} decimals={0} />
              </div>
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
                <MetricLineChart title="Sessions per Week" yLabel="Sessions" xLabel="Week" points={cardioWorkload.sessions} decimals={0} />
                <MetricLineChart title="Distance per Week" yLabel="Distance" xLabel="Week" points={cardioWorkload.distance} unit="mi" decimals={2} />
                <MetricLineChart title="Duration per Week" yLabel="Duration" xLabel="Week" points={cardioWorkload.duration} unit="sec" decimals={0} />
              </div>
            ) : targetType === "workout" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title="Sets per Week" yLabel="Sets" xLabel="Week" points={workoutWorkload.sets} decimals={0} />
                <MetricLineChart title="Reps per Week" yLabel="Reps" xLabel="Week" points={workoutWorkload.reps} decimals={0} />
                <MetricLineChart title="Volume per Week" yLabel="Volume" xLabel="Week" points={workoutWorkload.volume} decimals={0} />
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title="Sessions per Week" yLabel="Sessions" xLabel="Week" points={cardioWorkload.sessions} decimals={0} />
                <MetricLineChart title="Duration per Week" yLabel="Duration" xLabel="Week" points={durationWorkload.duration} unit="sec" decimals={0} />
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
