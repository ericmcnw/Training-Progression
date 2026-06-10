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
//
// When `weeklyContributions` is provided, the bars become clickable — a tap
// opens an inline expansion below showing the routines that satisfied the
// goal that week, grouped by routine with date/time pills (matches the
// DomainSparklines interaction). Pills call `onLogClick` so the parent can
// open a floating log report popover.

import { useState, type CSSProperties } from "react";
import { addDaysYmd, formatUtcDateLabel } from "@/lib/dates";
import {
  frequencyStatusColor,
  frequencyStatusLabel,
  type FrequencyState,
  type FrequencyTarget,
} from "@/lib/frequency-state";

type ContributionLog = {
  logId: string;
  routineId: string;
  routineName: string;
  performedYmd: string;
  performedTimeLabel: string;
  isPrimary: boolean;
};

type WeekContribution = {
  weekStartYmd: string;
  weekEndYmd: string;
  logs: ContributionLog[];
};

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
  weeklyContributions,
  onLogClick,
  weeks: weeksProp = 8,
  compact = false,
}: {
  target: FrequencyTarget;
  state: FrequencyState;
  today: string;
  weeklyContributions?: WeekContribution[];
  onLogClick?: (log: ContributionLog) => void;
  /** How many trailing weeks to render. Defaults to 8 for back-compat with
   *  the home page; goal detail page passes the range-filter value. */
  weeks?: number;
  /** When true (goal detail page), hides the internal header — the parent
   *  SectionCard already provides the title and TypeHighlights renders the
   *  same streak/window stats above this surface. */
  compact?: boolean;
}) {
  const WEEKS = Math.max(4, Math.min(52, Math.floor(weeksProp)));
  const targetCount = Math.max(1, target.targetCount);
  const accent = frequencyStatusColor(state.currentWindow.status);
  const statusLabel = frequencyStatusLabel(state.currentWindow.status);
  const [openWeekStart, setOpenWeekStart] = useState<string | null>(null);
  const interactive = Boolean(weeklyContributions && weeklyContributions.length > 0);

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
      {!compact ? (
        <div style={headerRow}>
          <div style={titleBlock}>
            <div style={titleLine}>Last {WEEKS} weeks</div>
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
      ) : null}

      <div style={{ ...barsRowBase, gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
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
          const isOpen = openWeekStart === week.weekStartYmd;
          const tooltip = `${formatUtcDateLabel(week.weekStartYmd, { month: "short", day: "numeric" })} – ${formatUtcDateLabel(
            week.weekEndYmd,
            { month: "short", day: "numeric" }
          )}: ${week.hits} of ${targetCount}`;

          const bar = (
            <>
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
                  borderColor: isOpen
                    ? "rgba(255,255,255,0.55)"
                    : week.isCurrent
                      ? accent
                      : "rgba(255,255,255,0.08)",
                  borderWidth: week.isCurrent || isOpen ? 1.5 : 1,
                }}
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
            </>
          );

          if (!interactive) {
            return (
              <div key={week.weekStartYmd} style={{ ...barColumn, opacity }} title={tooltip}>
                {bar}
              </div>
            );
          }

          return (
            <button
              key={week.weekStartYmd}
              type="button"
              onClick={() => setOpenWeekStart((prev) => (prev === week.weekStartYmd ? null : week.weekStartYmd))}
              className="freqBarButton"
              style={{ ...barColumn, ...barColumnInteractive, opacity }}
              title={tooltip}
              aria-pressed={isOpen}
              aria-label={`Week of ${formatUtcDateLabel(week.weekStartYmd, { month: "short", day: "numeric" })}: ${week.hits} of ${targetCount}`}
            >
              {bar}
            </button>
          );
        })}
      </div>

      {interactive && openWeekStart
        ? (() => {
            const openWeek = weeklyContributions!.find((w) => w.weekStartYmd === openWeekStart);
            if (!openWeek) return null;
            return (
              <WeekContributionsPanel
                week={openWeek}
                accent={accent}
                targetCount={targetCount}
                onClose={() => setOpenWeekStart(null)}
                onLogClick={onLogClick}
              />
            );
          })()
        : null}

      <div style={legendRow}>
        <Legend swatch={swatchHit} label={`Hit ${cadenceLabel.toLowerCase()}`} />
        <Legend swatch={swatchPartial} label="Partial" />
        <Legend swatch={swatchMiss} label="Missed window" />
      </div>

      <style>{`
        .freqBarButton {
          appearance: none;
          -webkit-appearance: none;
          margin: 0;
          padding: 0;
          background: transparent;
          border: none;
          color: inherit;
          font: inherit;
          cursor: pointer;
          border-radius: 8px;
          transition: background 100ms ease;
        }
        .freqBarButton:hover,
        .freqBarButton:focus-visible {
          background: rgba(255,255,255,0.04);
        }
      `}</style>
    </div>
  );
}

// ───────────────────────────── inline week expansion

