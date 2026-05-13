"use client";

// WeeklyFrequencyBars — 8-week stacked-bar view for flexible-window
// frequency goals (e.g. "3× per week"). Rendered instead of the calendar
// grid when getFrequencyRenderMode(target) === "weekly-bars" — the grid
// looks empty for low-frequency goals because most days are unscheduled,
// so we summarize at the week level instead.
//
// Each bar fills from 0/N to N/N. Color encodes hit-or-miss:
//   • complete (≥ target) → amber/done
//   • partial (>0 but < target) → muted
//   • zero → faint outline
// The current week always shows in full color; past weeks dim slightly so
// the "current" bar reads as the focus.

import type { CSSProperties } from "react";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import {
  frequencyStatusColor,
  frequencyStatusLabel,
  type FrequencyState,
  type FrequencyTarget,
} from "@/lib/frequency-state";

const WEEKS = 8;

type WeekSummary = {
  weekStartYmd: string;
  weekEndYmd: string;
  hits: number;
  isCurrent: boolean;
};

export default function WeeklyFrequencyBars({
  target,
  state,
  today,
}: {
  target: FrequencyTarget;
  state: FrequencyState;
  today: string;
}) {
  const targetCount = Math.max(1, target.targetCount);
  const accent = frequencyStatusColor(state.currentWindow.status);
  const statusLabel = frequencyStatusLabel(state.currentWindow.status);

  // Anchor on the Sunday of the current week, walk back WEEKS-1 weeks.
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const todayDow = todayDate.getUTCDay();
  const currentWeekStart = addDaysYmd(today, -todayDow);
  const firstWeekStart = addDaysYmd(currentWeekStart, -(WEEKS - 1) * 7);

  const weeks: WeekSummary[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const weekStartYmd = addDaysYmd(firstWeekStart, w * 7);
    const weekEndYmd = addDaysYmd(weekStartYmd, 6);
    let hits = 0;
    for (let d = 0; d < 7; d++) {
      const ymd = addDaysYmd(weekStartYmd, d);
      if (ymd > today) break;
      if (state.dailyState[ymd] === "done" || state.dailyState[ymd] === "covered") {
        hits++;
      }
    }
    weeks.push({
      weekStartYmd,
      weekEndYmd,
      hits,
      isCurrent: w === WEEKS - 1,
    });
  }

  const weeksHit = weeks.filter((w) => w.hits >= targetCount).length;
  const cadenceLabel = formatTargetLabel(target);

  return (
    <div style={shell}>
      <div style={headerRow}>
        <div style={titleBlock}>
          <div style={titleLine}>Last 8 weeks</div>
          <div style={subLine}>{cadenceLabel}</div>
        </div>
        <div style={statsRow}>
          <Stat label="This week" value={`${state.currentWindow.progress} / ${targetCount}`} accent={accent} />
          <Stat label="Status" value={statusLabel} accent={accent} />
          <Stat label="Hit" value={`${weeksHit} / ${WEEKS}`} accent="rgba(132,204,255,0.95)" />
          <Stat
            label="Streak"
            value={String(Math.max(state.windowStreak, state.currentDayStreak))}
            accent="rgba(251,146,60,0.95)"
          />
        </div>
      </div>

      <div style={barsRow}>
        {weeks.map((week) => {
          const fraction = Math.min(1, week.hits / targetCount);
          const hit = week.hits >= targetCount;
          const partial = week.hits > 0 && !hit;
          const fillColor = hit
            ? "rgba(251,191,36,0.95)" // amber — target hit
            : partial
              ? "rgba(132,204,255,0.55)" // sky — partial credit
              : "rgba(255,255,255,0.06)"; // empty
          const trackColor = hit
            ? "rgba(251,191,36,0.18)"
            : partial
              ? "rgba(132,204,255,0.12)"
              : "rgba(255,255,255,0.05)";
          const opacity = week.isCurrent ? 1 : 0.78;

          return (
            <div key={week.weekStartYmd} style={{ ...barColumn, opacity }}>
              <div style={barCountLabel}>
                <span style={{ ...countNum, color: hit ? "rgba(251,191,36,1)" : partial ? "rgba(132,204,255,1)" : "rgba(255,255,255,0.45)" }}>
                  {week.hits}
                </span>
                <span style={countSep}>/</span>
                <span style={countTarget}>{targetCount}</span>
              </div>
              <div
                style={{
                  ...barTrack,
                  background: trackColor,
                  borderColor: week.isCurrent ? accent : "rgba(255,255,255,0.08)",
                  borderWidth: week.isCurrent ? 1.5 : 1,
                }}
                title={`${formatUtcDateLabel(week.weekStartYmd, { month: "short", day: "numeric" })} – ${formatUtcDateLabel(
                  week.weekEndYmd,
                  { month: "short", day: "numeric" }
                )}: ${week.hits} of ${targetCount}`}
              >
                <div
                  style={{
                    ...barFill,
                    height: `${fraction * 100}%`,
                    background: fillColor,
                  }}
                />
              </div>
              <div style={{ ...weekLabel, ...(week.isCurrent ? weekLabelCurrent : null) }}>
                {formatUtcDateLabel(week.weekStartYmd, { month: "numeric", day: "numeric" })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={legendRow}>
        <Legend swatch={swatchHit} label={`Hit ${cadenceLabel.toLowerCase()}`} />
        <Legend swatch={swatchPartial} label="Partial" />
        <Legend swatch={swatchMiss} label="Missed window" />
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={statBlock}>
      <div style={statLabelStyle}>{label}</div>
      <div style={{ ...statValueStyle, color: accent }}>{value}</div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: CSSProperties; label: string }) {
  return (
    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <div style={swatch} />
      <span style={{ fontSize: 11, opacity: 0.65 }}>{label}</span>
    </div>
  );
}

function formatTargetLabel(target: FrequencyTarget): string {
  const unitWord = target.targetUnit === "DAY" ? "day" : target.targetUnit === "WEEK" ? "week" : "month";
  if (target.targetInterval === 1) return `${target.targetCount}× / ${unitWord}`;
  return `${target.targetCount}× / ${target.targetInterval} ${unitWord}s`;
}

const shell: CSSProperties = {
  display: "grid",
  gap: 12,
};

const headerRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-end",
};

const titleBlock: CSSProperties = {
  display: "grid",
  gap: 2,
};

const titleLine: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.7,
};

const subLine: CSSProperties = {
  fontSize: 12,
  opacity: 0.65,
};

const statsRow: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

const statBlock: CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 60,
};

const statLabelStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const statValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.1,
};

const barsRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
  gap: 8,
  alignItems: "end",
};

