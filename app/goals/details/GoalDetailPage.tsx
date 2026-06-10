// Goal detail surface. Layout:
//   1. Header (name + summary + edit/back)
//   2. Time range filter chips — feeds the heatmap windowDays + history depth
//   3. Current Progress (ring + chips + meta) — always current goal window
//   4. Type-specific highlights — different per goal type (see TypeHighlights)
//   5. Consistency heatmap (FREQUENCY only) — range-aware via windowDays
//   6. History chart (existing MetricLineChart, range-agnostic for now)
//   7. Recent Contributing Sessions — with per-type inline detail lines
//   8. Manage Goal (delete + danger zone)

import Link from "next/link";
import type { CSSProperties } from "react";
import MetricLineChart from "@/app/progress/MetricLineChart";
import { SectionBackButton, SectionCard, SectionLinkButton } from "@/app/progress/ui";
import { todayAppYmd } from "@/lib/dates";
import { getGoalInsight, formatGoalDate, formatGoalDateTime } from "@/lib/goals";
import DeleteGoalButton from "../DeleteGoalButton";
import { EditGoalDrawerButton } from "@/app/components/FormDrawerButtons";
import { GoalMetaLine, GoalProgressRing, GoalStatusBadge, cardStyle, chipStyle, subtleTextStyle } from "../ui";
import { getFrequencyConsistency } from "@/lib/frequency-consistency";
import FrequencyHeatmap from "@/app/components/dashboard/FrequencyHeatmap";
import WeeklyFrequencyBars from "@/app/components/dashboard/WeeklyFrequencyBars";
import { getFrequencyRenderMode } from "@/lib/frequency-state";

export const dynamic = "force-dynamic";

type Params = { goalId: string };
type SearchParams = Record<string, string | string[] | undefined>;

type RangeOption = "4w" | "12w" | "6mo" | "1y" | "all";

const RANGE_LABEL: Record<RangeOption, string> = {
  "4w": "4 weeks",
  "12w": "12 weeks",
  "6mo": "6 months",
  "1y": "1 year",
  "all": "All time",
};

const RANGE_DAYS: Record<RangeOption, number> = {
  // Wider than the displayed period so streak math at the leading edge
  // still has buffer. The display window is what the user picked.
  "4w": 4 * 7 + 7,
  "12w": 12 * 7 + 7,
  "6mo": 26 * 7 + 7,
  "1y": 52 * 7 + 7,
  "all": 5 * 365, // 5 years is "all" in practice for the heatmap
};

