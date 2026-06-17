"use client";

// Home Goals section. Three shape-based groups, not type-based:
//
//   Daily     — daily-style frequency goals (calendar-grid render). The
//               everyday rhythm; always shown.
//   Recurring — non-daily frequency goals (weekly/monthly) AND per-window
//               volume goals (run 5mi/week, 100mi/month). Both accumulate
//               toward a window target and read identically, so they share
//               a group and the bars-vs-target visual. Behind a toggle.
//   Other     — one-off / PR goals (squat 1RM, send a V8). Scalar progress
//               bars. Behind a toggle.
//
// Reuses HabitGrid (bare) for the frequency rows verbatim. Recurring volume
// goals render via a small inline bars row fed from the goal insight's
// history series. Fully additive — revert by pointing HomeShell back at
// <HabitGrid> and deleting this file + lib/home-goals.ts.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type { HabitRow } from "./types";
import type { HomeOtherGoal } from "@/lib/home-goals";
import HabitGrid from "./HabitGrid";
import CollapsibleSection from "./CollapsibleSection";
import { getFrequencyRenderMode } from "@/lib/frequency-state";

export default function HomeGoalsSection({
  habitRows,
  today,
  otherGoals,
}: {
  habitRows: HabitRow[];
  today: string;
  otherGoals: HomeOtherGoal[];
}) {
  const dailyRows = habitRows.filter((r) => getFrequencyRenderMode(r.target) !== "weekly-bars");
  const weeklyRows = habitRows.filter((r) => getFrequencyRenderMode(r.target) === "weekly-bars");
  const recurringGoals = otherGoals.filter((g) => g.shape === "recurring");
  const oneoffGoals = otherGoals.filter((g) => g.shape === "oneoff");

  const [showRecurring, setShowRecurring] = useState(false);
  const [showOther, setShowOther] = useState(false);

  const recurringCount = weeklyRows.length + recurringGoals.length;
  const totalCount = habitRows.length + otherGoals.length;
  const isEmpty = totalCount === 0;
  // Only label the daily block when there's a sibling group to distinguish
  // it from — a lone group needs no header.
  const showGroupLabels = dailyRows.length > 0 && (recurringCount > 0 || oneoffGoals.length > 0);

  return (
    <CollapsibleSection
      title="Goals"
      count={totalCount}
      countTone="accent"
      hint="tap a row to expand"
      storageKey="home.goals.open"
      defaultOpen
    >
      {isEmpty ? (
        <div style={emptyState}>
          No goals yet. Add a frequency target to a routine, or create a goal from the Plan tab.
        </div>
      ) : null}

      {/* Daily */}
      {dailyRows.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {showGroupLabels ? <div style={groupLabel}>Daily</div> : null}
          <HabitGrid rows={dailyRows} today={today} chrome="bare" />
        </div>
      ) : null}

      {/* Recurring — weekly/monthly frequency + per-window volume goals. */}
      {recurringCount > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowRecurring((v) => !v)}
            style={subToggle}
            aria-expanded={showRecurring}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              Recurring
              <span style={subCount}>{recurringCount}</span>
            </span>
            <span style={{ ...subChevron, transform: showRecurring ? "rotate(180deg)" : "none" }} aria-hidden>▾</span>
          </button>
          {showRecurring ? (
            <div style={{ display: "grid", gap: 8 }}>
              {weeklyRows.length > 0 ? (
                <HabitGrid rows={weeklyRows} today={today} chrome="bare" showDayHeader={false} />
              ) : null}
              {recurringGoals.length > 0 ? (
                <ul style={plainList}>
                  {recurringGoals.map((g) => (
                    <li key={g.id}>
                      <RecurringGoalRow goal={g} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Other — one-off / PR goals (scalar progress). */}
      {oneoffGoals.length > 0 ? (
        <div style={otherShell}>
          <button
            type="button"
            onClick={() => setShowOther((v) => !v)}
            style={subToggle}
            aria-expanded={showOther}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              Other goals
              <span style={subCount}>{oneoffGoals.length}</span>
            </span>
            <span style={{ ...subChevron, transform: showOther ? "rotate(180deg)" : "none" }} aria-hidden>▾</span>
          </button>
          {showOther ? (
            <ul style={plainList}>
              {oneoffGoals.map((g) => (
                <li key={g.id}>
                  <ScalarGoalRow goal={g} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

// ── recurring (per-window) goal — interactive bars vs target ─────────────────
// Not a full-row Link: the bars are tappable to select a window, so wrapping
// them in an anchor would hijack the tap into navigation. The name links to
// the goal detail; the bars stay interactive.
function RecurringGoalRow({ goal }: { goal: HomeOtherGoal }) {
  return (
    <div style={recurringRow}>
      <Link href={goal.detailHref} style={recurringNameLink}>
        <span style={goalName}>{goal.name}</span>
        <span style={nameChevron} aria-hidden>›</span>
      </Link>
      <InteractiveGoalBars
        history={goal.history}
        target={goal.targetValue}
        unit={unitSuffix(goal.targetDisplay)}
        currentDisplay={goal.actualDisplay}
        targetDisplay={goal.targetDisplay}
      />
    </div>
  );
}

// 8-window bar chart with a dashed target line + a tap-to-select readout.
// Defaults to the latest (in-progress) window; tapping any bar updates the
// readout line above. Bars meeting/exceeding target are green, short ones
// amber; the selected bar is ringed.
function InteractiveGoalBars({
  history,
  target,
  unit,
  currentDisplay,
  targetDisplay,
}: {
  history: { label: string; value: number }[];
  target: number;
  unit: string;
  currentDisplay: string;
  targetDisplay: string;
}) {
  const last = history.length - 1;
  const [selected, setSelected] = useState<number>(last);

  if (history.length === 0) {
    return (
      <div style={{ ...barRow, alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700 }}>
        No history yet
      </div>
    );
  }

  // Clamp in case the selected index outruns a shorter history on re-render.
  const idx = Math.min(selected, last);
  const point = history[idx];
  const isCurrent = idx === last;
  const met = target > 0 && point.value >= target;
  // The current (in-progress) window has a nicely formatted actualDisplay;
  // past windows only have raw values, so format those with the parsed unit.
  const valueLabel = isCurrent ? currentDisplay : `${round(point.value)}${unit ? ` ${unit}` : ""}`;

  const maxValue = Math.max(target, ...history.map((h) => h.value));
  const scaleMax = maxValue > 0 ? maxValue * 1.12 : 1;
  const targetPct = scaleMax > 0 ? Math.min(100, (target / scaleMax) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={readoutLine}>
        <span style={readoutWindow}>
          {point.label}
          {isCurrent ? <span style={readoutNow}>now</span> : null}
        </span>
        <span style={metricInline}>
          <span style={{ ...actualText, color: met ? "rgba(120,235,170,0.95)" : actualText.color }}>{valueLabel}</span>
          <span style={targetText}>/ {targetDisplay}</span>
        </span>
      </div>
      <div style={barOuter}>
        {target > 0 ? <div style={{ ...targetLine, bottom: `${targetPct}%` }} aria-hidden /> : null}
        <div style={barRow}>
          {history.map((h, i) => {
            const pct = scaleMax > 0 ? Math.max(3, (h.value / scaleMax) * 100) : 3;
            const barMet = target > 0 && h.value >= target;
            const sel = i === idx;
            return (
              <button
                key={`${h.label}-${i}`}
                type="button"
                onClick={() => setSelected(i)}
                style={barBtn}
                aria-label={`${h.label}: ${round(h.value)}${target > 0 ? ` of ${round(target)}` : ""}`}
                aria-pressed={sel}
              >
                <div
                  style={{
                    ...bar,
                    height: `${pct}%`,
                    background: barMet ? "rgba(51,255,122,0.85)" : "rgba(251,191,36,0.8)",
                    opacity: sel ? 1 : 0.55,
                    outline: sel ? "1.5px solid rgba(255,255,255,0.65)" : "none",
                    outlineOffset: 1,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Parse the unit suffix out of a formatted target string ("5 mi" → "mi",
// "3000 ft" → "ft", "12 sessions" → "sessions"). Empty when there's no
// trailing unit (bare counts). Strips the leading number/decimals/commas.
function unitSuffix(targetDisplay: string): string {
  return targetDisplay.replace(/^[\d.,\s]+/, "").trim();
}

// ── one-off / PR goal — scalar progress ──────────────────────────────────────
function ScalarGoalRow({ goal }: { goal: HomeOtherGoal }) {
  const pct = Math.min(100, Math.max(0, Math.round(goal.fraction * 100)));
  const color = goal.isAchieved ? "rgba(51,255,122,0.9)" : pct >= 60 ? "rgba(132,204,255,0.9)" : "rgba(251,191,36,0.9)";
  return (
    <Link href={goal.detailHref} style={goalRow}>
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <div style={goalName}>
          {goal.name}
          {goal.isAchieved ? <span style={achievedTick} aria-label="achieved">✓</span> : null}
        </div>
        <div style={barTrack} aria-hidden>
          <div style={{ ...barTrackFill, width: `${pct}%`, background: color }} />
        </div>
      </div>
      <div style={otherMetric}>
        <span style={actualText}>{goal.actualDisplay}</span>
        <span style={targetText}>/ {goal.targetDisplay}</span>
        <span style={timeframeText}>{goal.timeframeLabel}</span>
      </div>
    </Link>
  );
}

function round(v: number): string {
  if (Math.abs(v) >= 100) return String(Math.round(v));
  return (Math.round(v * 10) / 10).toString();
}

// ── styles ──────────────────────────────────────────────────────────────────
const emptyState: CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
  padding: "8px 4px",
  lineHeight: 1.5,
};

const groupLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
  paddingLeft: 2,
};

const subToggle: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  margin: 0,
  padding: "9px 12px",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  cursor: "pointer",
  color: "rgba(255,255,255,0.72)",
  fontSize: 12,
  fontWeight: 800,
  minHeight: 40,
};

const subChevron: CSSProperties = { fontSize: 10, transition: "transform 160ms ease", opacity: 0.7 };

const subCount: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  padding: "1px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "rgba(255,255,255,0.6)",
};

const otherShell: CSSProperties = {
  display: "grid",
  gap: 8,
  borderTop: "1px solid rgba(255,255,255,0.06)",
  paddingTop: 12,
};

const plainList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 6,
};

const goalRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.018)",
  textDecoration: "none",
  color: "inherit",
};

const goalName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const achievedTick: CSSProperties = { color: "rgba(51,255,122,0.9)", fontWeight: 900, fontSize: 12 };

const metricInline: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 4,
  flexShrink: 0,
};

const otherMetric: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 1,
  flexShrink: 0,
  textAlign: "right",
};

const actualText: CSSProperties = { fontSize: 13, fontWeight: 900, lineHeight: 1.1 };
const targetText: CSSProperties = { fontSize: 10.5, fontWeight: 700, opacity: 0.6 };
const timeframeText: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  opacity: 0.45,
  marginTop: 1,
};

// scalar bar
const barTrack: CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: "rgba(255,255,255,0.07)",
  overflow: "hidden",
  minWidth: 90,
};
const barTrackFill: CSSProperties = { height: "100%", borderRadius: 999 };

// recurring row + interactive bars
const recurringRow: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.018)",
};

const recurringNameLink: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  textDecoration: "none",
  color: "inherit",
  minWidth: 0,
};

const nameChevron: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "rgba(255,255,255,0.35)",
  flexShrink: 0,
};

const readoutLine: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 10,
};

const readoutWindow: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.6)",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
};

const readoutNow: CSSProperties = {
  fontSize: 8.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "1px 6px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.6)",
};

const barOuter: CSSProperties = {
  position: "relative",
  width: "100%",
};
const barRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 3,
  height: 40,
  width: "100%",
};
const barBtn: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  background: "transparent",
  border: "none",
  padding: 0,
  margin: 0,
  flex: 1,
  height: "100%",
  display: "flex",
  alignItems: "flex-end",
  minWidth: 0,
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};
const bar: CSSProperties = {
  width: "100%",
  borderRadius: "3px 3px 2px 2px",
  minHeight: 2,
  transition: "opacity 120ms ease",
};
const targetLine: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  height: 0,
  borderTop: "1px dashed rgba(255,255,255,0.45)",
  zIndex: 1,
  pointerEvents: "none",
};
