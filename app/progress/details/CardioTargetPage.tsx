import MetricLineChart from "../MetricLineChart";
import { cardioPerformanceSeries, cardioWorkloadSeries, resolveGroupTarget, summarizeRoutineLogs } from "../data";
import { EmptyState, SectionCard, SectionLinkButton, StatGrid, TargetHeader } from "../ui";
import { getChartGoalReference } from "@/lib/goals";
import { getRangeFromSearchParam, normalizeProgressTab, rangeChipLabel, resolveProgressTab } from "@/lib/progress-v2";
import { formatDuration, formatPace } from "@/lib/progress";
const fmtDuration = (sec: number) => formatDuration(Math.round(sec));

export const dynamic = "force-dynamic";

type Params = { slug: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function CardioTargetPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const requestedTab = normalizeProgressTab(getParam(searchParams, "tab"));
  const range = getRangeFromSearchParam(getParam(searchParams, "range"));
  const tab = resolveProgressTab(requestedTab);

  const target = await resolveGroupTarget(params.slug, range);
  if (!target || target.group.kind !== "CARDIO_ACTIVITY") {
    return <div style={{ padding: 20 }}>Cardio target not found.</div>;
  }

  const [sessionsGoalLine, weeklyDistanceGoalLine, durationGoalLine, paceGoalLine, sessionDistanceGoalLine, weeklyElevationGoalLine, sessionElevationGoalLine] = await Promise.all([
    getChartGoalReference({
      candidates: [
        { targetType: "CARDIO", targetId: target.group.id },
        { targetType: "GROUP", targetId: target.group.id },
      ],
      metricType: "SESSIONS",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [
        { targetType: "CARDIO", targetId: target.group.id },
        { targetType: "GROUP", targetId: target.group.id },
      ],
      metricType: "DISTANCE",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [
        { targetType: "CARDIO", targetId: target.group.id },
        { targetType: "GROUP", targetId: target.group.id },
      ],
      metricType: "DURATION",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "CARDIO", targetId: target.group.id }],
      metricType: "PACE",
      timeframe: "ONE_TIME",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "CARDIO", targetId: target.group.id }],
      metricType: "DISTANCE",
      timeframe: "ONE_TIME",
    }),
    getChartGoalReference({
      candidates: [
        { targetType: "CARDIO", targetId: target.group.id },
        { targetType: "GROUP", targetId: target.group.id },
      ],
      metricType: "ELEVATION_GAIN",
      timeframe: "WEEK",
    }),
    getChartGoalReference({
      candidates: [{ targetType: "CARDIO", targetId: target.group.id }],
      metricType: "ELEVATION_GAIN",
      timeframe: "ONE_TIME",
    }),
  ]);

  const summary = summarizeRoutineLogs(target.logs, null);
  const performance = cardioPerformanceSeries(target.logs);
  const workload = cardioWorkloadSeries(target.logs, range);
  const targetLabel = target.group.label;

  return (
    <>
      <TargetHeader
        section="cardio"
        title={target.group.label}
        eyebrow="Cardio Activity"
        subtitle={`Distance, pace, elevation, and session frequency for ${target.group.label.toLowerCase()}.`}
        basePath={`/progress/cardio/${target.group.slug}`}
        tab={tab}
        range={range}
        actions={<SectionLinkButton href="/progress?section=cardio" label="Back to Cardio" />}
      />

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 14px 20px", display: "grid", gap: 16 }}>
        <SectionCard title="Overview Snapshot">
          <StatGrid
            items={[
              { label: "Range", value: rangeChipLabel(range) },
              { label: "Sessions", value: String(summary.sessions) },
              { label: "YTD sessions", value: String(summary.ytd) },
              { label: "Total distance", value: `${summary.totalDistance.toFixed(1)} mi` },
              { label: "Total duration", value: formatDuration(summary.totalDurationSec) },
              { label: "Elevation gain", value: `${summary.totalElevationGainFt.toFixed(0)} ft` },
              { label: "Avg pace", value: formatPace(summary.totalDistance > 0 ? summary.totalDurationSec / summary.totalDistance : null) },
            ]}
          />
        </SectionCard>

        {tab === "overview" ? (
          <>
            <SectionCard title="Workload Snapshot">
              {target.logs.length === 0 ? (
                <EmptyState message="No cardio logs in this range." />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <MetricLineChart title={`${targetLabel}: Distance per Session`} yLabel="Distance" xLabel="Session" points={performance.distancePoints} unit="mi" decimals={2} targetValue={sessionDistanceGoalLine?.targetValue} targetLabel={sessionDistanceGoalLine?.label} targetUnit={sessionDistanceGoalLine?.unit} targetDecimals={sessionDistanceGoalLine?.decimals} />
                  <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={workload.distance} unit="mi" decimals={2} targetValue={weeklyDistanceGoalLine?.targetValue} targetLabel={weeklyDistanceGoalLine?.label} targetUnit={weeklyDistanceGoalLine?.unit} targetDecimals={weeklyDistanceGoalLine?.decimals} compact />
                </div>
              )}
            </SectionCard>
            <SectionCard title="Performance Snapshot">
              {target.logs.length === 0 ? (
                <EmptyState message="No cardio logs in this range." />
              ) : (
                <MetricLineChart title={`${targetLabel}: Pace per Session`} yLabel="Pace" xLabel="Session" points={performance.pacePoints} unit="sec/mi" decimals={0} targetValue={paceGoalLine?.targetValue} targetLabel={paceGoalLine?.label} targetUnit={paceGoalLine?.unit} targetDecimals={paceGoalLine?.decimals} />
              )}
            </SectionCard>
          </>
        ) : null}

        {tab === "completion" ? (
          <SectionCard title="Completion">
            {target.logs.length === 0 ? <EmptyState message="No cardio logs in this range." /> : <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={workload.sessions} decimals={0} targetValue={sessionsGoalLine?.targetValue} targetLabel={sessionsGoalLine?.label} targetUnit={sessionsGoalLine?.unit} targetDecimals={sessionsGoalLine?.decimals} />}
          </SectionCard>
        ) : null}

        {tab === "performance" ? (
          <SectionCard title="Performance">
            {target.logs.length === 0 ? (
              <EmptyState message="No cardio logs in this range." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Distance per Session`} yLabel="Distance" xLabel="Session" points={performance.distancePoints} unit="mi" decimals={2} targetValue={sessionDistanceGoalLine?.targetValue} targetLabel={sessionDistanceGoalLine?.label} targetUnit={sessionDistanceGoalLine?.unit} targetDecimals={sessionDistanceGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Elevation per Session`} yLabel="Elevation" xLabel="Session" points={performance.elevationPoints} unit="ft" decimals={0} targetValue={sessionElevationGoalLine?.targetValue} targetLabel={sessionElevationGoalLine?.label} targetUnit={sessionElevationGoalLine?.unit} targetDecimals={sessionElevationGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Pace per Session`} yLabel="Pace" xLabel="Session" points={performance.pacePoints} unit="sec/mi" decimals={0} targetValue={paceGoalLine?.targetValue} targetLabel={paceGoalLine?.label} targetUnit={paceGoalLine?.unit} targetDecimals={paceGoalLine?.decimals} />
              </div>
            )}
          </SectionCard>
        ) : null}

        {tab === "workload" ? (
          <SectionCard title="Workload">
            {target.logs.length === 0 ? (
              <EmptyState message="No cardio logs in this range." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={workload.sessions} decimals={0} targetValue={sessionsGoalLine?.targetValue} targetLabel={sessionsGoalLine?.label} targetUnit={sessionsGoalLine?.unit} targetDecimals={sessionsGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={workload.distance} unit="mi" decimals={2} targetValue={weeklyDistanceGoalLine?.targetValue} targetLabel={weeklyDistanceGoalLine?.label} targetUnit={weeklyDistanceGoalLine?.unit} targetDecimals={weeklyDistanceGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={workload.duration} unit="sec" decimals={0} valueFormatter={fmtDuration} omitTotal targetValue={durationGoalLine?.targetValue} targetLabel={durationGoalLine?.label} targetUnit={durationGoalLine?.unit} targetDecimals={durationGoalLine?.decimals} />
                <MetricLineChart title={`${targetLabel}: Elevation per Week`} yLabel="Elevation" xLabel="Week" points={workload.elevation} unit="ft" decimals={0} targetValue={weeklyElevationGoalLine?.targetValue} targetLabel={weeklyElevationGoalLine?.label} targetUnit={weeklyElevationGoalLine?.unit} targetDecimals={weeklyElevationGoalLine?.decimals} />
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