function parseRange(raw: string | undefined): RangeOption {
  if (raw === "4w" || raw === "12w" || raw === "6mo" || raw === "1y" || raw === "all") return raw;
  return "12w";
}

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function GoalDetailPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const range = parseRange(getParam(searchParams, "range"));
  const normalizedGoalId = decodeURIComponent(params.goalId);

  const entry = await getGoalInsight(normalizedGoalId);

  if (!entry) {
    return <div style={{ padding: 20 }}>Goal not found.</div>;
  }

  // Habit-aware consistency view — fetched only for FREQUENCY goals so we
  // don't waste a query on performance/volume goals where it's irrelevant.
  // Range param widens the heatmap window so users see the full requested
  // span (4w → 4 weeks of grid; 1y → 52 weeks; etc.).
  const consistency =
    entry.goal.goalType === "FREQUENCY"
      ? await getFrequencyConsistency(normalizedGoalId, { windowDays: RANGE_DAYS[range] })
      : null;

  const isSessionBasedExerciseTopWeight =
    entry.goal.goalType === "PERFORMANCE" &&
    entry.goal.targetType === "EXERCISE" &&
    entry.goal.metricType === "MAX_WEIGHT";

  return (
    <div style={pageStyle}>
      <div style={headerRowStyle}>
        <div>
          <h1 style={titleStyle}>{entry.goal.name}</h1>
          <div style={summaryStyle}>{entry.summaryLabel}</div>
        </div>
        <div style={headerActionsStyle}>
          <SectionBackButton fallbackHref="/plan?tab=goals" label="← Back" />
          <EditGoalDrawerButton goalId={entry.goal.id} style={editGoalCtaStyle}>
            Edit Goal
          </EditGoalDrawerButton>
        </div>
      </div>

      <RangeFilterRow goalId={normalizedGoalId} current={range} />

      <SectionCard title="Current Progress">
        <div className="mobileGoalDetailLayout" style={progressLayoutStyle}>
          <div style={progressRingBlockStyle}>
            <GoalProgressRing current={entry.actualDisplay} target={entry.targetDisplay} fraction={entry.fractionComplete} />
            <GoalStatusBadge label={entry.timeframeStatusLabel} achieved={entry.isAchieved} />
          </div>
          <div style={progressMetaBlockStyle}>
            <div style={chipRowStyle}>
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
              <Link href={entry.targetHref} style={metaLinkStyle}>
                Open related progress target
              </Link>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {/* Type-specific highlights — small stat row that varies per goal type
          so each goal kind shows what's most meaningful for it without
          duplicating what's in the ring above. */}
      <TypeHighlights entry={entry} consistency={consistency} />

      {consistency ? (
        <SectionCard title="Consistency" subtitle={`Last ${RANGE_LABEL[range].toLowerCase()}.`}>
          {getFrequencyRenderMode(consistency.target) === "daily-grid" ? (
            <FrequencyHeatmap
              target={consistency.target}
              state={consistency.state}
              today={todayAppYmd()}
              weekdayMask={consistency.weekdayMask}
              retroactiveLogRoutineId={
                consistency.routineIds.length === 1 ? consistency.routineIds[0] : undefined
              }
            />
          ) : (
            <WeeklyFrequencyBars
              target={consistency.target}
              state={consistency.state}
              today={todayAppYmd()}
            />
          )}
        </SectionCard>
      ) : null}

      <SectionCard title="History">
        <MetricLineChart
          title={isSessionBasedExerciseTopWeight ? `${entry.goal.name}: top weight vs session` : `${entry.goal.name}: recent history`}
          yLabel={entry.metricLabel}
          xLabel={isSessionBasedExerciseTopWeight ? "Session" : entry.goal.timeframe === "MONTH" ? "Month" : entry.goal.timeframe === "DAY" ? "Day" : "Week"}
          points={entry.history}
          decimals={entry.goal.metricType === "DISTANCE" ? 1 : entry.goal.metricType === "MAX_WEIGHT" ? 1 : 0}
          unit={
            entry.goal.metricType === "DISTANCE"
              ? "mi"
              : entry.goal.metricType === "ELEVATION_GAIN"
              ? "ft"
              : entry.goal.metricType === "MAX_WEIGHT" || entry.goal.metricType === "VOLUME"
              ? "lb"
              : ""
          }
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
                <div style={sessionTopRowStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={sessionTitleStyle}>{item.routineName}</div>
                    <div style={subtleTextStyle}>{formatGoalDateTime(item.performedAt)}</div>
                  </div>
                  <div style={sessionContributionStyle}>{item.contributionLabel}</div>
                </div>
                {item.detailLines && item.detailLines.length > 0 ? (
                  <div style={detailLinesBlockStyle}>
                    {item.detailLines.map((line, i) => (
                      <span key={i} style={detailLineChipStyle}>{line}</span>
                    ))}
                  </div>
                ) : null}
                <div style={{ marginTop: 10 }}>
                  <Link href={`/log/${item.routineId}/logs/${item.id}`} style={metaLinkStyle}>
                    Open log →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Manage Goal">
        <div style={manageRowStyle}>
          <div style={subtleTextStyle}>Deleting a goal does not remove any logged training data.</div>
          <DeleteGoalButton goalId={entry.goal.id} />
        </div>
      </SectionCard>
    </div>
  );
}

// ── Range filter ──────────────────────────────────────────────────────────

function RangeFilterRow({ goalId, current }: { goalId: string; current: RangeOption }) {
  const options: RangeOption[] = ["4w", "12w", "6mo", "1y", "all"];
  return (
    <div style={rangeRowStyle}>
      <span style={rangeLabelStyle}>Show</span>
      {options.map((opt) => {
        const isActive = opt === current;
        return (
          <Link
            key={opt}
            href={opt === "12w" ? `/plan/goals/${encodeURIComponent(goalId)}` : `/plan/goals/${encodeURIComponent(goalId)}?range=${opt}`}
            style={{ ...rangeChipStyle, ...(isActive ? rangeChipActiveStyle : {}) }}
          >
            {RANGE_LABEL[opt]}
          </Link>
        );
      })}
    </div>
  );
}

// ── Type-specific highlights ──────────────────────────────────────────────

