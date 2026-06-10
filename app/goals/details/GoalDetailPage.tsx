// Goal detail surface — revamped to match the gentle-lens visual language
// used by the plan/goals row redesign. Layout:
//   1. Header (name + summary + edit/back)  — mobile-stacks
//   2. Time range filter chips             — feeds heatmap windowDays
//   3. Current Progress                    — type-accent progress arc + info grid
//   4. Type-specific highlights            — stat cells, mobile-responsive
//   5. Consistency heatmap (FREQUENCY)     — range-aware, gentle colors
//   6. History chart                       — type-accent colored
//   7. Recent Contributing Sessions        — compact card per session
//   8. Manage Goal                         — delete + danger zone

import Link from "next/link";
import type { CSSProperties } from "react";
import MetricLineChart from "@/app/progress/MetricLineChart";
import { SectionBackButton, SectionCard } from "@/app/progress/ui";
import { todayAppYmd } from "@/lib/dates";
import { getGoalInsight, formatGoalDate } from "@/lib/goals";
import DeleteGoalButton from "../DeleteGoalButton";
import { EditGoalDrawerButton } from "@/app/components/FormDrawerButtons";
import { subtleTextStyle } from "../ui";
import { getFrequencyConsistency } from "@/lib/frequency-consistency";
import GoalConsistencyPanel from "./GoalConsistencyPanel";
import GoalRecentSessions from "./GoalRecentSessions";
import { getFrequencyRenderMode, type FrequencyTarget } from "@/lib/frequency-state";
import { getTypeAccent, TYPE_ICON, type GoalTypeAccent } from "@/app/plan/goals/goal-type-accent";

function getFrequencyRenderModeLabel(target: FrequencyTarget): string {
  return getFrequencyRenderMode(target) === "daily-grid" ? "day" : "week";
}

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