function WeekContributionsPanel({
  week,
  accent,
  targetCount,
  onClose,
  onLogClick,
}: {
  week: WeekContribution;
  accent: string;
  targetCount: number;
  onClose: () => void;
  onLogClick?: (log: ContributionLog) => void;
}) {
  const groups = groupLogsByRoutine(week.logs);
  const rangeLabel = `${formatUtcDateLabel(week.weekStartYmd, { month: "short", day: "numeric" })} – ${formatUtcDateLabel(
    week.weekEndYmd,
    { month: "short", day: "numeric" }
  )}`;

  return (
    <div style={expansionShell}>
      <div style={expansionHeader}>
        <div style={expansionHeaderText}>
          <span style={{ ...expansionDot, background: accent }} aria-hidden />
          <span style={expansionLabel}>{rangeLabel}</span>
          <span style={expansionRange}>
            {week.logs.length} of {targetCount}
          </span>
        </div>
        <button type="button" onClick={onClose} style={closeBtn} aria-label="Close week detail">
          ×
        </button>
      </div>

      {week.logs.length === 0 ? (
        <div style={emptyText}>No contributing logs this week.</div>
      ) : (
        <ul style={logList}>
          {groups.map((group) => (
            <li key={group.routineId}>
              <div style={groupShell}>
                <div style={groupHeader}>
                  <span style={{ ...logRowAccent, background: accent }} aria-hidden />
                  <span style={logRowName}>{group.routineName}</span>
                  {group.entries.length > 1 ? (
                    <span style={countBadge(accent)}>×{group.entries.length}</span>
                  ) : null}
                  {group.entries.some((e) => !e.isPrimary) && group.entries.every((e) => !e.isPrimary) ? (
                    <span style={substituteBadge}>substitute</span>
                  ) : null}
                </div>
                <div style={datePillRow}>
                  {group.entries.map((log) => (
                    <button
                      key={log.logId}
                      type="button"
                      onClick={() => onLogClick?.(log)}
                      disabled={!onLogClick}
                      style={{ ...datePill, ...(onLogClick ? null : datePillStatic) }}
                    >
                      <span style={datePillDate}>{prettyWeekday(log.performedYmd)}</span>
                      <span style={datePillTime}>{log.performedTimeLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function groupLogsByRoutine(
  logs: ContributionLog[]
): Array<{ routineId: string; routineName: string; entries: ContributionLog[] }> {
  const byRoutine = new Map<string, { routineId: string; routineName: string; entries: ContributionLog[] }>();
  for (const log of logs) {
    const existing = byRoutine.get(log.routineId);
    if (existing) existing.entries.push(log);
    else byRoutine.set(log.routineId, { routineId: log.routineId, routineName: log.routineName, entries: [log] });
  }
  for (const group of byRoutine.values()) {
    group.entries.sort((a, b) => a.performedYmd.localeCompare(b.performedYmd));
  }
  return Array.from(byRoutine.values()).sort((a, b) => {
    const aLatest = a.entries[a.entries.length - 1].performedYmd;
    const bLatest = b.entries[b.entries.length - 1].performedYmd;
    return bLatest.localeCompare(aLatest);
  });
}

function prettyWeekday(ymd: string): string {
  return formatUtcDateLabel(ymd, { weekday: "short", month: "short", day: "numeric" });
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

const barsRowBase: CSSProperties = {
  display: "grid",
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

// Interactive-bar extras layered on top of the base barColumn so the
// keyboard-focus / hover styles work without altering layout metrics.
const barColumnInteractive: CSSProperties = {
  padding: "2px 2px 4px",
};

// ───────── inline expansion styles (mirrors DomainSparklines panel)

const expansionShell: CSSProperties = {
  padding: "10px 12px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.025)",
  display: "grid",
  gap: 8,
};

const expansionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const expansionHeaderText: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
  flexWrap: "wrap",
};

const expansionDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const expansionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.92)",
};

const expansionRange: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.55)",
};

const closeBtn: CSSProperties = {
  width: 24,
  height: 24,
  minHeight: 24,
  padding: 0,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.55)",
  fontSize: 14,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  lineHeight: 1,
  flexShrink: 0,
};

const emptyText: CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.45)",
  fontStyle: "italic",
  padding: "4px 2px",
};

const logList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 4,
};

// Flex row so the routine name and its date pills sit on the same line —
// the original 2-row stack wasted vertical space. Wraps when the row is too
// narrow to fit both halves, so mobile still degrades gracefully.
const groupShell: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "4px 10px",
  padding: "6px 10px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.022)",
};

const groupHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  // Shrinks before the pill row does — long routine names get an ellipsis
  // rather than pushing the pills to the next line.
  flex: "0 1 auto",
};

const logRowAccent: CSSProperties = {
  width: 3,
  height: 22,
  borderRadius: 2,
  flexShrink: 0,
};

const logRowName: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  color: "rgba(255,255,255,0.95)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function countBadge(accent: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 7px",
    borderRadius: 999,
    border: `1px solid ${accent}`,
    color: accent,
    fontSize: 10.5,
    fontWeight: 900,
    letterSpacing: 0.3,
    background: "transparent",
    flexShrink: 0,
  };
}

const substituteBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 7px",
  borderRadius: 999,
  border: "1px solid rgba(132,204,255,0.45)",
  color: "rgba(132,204,255,1)",
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  background: "rgba(132,204,255,0.07)",
  flexShrink: 0,
};

const datePillRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
  // Push the pills toward the right edge when the row has room, but still
  // wrap below on narrow screens.
  marginLeft: "auto",
};

const datePill: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "baseline",
  gap: 5,
  padding: "3px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.95)",
  fontSize: 11,
  fontWeight: 700,
};

const datePillStatic: CSSProperties = {
  cursor: "default",
};

const datePillDate: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.55)",
};

const datePillTime: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.7)",
  whiteSpace: "nowrap",
};
