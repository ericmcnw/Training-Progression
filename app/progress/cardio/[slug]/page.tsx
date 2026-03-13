import MetricLineChart from "../../MetricLineChart";
import { cardioPerformanceSeries, cardioWorkloadSeries, resolveGroupTarget, summarizeRoutineLogs } from "../../data";
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

export default async function CardioTargetPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const tab = normalizeProgressTab(getParam(searchParams, "tab"));
  const range = getRangeFromSearchParam(getParam(searchParams, "range"));

  const target = await resolveGroupTarget(params.slug, range);
  if (!target || target.group.kind !== "CARDIO_ACTIVITY") {
    return <div style={{ padding: 20 }}>Cardio target not found.</div>;
  }

  const summary = summarizeRoutineLogs(target.logs, null);
  const performance = cardioPerformanceSeries(target.logs);
  const workload = cardioWorkloadSeries(target.logs, range);
  const targetLabel = target.group.label;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{target.group.label}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>Cardio target powered by metadata groups.</div>
        </div>
        <SectionLinkButton href="/progress/cardio" label="Back to Cardio" />
      </div>

      <PillNav items={progressSections().map((item) => ({ ...item, active: item.key === "cardio" }))} />
      <PillNav items={progressTabs(`/progress/cardio/${target.group.slug}`, range).map((item) => ({ ...item, active: item.key === tab }))} />
      <PillNav items={progressRanges(`/progress/cardio/${target.group.slug}`, tab).map((item) => ({ ...item, active: item.key === range }))} />
      <TabHint tab={tab} />

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
        <SectionCard title="Overview Snapshot">
          <StatGrid
            items={[
              { label: "Range", value: rangeChipLabel(range) },
              { label: "Sessions", value: String(summary.sessions) },
              { label: "YTD sessions", value: String(summary.ytd) },
              { label: "Total distance", value: `${summary.totalDistance.toFixed(1)} mi` },
              { label: "Total duration", value: formatDuration(summary.totalDurationSec) },
              { label: "Avg pace", value: formatPace(summary.totalDistance > 0 ? summary.totalDurationSec / summary.totalDistance : null) },
            ]}
          />
        </SectionCard>

        {tab === "overview" ? (
          <>
            <SectionCard title="Performance Snapshot">
              {target.logs.length === 0 ? (
                <EmptyState message="No cardio logs in this range." />
              ) : (
                <MetricLineChart title={`${targetLabel}: Pace per Session`} yLabel="Pace" xLabel="Session" points={performance.pacePoints} unit="sec/mi" decimals={0} />
              )}
            </SectionCard>
            <SectionCard title="Workload Snapshot">
              {target.logs.length === 0 ? (
                <EmptyState message="No cardio logs in this range." />
              ) : (
                <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={workload.distance} unit="mi" decimals={2} />
              )}
            </SectionCard>
          </>
        ) : null}

        {tab === "completion" ? (
          <SectionCard title="Completion">
            {target.logs.length === 0 ? <EmptyState message="No cardio logs in this range." /> : <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={workload.sessions} decimals={0} />}
          </SectionCard>
        ) : null}

        {tab === "performance" ? (
          <SectionCard title="Performance">
            {target.logs.length === 0 ? (
              <EmptyState message="No cardio logs in this range." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <MetricLineChart title={`${targetLabel}: Distance per Session`} yLabel="Distance" xLabel="Session" points={performance.distancePoints} unit="mi" decimals={2} />
                <MetricLineChart title={`${targetLabel}: Pace per Session`} yLabel="Pace" xLabel="Session" points={performance.pacePoints} unit="sec/mi" decimals={0} />
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
                <MetricLineChart title={`${targetLabel}: Sessions per Week`} yLabel="Sessions" xLabel="Week" points={workload.sessions} decimals={0} />
                <MetricLineChart title={`${targetLabel}: Distance per Week`} yLabel="Distance" xLabel="Week" points={workload.distance} unit="mi" decimals={2} />
                <MetricLineChart title={`${targetLabel}: Duration per Week`} yLabel="Duration" xLabel="Week" points={workload.duration} unit="sec" decimals={0} />
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
