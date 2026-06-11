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
  // Per-graphic range filters. Each section (heatmap, history) owns its
  // own URL param so the user can scope each independently — e.g. show
  // the last 4 weeks of consistency next to the last year of history.
  const heatmapRange = parseRange(getParam(searchParams, "heatmap"));
  const historyRange = parseRange(getParam(searchParams, "history"));
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
      ? await getFrequencyConsistency(normalizedGoalId, { windowDays: RANGE_DAYS[heatmapRange] })
      : null;

  // Filter history points to the selected history range, client-side
  // slicing the entry.history array by date cutoff. Points are kept in
  // their original order; "all" passes through unchanged.
  const historyCutoff = sliceHistoryByRange(entry.history, historyRange);

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

      <SectionCard title="Current Progress">
        <Hero entry={entry} accent={accent} />
      </SectionCard>

      <TypeHighlights entry={entry} consistency={consistency} accent={accent} />

      {consistency ? (
        <SectionCard title="Consistency" subtitle={`Tap a ${getFrequencyRenderModeLabel(consistency.target)} to see what was done.`}>
          <PerGraphicRangeFilter goalId={normalizedGoalId} paramKey="heatmap" current={heatmapRange} searchParams={searchParams} />
          <GoalConsistencyPanel
            target={consistency.target}
            state={consistency.state}
            today={todayAppYmd()}
            weekdayMask={consistency.weekdayMask}
            weeks={RANGE_WEEKS[heatmapRange]}
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
        <PerGraphicRangeFilter goalId={normalizedGoalId} paramKey="history" current={historyRange} searchParams={searchParams} />
        <MetricLineChart
          title={isSessionBasedExerciseTopWeight ? `${entry.goal.name}: top weight vs session` : `${entry.goal.name}: recent history`}
          yLabel={entry.metricLabel}
          xLabel={isSessionBasedExerciseTopWeight ? "Session" : entry.goal.timeframe === "MONTH" ? "Month" : entry.goal.timeframe === "DAY" ? "Day" : "Week"}
          points={historyCutoff}
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

// Slices entry.history to the points within the selected window. Points
// are tagged by label (e.g. "Aug 15" for daily, "W5" for weekly) and a
// matching index — we filter by counting backwards from the most recent
// point so the cutoff is consistent regardless of label format.
function sliceHistoryByRange<T extends { label: string }>(
  history: T[],
  range: RangeOption,
): T[] {
  if (range === "all") return history;
  // Approximate point counts per range — history points are bucket-shaped
  // (weekly for WEEK timeframe goals, monthly for MONTH, daily for DAY).
  // We don't know the bucket interval here, so cap by an upper-bound point
  // count and rely on the chart to render whatever's left.
  const POINT_CAP: Record<Exclude<RangeOption, "all">, number> = {
    "4w": 8,    // 4 weeks ≈ 4 weekly points or up to ~30 daily
    "12w": 16,  // 12 weeks ≈ 12 weekly points
    "6mo": 28,  // 26 weeks ≈ 26 weekly points or 6 monthly
    "1y": 56,   // 52 weeks ≈ 52 weekly points or 12 monthly
  };
  const cap = POINT_CAP[range];
  if (history.length <= cap) return history;
  return history.slice(history.length - cap);
}

function PerGraphicRangeFilter({
  goalId,
  paramKey,
  current,
  searchParams,
}: {
  goalId: string;
  paramKey: "heatmap" | "history";
  current: RangeOption;
  searchParams: SearchParams;
}) {
  const options: RangeOption[] = ["4w", "12w", "6mo", "1y", "all"];
  // Build hrefs that preserve the OTHER section's range param so toggling
  // one filter doesn't reset the other.
  const otherKey = paramKey === "heatmap" ? "history" : "heatmap";
  const otherValue = getParam(searchParams, otherKey);
  const buildHref = (opt: RangeOption) => {
    const params = new URLSearchParams();
    if (opt !== "12w") params.set(paramKey, opt);
    if (otherValue && otherValue !== "12w") params.set(otherKey, otherValue);
    const qs = params.toString();
    return qs ? `/plan/goals/${encodeURIComponent(goalId)}?${qs}` : `/plan/goals/${encodeURIComponent(goalId)}`;
  };
  return (
    <div className="goalDetailRangeRow" style={perSectionRangeRowStyle}>
      {options.map((opt) => {
        const isActive = opt === current;
        return (
          <Link
            key={opt}
            href={buildHref(opt)}
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
  }
  // FREQUENCY skips tinyLine — the cadence + window appear as InfoList rows
  // below, so duplicating them as a tinyLine creates noise.

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

      <InfoList
        items={[
          entry.targetHref
            ? { label: "Target", value: entry.targetLabel, href: entry.targetHref, accentColor: accent.color }
            : { label: "Target", value: entry.targetLabel },
          type === "FREQUENCY" && cadenceLabel ? { label: "Cadence", value: cadenceLabel } : null,
          { label: "Window", value: entry.timeframeWindowLabel },
          { label: "Start", value: formatGoalDate(entry.goal.startDate) },
          entry.goal.endDate ? { label: "End", value: formatGoalDate(entry.goal.endDate) } : null,
        ]}
      />

      {entry.goal.notes ? <div style={notesStyle}>{entry.goal.notes}</div> : null}
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
        <StatRow cols={3}>
          <Stat label="Current" value={`${currentStreak}`} suffix={currentStreak === 1 ? "day" : "days"} accent={accent} />
          <Stat label="Longest" value={`${longestStreak}`} suffix={longestStreak === 1 ? "day" : "days"} accent={accent} />
          <Stat
            label="This window"
            value={`${state.currentWindow.progress}`}
            suffix={`of ${state.currentWindow.target}`}
            accent={accent}
          />
        </StatRow>
      </SectionCard>
    );
  }

  if (type === "VOLUME") {
    const remaining = Math.max(0, entry.targetValue - entry.actualValue);
    const pctPace = Math.round(entry.fractionComplete * 100);
    return (
      <SectionCard title="Accumulation">
        <StatRow cols={3}>
          <Stat label="Logged" value={entry.actualDisplay} accent={accent} />
          <Stat label="Remaining" value={formatRemainingMetric(entry.goal.metricType, remaining)} accent={accent} />
          <Stat label="Pace" value={`${pctPace}%`} suffix="of target" accent={accent} />
        </StatRow>
      </SectionCard>
    );
  }

  if (type === "PERFORMANCE") {
    const gap = Math.max(0, entry.targetValue - entry.actualValue);
    return (
      <SectionCard title="Performance">
        <StatRow cols={3}>
          <Stat label="Best so far" value={entry.actualDisplay} accent={accent} />
          <Stat label="Target" value={entry.targetDisplay} accent={accent} />
          <Stat
            label="Gap"
            value={gap > 0 ? formatRemainingMetric(entry.goal.metricType, gap) : "Hit ✓"}
            accent={accent}
          />
        </StatRow>
      </SectionCard>
    );
  }

  if (type === "COMPLETION") {
    const remaining = Math.max(0, entry.targetValue - entry.actualValue);
    return (
      <SectionCard title="Completion">
        <StatRow cols={2}>
          <Stat label="Completed" value={`${entry.actualValue}`} suffix={`of ${entry.targetValue}`} accent={accent} />
          <Stat label="To go" value={remaining > 0 ? `${remaining}` : "Done ✓"} accent={accent} />
        </StatRow>
      </SectionCard>
    );
  }

  return null;
}

function StatRow({ children, cols = 3 }: { children: React.ReactNode; cols?: 2 | 3 }) {
  return (
    <div
      className="goalDetailStatRow"
      style={{
        ...statRowStyle,
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {children}
    </div>
  );
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
        <span className="goalDetailStatValue" style={{ ...statValueStyle, color: accent.color }}>{value}</span>
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

// Definition-list info block — used in the Hero. Each row is a label-left,
// value-right pair separated by a thin divider. Rows can optionally carry
// an href (and accent for the link arrow); when present the row becomes
// the link target and the value reads as a click affordance.
type InfoItem =
  | { label: string; value: string; href?: undefined }
  | { label: string; value: string; href: string; accentColor: string };

function InfoList({ items }: { items: Array<InfoItem | null | false> }) {
  const filtered = items.filter((item): item is InfoItem => Boolean(item));
  if (filtered.length === 0) return null;
  return (
    <dl className="goalDetailInfoList" style={infoListStyle}>
      {filtered.map((item, idx) => {
        const isLast = idx === filtered.length - 1;
        const rowStyle = { ...infoRowStyle, ...(isLast ? infoRowLastStyle : {}) };
        return (
          <div key={item.label} style={rowStyle}>
            <dt style={infoRowLabelStyle}>{item.label}</dt>
            <dd style={infoRowValueStyle}>
              {item.href ? (
                <Link
                  href={item.href}
                  style={{ ...infoRowValueLinkStyle, color: item.accentColor }}
                >
                  {item.value}
                  <span aria-hidden style={infoRowArrowStyle}> →</span>
                </Link>
              ) : (
                item.value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
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

// Definition-list info block — flat label-value rows with thin dividers.
// No boxes (the SectionCard already provides the container), so row
// heights stay consistent regardless of value length. Long values wrap
// inside the value column instead of pushing the layout off-grid.
const infoListStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  margin: "4px 0 0",
};

const infoRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "90px minmax(0, 1fr)",
  gap: 14,
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  alignItems: "baseline",
};

const infoRowLastStyle: CSSProperties = {
  borderBottom: "none",
  paddingBottom: 2,
};

const infoRowLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const infoRowValueStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.35,
  overflowWrap: "break-word",
};

// Clickable target value — accent-colored text + arrow glyph signal the
// link affordance. Only the value text is the hit target (not the entire
// row) so the row remains a clean dl/dt/dd semantic structure.
const infoRowValueLinkStyle: CSSProperties = {
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontWeight: 800,
};

const infoRowArrowStyle: CSSProperties = {
  opacity: 0.65,
  fontSize: 12,
  fontWeight: 800,
};

const notesStyle: CSSProperties = {
  fontSize: 13,
  opacity: 0.85,
  fontStyle: "italic",
  borderLeft: "2px solid rgba(255,255,255,0.12)",
  paddingLeft: 10,
  marginTop: 2,
};

const rangeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

// Per-section range filter sits inside a SectionCard above its chart.
// Slightly tighter than the (removed) page-level row and includes a
// bottom margin so it visually separates from the chart below.
const perSectionRangeRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap",
  marginBottom: 10,
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

// Stat row — N equal columns (set by --stat-cols), uniform cell heights
// via auto-fit child `align-items: stretch`. Each cell is a tile with
// label on top and value below (consistent baseline across cells).
const statRowStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "var(--stat-cols, repeat(3, minmax(0, 1fr)))",
};

const statCellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.18)",
  background: "rgba(255,255,255,0.02)",
  minHeight: 64,
  minWidth: 0,
};

const statLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.6,
  lineHeight: 1.2,
};

const statValueRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 4,
  flexWrap: "wrap",
  minWidth: 0,
};

const statValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.1,
  overflowWrap: "break-word",
};

const statSuffixStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.6,
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