const barColumn: CSSProperties = {
  display: "grid",
  gap: 4,
  justifyItems: "center",
  minWidth: 0,
};

const barCountLabel: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 1,
  fontWeight: 800,
  lineHeight: 1,
};

const countNum: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const countSep: CSSProperties = {
  fontSize: 10,
  opacity: 0.4,
};

const countTarget: CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  fontWeight: 800,
};

const barTrack: CSSProperties = {
  width: "100%",
  height: 70,
  borderRadius: 6,
  borderStyle: "solid",
  position: "relative",
  display: "flex",
  alignItems: "flex-end",
  overflow: "hidden",
};

const barFill: CSSProperties = {
  width: "100%",
  borderRadius: 4,
  transition: "height 220ms ease",
  minHeight: 2,
};

const weekLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  opacity: 0.5,
  whiteSpace: "nowrap",
};

const weekLabelCurrent: CSSProperties = {
  opacity: 0.95,
  fontWeight: 900,
};

const legendRow: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
};

const swatchBase: CSSProperties = {
  width: 14,
  height: 10,
  borderRadius: 3,
};

const swatchHit: CSSProperties = {
  ...swatchBase,
  background: "rgba(251,191,36,0.95)",
  border: "1px solid rgba(251,191,36,0.55)",
};

const swatchPartial: CSSProperties = {
  ...swatchBase,
  background: "rgba(132,204,255,0.55)",
  border: "1px solid rgba(132,204,255,0.55)",
};

const swatchMiss: CSSProperties = {
  ...swatchBase,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.10)",
};
