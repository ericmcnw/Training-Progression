"use client";

// Home Goals section — replaces the bare HabitGrid card in the home left
// column. Frequency goals are primary (the daily rhythm); other goal types
// (performance / volume / one-time completion) sit in a secondary,
// collapsed-by-default subgroup so they're glanceable without leaving home.
//
// Reuses HabitGrid (bare) verbatim for the frequency rows — including its
// compact-row → rich-expand behavior — so this component only adds the
// daily/weekly split, the "other goals" subgroup, and the section chrome.
// To revert the whole rework: render <HabitGrid> directly in HomeShell
// again and delete this file. Nothing else depends on it.

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
  // Split frequency goals: daily-style (calendar grid render) are the daily
  // rhythm shown up front; weekly/monthly (bars render) go behind a toggle.
  const dailyRows = habitRows.filter((r) => getFrequencyRenderMode(r.target) !== "weekly-bars");
  const weeklyRows = habitRows.filter((r) => getFrequencyRenderMode(r.target) === "weekly-bars");

  const [showWeekly, setShowWeekly] = useState(false);
  const [showOther, setShowOther] = useState(false);

  const totalCount = habitRows.length + otherGoals.length;
  const hasFrequency = habitRows.length > 0;

  return (
    <CollapsibleSection
      title="Goals"
      count={totalCount}
      countTone="accent"
      hint="tap a row to expand"
      storageKey="home.goals.open"
      defaultOpen
    >
      {!hasFrequency && otherGoals.length === 0 ? (
        <div style={emptyState}>
          No goals yet. Add a frequency target to a routine, or create a goal from the Plan tab.
        </div>
      ) : null}

      {/* Frequency — daily first, always shown. */}
      {dailyRows.length > 0 ? <HabitGrid rows={dailyRows} today={today} chrome="bare" /> : null}

      {/* Weekly / monthly frequency goals behind a toggle (collapsed by
          default — daily rhythm is what the user checks most). */}
      {weeklyRows.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowWeekly((v) => !v)}
            style={subToggle}
            aria-expanded={showWeekly}
          >
            <span>{showWeekly ? "Hide" : "Show"} {weeklyRows.length} weekly {weeklyRows.length === 1 ? "goal" : "goals"}</span>
            <span style={{ ...subChevron, transform: showWeekly ? "rotate(180deg)" : "none" }} aria-hidden>▾</span>
          </button>
          {showWeekly ? <HabitGrid rows={weeklyRows} today={today} chrome="bare" showDayHeader={false} /> : null}
        </div>
      ) : null}

      {/* Other goals — performance / volume / completion. Secondary subgroup,
          collapsed by default; auto-absent when there are none. */}
      {otherGoals.length > 0 ? (
        <div style={otherShell}>
          <button
            type="button"
            onClick={() => setShowOther((v) => !v)}
            style={subToggle}
            aria-expanded={showOther}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              Other goals
              <span style={otherCount}>{otherGoals.length}</span>
            </span>
            <span style={{ ...subChevron, transform: showOther ? "rotate(180deg)" : "none" }} aria-hidden>▾</span>
          </button>
          {showOther ? (
            <ul style={otherList}>
              {otherGoals.map((g) => (
                <li key={g.id}>
                  <Link href={g.detailHref} style={otherRow}>
                    <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                      <div style={otherName}>
                        {g.name}
                        {g.isAchieved ? <span style={achievedTick} aria-label="achieved">✓</span> : null}
                      </div>
                      <ProgressBar fraction={g.fraction} achieved={g.isAchieved} />
                    </div>
                    <div style={otherMetric}>
                      <span style={otherActual}>{g.actualDisplay}</span>
                      <span style={otherTarget}>/ {g.targetDisplay}</span>
                      <span style={otherTimeframe}>{g.timeframeLabel}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

function ProgressBar({ fraction, achieved }: { fraction: number; achieved: boolean }) {
  const pct = Math.min(100, Math.max(0, Math.round(fraction * 100)));
  const color = achieved ? "rgba(51,255,122,0.9)" : pct >= 60 ? "rgba(132,204,255,0.9)" : "rgba(251,191,36,0.9)";
  return (
    <div style={barTrack} aria-hidden>
      <div style={{ ...barFill, width: `${pct}%`, background: color }} />
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const emptyState: CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.55)",
  padding: "8px 4px",
  lineHeight: 1.5,
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

const subChevron: CSSProperties = {
  fontSize: 10,
  transition: "transform 160ms ease",
  opacity: 0.7,
};

const otherShell: CSSProperties = {
  display: "grid",
  gap: 8,
  borderTop: "1px solid rgba(255,255,255,0.06)",
  paddingTop: 12,
};

const otherCount: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  padding: "1px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "rgba(255,255,255,0.6)",
};

const otherList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 6,
};

const otherRow: CSSProperties = {
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

const otherName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const achievedTick: CSSProperties = {
  color: "rgba(51,255,122,0.9)",
  fontWeight: 900,
  fontSize: 12,
};

const otherMetric: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 1,
  flexShrink: 0,
  textAlign: "right",
};

const otherActual: CSSProperties = { fontSize: 13, fontWeight: 900, lineHeight: 1.1 };
const otherTarget: CSSProperties = { fontSize: 10.5, fontWeight: 700, opacity: 0.6 };
const otherTimeframe: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  opacity: 0.45,
  marginTop: 1,
};

const barTrack: CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: "rgba(255,255,255,0.07)",
  overflow: "hidden",
  minWidth: 90,
};

const barFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
};
