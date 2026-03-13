import Link from "next/link";
import MetricLineChart from "@/app/progress/MetricLineChart";
import { SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { getGoalInsight, formatGoalDate, formatGoalDateTime } from "@/lib/goals";
import DeleteGoalButton from "../DeleteGoalButton";
import { GoalMetaLine, GoalProgressRing, GoalStatusBadge, cardStyle, chipStyle, subtleTextStyle } from "../ui";

export const dynamic = "force-dynamic";

type Params = { goalId: string };

export default async function GoalDetailPage(props: {
  params: Promise<Params> | Params;
}) {
  const params = await Promise.resolve(props.params);
  const entry = await getGoalInsight(params.goalId);

  if (!entry) {
    return <div style={{ padding: 20 }}>Goal not found.</div>;
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: 20, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>{entry.goal.name}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{entry.summaryLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <SectionLinkButton href="/goals" label="Back to Goals" />
          <SectionLinkButton href={`/goals/${entry.goal.id}/edit`} label="Edit Goal" />
        </div>
      </div>

      <SectionCard title="Current Progress">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(160px, 200px) 1fr" }}>
          <div style={{ display: "grid", justifyItems: "center", alignContent: "start", gap: 10 }}>
            <GoalProgressRing current={entry.actualDisplay} target={entry.targetDisplay} fraction={entry.fractionComplete} />
            <GoalStatusBadge label={entry.timeframeStatusLabel} achieved={entry.isAchieved} />
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={chipStyle}>{entry.goalTypeLabel}</span>
              <span style={chipStyle}>{entry.targetKindLabel}</span>
              <span style={chipStyle}>{entry.metricLabel}</span>
              <span style={chipStyle}>{entry.timeframeLabel}</span>
              {!entry.goal.isActive ? <span style={chipStyle}>Inactive</span> : null}
            </div>
            <GoalMetaLine>Target: {entry.targetLabel}</GoalMetaLine>
            <GoalMetaLine>Actual vs goal: {entry.actualDisplay} / {entry.targetDisplay}</GoalMetaLine>
            <GoalMetaLine>Window: {entry.timeframeWindowLabel}</GoalMetaLine>
            <GoalMetaLine>Start: {formatGoalDate(entry.goal.startDate)}</GoalMetaLine>
            {entry.goal.endDate ? <GoalMetaLine>End: {formatGoalDate(entry.goal.endDate)}</GoalMetaLine> : null}
            {entry.goal.notes ? <GoalMetaLine>Notes: {entry.goal.notes}</GoalMetaLine> : null}
            {entry.targetHref ? (
              <Link href={entry.targetHref} style={{ fontSize: 13 }}>
                Open related progress target
              </Link>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="History">
        <MetricLineChart
          title={`${entry.goal.name}: recent history`}
          yLabel={entry.metricLabel}
          xLabel={entry.goal.timeframe === "MONTH" ? "Month" : entry.goal.timeframe === "DAY" ? "Day" : "Week"}
          points={entry.history}
          decimals={entry.goal.metricType === "DISTANCE" ? 1 : 0}
          unit={entry.goal.metricType === "DISTANCE" ? "mi" : entry.goal.metricType === "MAX_WEIGHT" || entry.goal.metricType === "VOLUME" ? "lb" : ""}
          targetValue={entry.targetValue}
        />
      </SectionCard>

      <SectionCard title="Recent Contributing Sessions">
        {entry.recentItems.length === 0 ? (
          <div style={subtleTextStyle}>No logs in the current timeframe yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {entry.recentItems.map((item) => (
              <div key={item.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.routineName}</div>
                    <div style={subtleTextStyle}>{formatGoalDateTime(item.performedAt)}</div>
                  </div>
                  <div style={{ fontWeight: 800 }}>{item.contributionLabel}</div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Link href={`/routines/${item.routineId}/logs/${item.id}`} style={{ fontSize: 13 }}>
                    Open log
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Manage Goal">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={subtleTextStyle}>Deleting a goal does not remove any logged training data.</div>
          <DeleteGoalButton goalId={entry.goal.id} />
        </div>
      </SectionCard>
    </div>
  );
}