function TypeHighlights({
  entry,
  consistency,
}: {
  entry: Awaited<ReturnType<typeof getGoalInsight>>;
  consistency: Awaited<ReturnType<typeof getFrequencyConsistency>> | null;
}) {
  if (!entry) return null;
  const type = entry.goal.goalType;

  // FREQUENCY: streak chips (current + longest) — quietly displayed.
  if (type === "FREQUENCY" && consistency) {
    const state = consistency.state;
    const currentStreak = Math.max(state.currentDayStreak, state.windowStreak);
    const longestStreak = Math.max(state.longestDayStreak, state.longestWindowStreak);
    return (
      <SectionCard title="Streaks">
        <div style={statRowStyle}>
          <Stat label="Current streak" value={`${currentStreak}`} suffix={currentStreak === 1 ? "day" : "days"} />
          <Stat label="Longest streak" value={`${longestStreak}`} suffix={longestStreak === 1 ? "day" : "days"} />
          <Stat
            label="This window"
            value={`${state.currentWindow.progress}`}
            suffix={`of ${state.currentWindow.target}`}
          />
        </div>
      </SectionCard>
    );
  }

  // VOLUME: total accumulated + remaining + pace.
  if (type === "VOLUME") {
    const remaining = Math.max(0, entry.targetValue - entry.actualValue);
    const pctPace = Math.round(entry.fractionComplete * 100);
    return (
      <SectionCard title="Accumulation">
        <div style={statRowStyle}>
          <Stat label="Logged" value={entry.actualDisplay} />
          <Stat label="Remaining" value={formatRemainingMetric(entry.goal.metricType, remaining)} />
          <Stat label="Pace" value={`${pctPace}%`} suffix="of target" />
        </div>
      </SectionCard>
    );
  }

  // PERFORMANCE: best so far + gap to target.
  if (type === "PERFORMANCE") {
    const gap = Math.max(0, entry.targetValue - entry.actualValue);
    return (
      <SectionCard title="Performance">
        <div style={statRowStyle}>
          <Stat label="Best so far" value={entry.actualDisplay} />
          <Stat label="Target" value={entry.targetDisplay} />
          <Stat
            label="Gap"
            value={gap > 0 ? formatRemainingMetric(entry.goal.metricType, gap) : "Hit ✓"}
          />
        </div>
      </SectionCard>
    );
  }

  // COMPLETION: progress count + remaining to-go.
  if (type === "COMPLETION") {
    const remaining = Math.max(0, entry.targetValue - entry.actualValue);
    return (
      <SectionCard title="Completion">
        <div style={statRowStyle}>
          <Stat label="Completed" value={`${entry.actualValue}`} suffix={`of ${entry.targetValue}`} />
          <Stat label="To go" value={remaining > 0 ? `${remaining}` : "Done ✓"} />
        </div>
      </SectionCard>
    );
  }

  return null;
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div style={statCellStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueRowStyle}>
        <span style={statValueStyle}>{value}</span>
        {suffix ? <span style={statSuffixStyle}>{suffix}</span> : null}
      </div>
    </div>
  );
}

function formatRemainingMetric(metric: string, value: number): string {
  if (metric === "DISTANCE") return `${value.toFixed(1)} mi`;
  if (metric === "ELEVATION_GAIN") return `${Math.round(value)} ft`;
  if (metric === "MAX_WEIGHT") return `${value.toFixed(1)} lb`;
  if (metric === "VOLUME") return `${Math.round(value)} lb`;
  if (metric === "DURATION" || metric === "MAX_DURATION" || metric === "PACE") {
    const mins = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return Math.round(value).toString();
}

// ── Styles ────────────────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: 20,
  display: "grid",
  gap: 16,
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "baseline",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
};

const summaryStyle: CSSProperties = {
  marginTop: 6,
  opacity: 0.75,
  fontSize: 13,
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const progressLayoutStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  gridTemplateColumns: "minmax(160px, 200px) 1fr",
};

const progressRingBlockStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  alignContent: "start",
  gap: 10,
};

const progressMetaBlockStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const metaLinkStyle: CSSProperties = {
  fontSize: 13,
};

const rangeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const rangeLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
  marginRight: 4,
};

const rangeChipStyle: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "transparent",
  fontSize: 12,
  fontWeight: 800,
  color: "inherit",
  textDecoration: "none",
  minHeight: 32,
  display: "inline-flex",
  alignItems: "center",
};

const rangeChipActiveStyle: CSSProperties = {
  border: "1px solid rgba(129,140,248,0.55)",
  background: "rgba(129,140,248,0.14)",
  color: "rgb(199,210,254)",
};

const statRowStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
};

const statCellStyle: CSSProperties = {
  display: "grid",
  gap: 5,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.22)",
  background: "rgba(255,255,255,0.02)",
};

const statLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.6,
};

const statValueRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 5,
};

const statValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
};

const statSuffixStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.62,
  fontWeight: 700,
};

const sessionTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const sessionTitleStyle: CSSProperties = {
  fontWeight: 800,
};

const sessionContributionStyle: CSSProperties = {
  fontWeight: 800,
};

const detailLinesBlockStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};

const detailLineChipStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 9px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.10)",
  opacity: 0.88,
};

const manageRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const editGoalCtaStyle: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 12,
  color: "inherit",
  fontWeight: 800,
  background: "rgba(255,255,255,0.06)",
  cursor: "pointer",
};