const RANGE_WEEKS: Record<RangeOption, number> = {
  "4w": 4,
  "12w": 12,
  "6mo": 26,
  "1y": 52,
  "all": 52, // heatmap cap — 5 years would be unreadable
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

  const accent = getTypeAccent(entry.goal.goalType);
  const icon = TYPE_ICON[entry.goal.goalType] ?? "•";

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
    <div className="goalDetailPage" style={pageStyle}>
      <div className="goalDetailHeader" style={headerRowStyle}>
        <div style={headerTextBlockStyle}>
          <div style={headerTitleRowStyle}>
            <span
              aria-hidden
              style={{
                ...iconBlockStyle,
                background: accent.bg,
                border: `1px solid ${accent.border}`,
                color: accent.color,
              }}
            >
              {icon}
            </span>
            <h1 className="goalDetailTitle" style={titleStyle}>{entry.goal.name}</h1>
          </div>
          <div style={summaryStyle}>{entry.summaryLabel}</div>
          {!entry.goal.isActive ? <div style={inactiveNoteStyle}>Inactive goal</div> : null}
        </div>
        <div className="goalDetailActions" style={headerActionsStyle}>
          <SectionBackButton fallbackHref="/plan?tab=goals" label="← Back" />
          <EditGoalDrawerButton goalId={entry.goal.id} style={editGoalCtaStyle}>
            Edit Goal
          </EditGoalDrawerButton>
        </div>
      </div>

      <RangeFilterRow goalId={normalizedGoalId} current={range} />

      <SectionCard title="Current Progress">
        <Hero entry={entry} accent={accent} />
      </SectionCard>

      <TypeHighlights entry={entry} consistency={consistency} accent={accent} />

      {consistency ? (
        <SectionCard title="Consistency" subtitle={`Last ${RANGE_LABEL[range].toLowerCase()}. Tap a ${getFrequencyRenderModeLabel(consistency.target)} to see what was done.`}>
          <GoalConsistencyPanel
            target={consistency.target}
            state={consistency.state}
            today={todayAppYmd()}
            weekdayMask={consistency.weekdayMask}
            weeks={RANGE_WEEKS[range]}
            accentColor={accent.color}
            accentBorderColor={accent.border}
            retroactiveLogRoutineId={
              consistency.routineIds.length === 1 ? consistency.routineIds[0] : undefined
            }
            contributingLogs={consistency.contributingLogs}
            goalName={entry.goal.name}
          />
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
          accent={accent.color}
        />
      </SectionCard>

      <SectionCard title="Recent Contributing Sessions">
        <GoalRecentSessions items={entry.recentItems} accent={accent} goalName={entry.goal.name} />
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
    <div className="goalDetailRangeRow" style={rangeRowStyle}>
      <span className="goalDetailRangeLabel" style={rangeLabelStyle}>Show</span>
      {options.map((opt) => {
        const isActive = opt === current;
        return (
          <Link
            key={opt}
            href={opt === "12w" ? `/plan/goals/${encodeURIComponent(goalId)}` : `/plan/goals/${encodeURIComponent(goalId)}?range=${opt}`}
            className="goalDetailRangeChip"
            style={{ ...rangeChipStyle, ...(isActive ? rangeChipActiveStyle : {}) }}
          >
            {RANGE_LABEL[opt]}
          </Link>
        );
      })}
    </div>
  );
}

// ── Hero — type-specific framing ──────────────────────────────────────────

function Hero({
  entry,
  accent,
}: {
  entry: NonNullable<Awaited<ReturnType<typeof getGoalInsight>>>;
  accent: GoalTypeAccent;
}) {
  const type = entry.goal.goalType;
  const pctComplete = Math.min(100, Math.max(0, Math.round(entry.fractionComplete * 100)));

  // Cadence label for FREQUENCY goals — the trailing segment of summaryLabel
  // (e.g., "Pull Day | session | 3× per week" → "3× per week").
  const cadenceLabel =
    type === "FREQUENCY" && entry.summaryLabel.includes("|")
      ? entry.summaryLabel.split("|").pop()?.trim() ?? null
      : null;

  let bigPrefix: string | null = null;
  let tinyLine: string | null = null;

  if (type === "VOLUME") {
    const remaining = Math.max(0, entry.targetValue - entry.actualValue);
    tinyLine =
      remaining > 0
        ? `${formatRemainingMetric(entry.goal.metricType, remaining)} to go · ${pctComplete}% logged`
        : "Goal hit ✓";
  } else if (type === "PERFORMANCE") {
    const gap = Math.max(0, entry.targetValue - entry.actualValue);
    bigPrefix = "Best";
    tinyLine =
      gap > 0
        ? `${formatRemainingMetric(entry.goal.metricType, gap)} to target`
        : "Target reached ✓";
  } else if (type === "COMPLETION") {
    const remaining = Math.max(0, entry.targetValue - entry.actualValue);
    tinyLine =
      remaining > 0
        ? `${remaining} ${remaining === 1 ? "session" : "sessions"} to go`
        : "All sessions complete ✓";
  } else if (type === "FREQUENCY" && cadenceLabel) {
    tinyLine = `${cadenceLabel} · ${entry.timeframeWindowLabel}`;
  }

  return (
    <div style={heroStyle}>
      <div className="goalDetailHeroRow" style={heroPrimaryRowStyle}>
        <div style={heroValueGroupStyle}>
          {bigPrefix ? <span style={heroPrefixStyle}>{bigPrefix}</span> : null}
          <span className="goalDetailHeroActual" style={{ ...heroActualStyle, color: accent.color }}>{entry.actualDisplay}</span>
          <span className="goalDetailHeroSeparator" style={heroSeparatorStyle}>/</span>
          <span className="goalDetailHeroTarget" style={heroTargetStyle}>{entry.targetDisplay}</span>
        </div>
        <span
          className="goalDetailHeroStatus"
          style={{
            ...heroStatusChipStyle,
            borderColor: accent.border,
            background: accent.bg,
            color: accent.color,
          }}
        >
          {entry.timeframeStatusLabel}
        </span>
      </div>

      <div style={progressBarTrackStyle}>
        <div
          style={{
            ...progressBarFillStyle,
            width: `${pctComplete}%`,
            background: accent.color,
          }}
        />
      </div>

      {tinyLine ? <div style={heroTinyLineStyle}>{tinyLine}</div> : null}

      <div className="goalDetailInfoGrid" style={infoGridStyle}>
        <InfoCell label="Target" value={entry.targetLabel} />
        {type === "FREQUENCY" && cadenceLabel ? <InfoCell label="Cadence" value={cadenceLabel} /> : null}
        <InfoCell label="Window" value={entry.timeframeWindowLabel} />
        <InfoCell label="Start" value={formatGoalDate(entry.goal.startDate)} />
        {entry.goal.endDate ? <InfoCell label="End" value={formatGoalDate(entry.goal.endDate)} /> : null}
      </div>

      {entry.goal.notes ? <div style={notesStyle}>{entry.goal.notes}</div> : null}
      {entry.targetHref ? (
        <Link href={entry.targetHref} style={metaLinkStyle}>
          Open related progress target →
        </Link>
      ) : null}
    </div>
  );
}

// ── Type-specific highlights ──────────────────────────────────────────────

function TypeHighlights({
  entry,
  consistency,
  accent,
}: {
  entry: NonNullable<Awaited<ReturnType<typeof getGoalInsight>>>;
  consistency: Awaited<ReturnType<typeof getFrequencyConsistency>> | null;
  accent: GoalTypeAccent;
}) {
  const type = entry.goal.goalType;

  if (type === "FREQUENCY" && consistency) {
    const state = consistency.state;
    const currentStreak = Math.max(state.currentDayStreak, state.windowStreak);
    const longestStreak = Math.max(state.longestDayStreak, state.longestWindowStreak);
    return (
      <SectionCard title="Streaks">
        <div className="goalDetailStatRow" style={statRowStyle}>
          <Stat label="Current streak" value={`${currentStreak}`} suffix={currentStreak === 1 ? "day" : "days"} accent={accent} />
          <Stat label="Longest streak" value={`${longestStreak}`} suffix={longestStreak === 1 ? "day" : "days"} accent={accent} />
          <Stat
            label="This window"
            value={`${state.currentWindow.progress}`}
            suffix={`of ${state.currentWindow.target}`}
            accent={accent}
          />
        </div>
      </SectionCard>
    );
  }

  if (type === "VOLUME") {
    const remaining = Math.max(0, entry.targetValue - entry.actualValue);
    const pctPace = Math.round(entry.fractionComplete * 100);
    return (
      <SectionCard title="Accumulation">
        <div className="goalDetailStatRow" style={statRowStyle}>
          <Stat label="Logged" value={entry.actualDisplay} accent={accent} />
          <Stat label="Remaining" value={formatRemainingMetric(entry.goal.metricType, remaining)} accent={accent} />
          <Stat label="Pace" value={`${pctPace}%`} suffix="of target" accent={accent} />
        </div>
      </SectionCard>
    );
  }

  if (type === "PERFORMANCE") {
    const gap = Math.max(0, entry.targetValue - entry.actualValue);
    return (
      <SectionCard title="Performance">
        <div className="goalDetailStatRow" style={statRowStyle}>
          <Stat label="Best so far" value={entry.actualDisplay} accent={accent} />
          <Stat label="Target" value={entry.targetDisplay} accent={accent} />
          <Stat
            label="Gap"
            value={gap > 0 ? formatRemainingMetric(entry.goal.metricType, gap) : "Hit ✓"}
            accent={accent}
          />
        </div>
      </SectionCard>
    );
  }

  if (type === "COMPLETION") {
    const remaining = Math.max(0, entry.targetValue - entry.actualValue);
    return (
      <SectionCard title="Completion">
        <div className="goalDetailStatRow" style={statRowStyle}>
          <Stat label="Completed" value={`${entry.actualValue}`} suffix={`of ${entry.targetValue}`} accent={accent} />
          <Stat label="To go" value={remaining > 0 ? `${remaining}` : "Done ✓"} accent={accent} />
        </div>
      </SectionCard>
    );
  }

  return null;
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent: GoalTypeAccent;
}) {
  return (
    <div className="goalDetailStatCell" style={{ ...statCellStyle, borderColor: accent.border, background: accent.bg }}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueRowStyle}>
        <span style={{ ...statValueStyle, color: accent.color }}>{value}</span>
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

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="goalDetailInfoCell" style={infoCellStyle}>
      <div style={infoCellLabelStyle}>{label}</div>
      <div style={infoCellValueStyle}>{value}</div>
    </div>
  );
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
  alignItems: "flex-start",
};

const headerTextBlockStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
  flex: 1,
};

const headerTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const iconBlockStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 9,
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1,
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1.15,
  minWidth: 0,
  overflowWrap: "break-word",
};

const summaryStyle: CSSProperties = {
  opacity: 0.75,
  fontSize: 13,
  lineHeight: 1.4,
};

const inactiveNoteStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  opacity: 0.55,
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  flexShrink: 0,
};

const heroStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const heroPrimaryRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const heroValueGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 0,
};

const heroPrefixStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.55,
  marginRight: -2,
};

const heroTinyLineStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.75,
  marginTop: 2,
};

const heroActualStyle: CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1,
};

const heroSeparatorStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  opacity: 0.32,
  margin: "0 2px",
};

const heroTargetStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  opacity: 0.7,
};

const heroStatusChipStyle: CSSProperties = {
  marginLeft: "auto",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid",
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
};

const progressBarTrackStyle: CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  overflow: "hidden",
};

const progressBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 200ms ease",
};

// 3-column cap on desktop so cells don't sprawl across the hero — at
// 4 cells (End present), the 4th wraps to a second row in a balanced 2x2.
const infoGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  marginTop: 4,
};

const infoCellStyle: CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  minWidth: 0,
};

const infoCellLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const infoCellValueStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.25,
  overflowWrap: "break-word",
};

const notesStyle: CSSProperties = {
  fontSize: 13,
  opacity: 0.85,
  fontStyle: "italic",
  borderLeft: "2px solid rgba(255,255,255,0.12)",
  paddingLeft: 10,
  marginTop: 2,
};

const metaLinkStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const rangeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const rangeLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
  marginRight: 4,
};

const rangeChipStyle: CSSProperties = {
  padding: "6px 12px",
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
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
};

const statCellStyle: CSSProperties = {
  display: "grid",
  gap: 6,
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
  opacity: 0.65,
};

const statValueRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 5,
  flexWrap: "wrap",
};

const statValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
};

const statSuffixStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  fontWeight: 700,
};

const manageRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const editGoalCtaStyle: CSSProperties = {
  padding: "10px 14px",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 12,
  color: "inherit",
  fontWeight: 800,
  background: "rgba(255,255,255,0.06)",
  cursor: "pointer",
  minHeight: 40,
};
