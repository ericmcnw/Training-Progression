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
import { getGoalInsight, formatGoalDate, formatGoalDateTime } from "@/lib/goals";
import DeleteGoalButton from "../DeleteGoalButton";
import { EditGoalDrawerButton } from "@/app/components/FormDrawerButtons";
import { subtleTextStyle } from "../ui";
import { getFrequencyConsistency } from "@/lib/frequency-consistency";
import FrequencyHeatmap from "@/app/components/dashboard/FrequencyHeatmap";
import WeeklyFrequencyBars from "@/app/components/dashboard/WeeklyFrequencyBars";
import { getFrequencyRenderMode } from "@/lib/frequency-state";
import { getTypeAccent, TYPE_ICON, type GoalTypeAccent } from "@/app/plan/goals/goal-type-accent";

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
        <div className="goalDetailHero" style={heroLayoutStyle}>
          <ProgressArc fraction={entry.fractionComplete} accent={accent} />
          <div style={heroNumbersStyle}>
            <div style={heroPrimaryRowStyle}>
              <span style={{ ...heroActualStyle, color: accent.color }}>{entry.actualDisplay}</span>
              <span style={heroDividerStyle}>/</span>
              <span style={heroTargetStyle}>{entry.targetDisplay}</span>
            </div>
            <div style={heroStatusLabelStyle}>{entry.timeframeStatusLabel}</div>
            <div className="goalDetailInfoGrid" style={infoGridStyle}>
              <InfoCell label="Target" value={entry.targetLabel} />
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
        </div>
      </SectionCard>

      <TypeHighlights entry={entry} consistency={consistency} accent={accent} />

      {consistency ? (
        <SectionCard title="Consistency" subtitle={`Last ${RANGE_LABEL[range].toLowerCase()}.`}>
          {getFrequencyRenderMode(consistency.target) === "daily-grid" ? (
            <FrequencyHeatmap
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
            />
          ) : (
            <WeeklyFrequencyBars
              target={consistency.target}
              state={consistency.state}
              today={todayAppYmd()}
              weeks={RANGE_WEEKS[range]}
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
          accent={accent.color}
        />
      </SectionCard>

      <SectionCard title="Recent Contributing Sessions">
        {entry.recentItems.length === 0 ? (
          <div style={subtleTextStyle}>No logs in the current timeframe yet.</div>
        ) : (
          <div style={sessionListStyle}>
            {entry.recentItems.map((item) => (
              <Link
                key={item.id}
                href={`/log/${item.routineId}/logs/${item.id}`}
                className="goalDetailSessionCard"
                style={sessionCardStyle(accent)}
              >
                <div style={sessionTopRowStyle}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={sessionTitleStyle}>{item.routineName}</div>
                    <div style={sessionDateStyle}>{formatGoalDateTime(item.performedAt)}</div>
                  </div>
                  <div style={{ ...sessionContributionStyle, color: accent.color }}>
                    {item.contributionLabel}
                  </div>
                </div>
                {item.detailLines && item.detailLines.length > 0 ? (
                  <div style={detailLinesBlockStyle}>
                    {item.detailLines.map((line, i) => (
                      <span key={i} style={detailLineChipStyle}>{line}</span>
                    ))}
                  </div>
                ) : null}
              </Link>
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
    <div className="goalDetailRangeRow" style={rangeRowStyle}>
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

// ── Progress arc ──────────────────────────────────────────────────────────

function ProgressArc({ fraction, accent }: { fraction: number; accent: GoalTypeAccent }) {
  const size = 132;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dashOffset = circumference * (1 - clamped);
  const pct = Math.round(clamped * 100);

  return (
    <div className="goalDetailArc" style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={accent.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          fill="none"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: accent.color }}>{pct}%</div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.55, marginTop: 4 }}>
            of target
          </div>
        </div>
      </div>
    </div>
  );
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

const heroLayoutStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "auto 1fr",
  alignItems: "start",
};

const heroNumbersStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const heroPrimaryRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  flexWrap: "wrap",
};

const heroActualStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1,
};

const heroDividerStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  opacity: 0.4,
};

const heroTargetStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  opacity: 0.75,
};

const heroStatusLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.7,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

const infoGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
};

const statSuffixStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  fontWeight: 700,
};

const sessionListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

function sessionCardStyle(accent: GoalTypeAccent): CSSProperties {
  return {
    display: "grid",
    gap: 8,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.20)",
    borderLeft: `3px solid ${accent.border}`,
    background: "rgba(255,255,255,0.02)",
    textDecoration: "none",
    color: "inherit",
  };
}

const sessionTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  minWidth: 0,
};

const sessionTitleStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 14,
  lineHeight: 1.25,
  overflowWrap: "break-word",
};

const sessionDateStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.65,
  marginTop: 2,
};

const sessionContributionStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const detailLinesBlockStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
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
  padding: "10px 14px",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 12,
  color: "inherit",
  fontWeight: 800,
  background: "rgba(255,255,255,0.06)",
  cursor: "pointer",
  minHeight: 40,
};
