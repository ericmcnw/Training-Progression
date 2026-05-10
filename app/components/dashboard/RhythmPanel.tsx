// Rhythm panel — merged dashboard surface combining habits and frequency
// targets into a single panel. Owns the panel chrome (border, header,
// padding) so the two list components can stay tightly focused on row
// rendering.
//
// Subsections render with subtle in-panel headers (no extra borders) so the
// composite reads as one cohesive block. Sections collapse cleanly when
// empty — the panel hides itself entirely if both lists are empty.

import type { CSSProperties } from "react";
import HabitLane, { type HabitLaneRow } from "./HabitLane";
import FrequencyTargetsCard, { type FrequencyTargetRow } from "./FrequencyTargetsCard";

export default function RhythmPanel({
  habits,
  frequencyTargets,
  today,
  panelStyle,
  panelHeaderStyle,
}: {
  habits: HabitLaneRow[];
  frequencyTargets: FrequencyTargetRow[];
  today: string;
  panelStyle: CSSProperties;
  panelHeaderStyle: CSSProperties;
}) {
  const hasHabits = habits.length > 0;
  const hasTargets = frequencyTargets.length > 0;

  // Suppress the entire panel when there is nothing to show — saves vertical
  // space for users who haven't set any of these up.
  if (!hasHabits && !hasTargets) return null;

  // Surface a couple of header-level signals so the user can see what matters
  // before scanning rows: total at-risk count and best running streak.
  const atRiskCount =
    habits.filter((h) => h.state.currentWindow.status === "at_risk").length +
    frequencyTargets.filter((t) => t.state.currentWindow.status === "at_risk").length;
  const bestStreak = Math.max(
    0,
    ...habits.map((h) => Math.max(h.state.windowStreak, h.state.currentDayStreak)),
    ...frequencyTargets.map((t) => Math.max(t.state.windowStreak, t.state.currentDayStreak))
  );

  return (
    <section style={panelStyle}>
      <div style={{ ...panelHeaderStyle, ...headerRowStyle }}>
        <span>RHYTHM</span>
        <div style={headerSignals}>
          {atRiskCount > 0 ? (
            <span style={atRiskBadge} title="Habits or targets at risk this window">
              <span style={atRiskDot} /> {atRiskCount} at risk
            </span>
          ) : null}
          {bestStreak > 0 ? (
            <span style={bestBadge} title="Best running streak">
              <FlameIcon /> {bestStreak}
            </span>
          ) : null}
        </div>
      </div>

      <div style={bodyStyle}>
        {hasHabits ? (
          <Subsection
            label="HABITS"
            count={habits.length}
            sublabel="last 7 days · daily completion"
          >
            <HabitLane rows={habits} today={today} trailingDays={7} />
          </Subsection>
        ) : null}

        {hasHabits && hasTargets ? <div style={dividerStyle} /> : null}

        {hasTargets ? (
          <Subsection
            label="FREQUENCY TARGETS"
            count={frequencyTargets.length}
            sublabel="window progress · group goals included"
          >
            <FrequencyTargetsCard rows={frequencyTargets} />
          </Subsection>
        ) : null}
      </div>
    </section>
  );
}

function Subsection({
  label,
  count,
  sublabel,
  children,
}: {
  label: string;
  count: number;
  sublabel: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={subheadStyle}>
        <span style={subheadLabel}>{label}</span>
        <span style={subheadCount}>{count}</span>
        <span style={subheadSublabel}>{sublabel}</span>
      </div>
      {children}
    </div>
  );
}

function FlameIcon() {
  return (
    <svg width="9" height="11" viewBox="0 0 10 12" fill="none" aria-hidden="true">
      <path
        d="M5 0.5C5 2.5 7 3 7 5C7 6 6.5 6.5 6 6.5C6 5 5 4.5 5 4.5C5 5.5 4 6 4 7.5C4 8.5 4.5 9 5 9C5.5 9 6 8.5 6 8C6.8 8.5 7.5 9.5 7.5 10.5C7.5 11.3 6.5 11.5 5 11.5C3.5 11.5 2.5 10.3 2.5 9C2.5 6.5 5 5.5 5 0.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

const headerRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const headerSignals: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "none",
};

const atRiskBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10.5,
  fontWeight: 800,
  color: "rgba(248,113,113,0.95)",
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.35)",
  padding: "2px 7px",
  borderRadius: 999,
};

const atRiskDot: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: 999,
  background: "rgba(248,113,113,0.95)",
};

const bestBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10.5,
  fontWeight: 800,
  color: "rgba(251,191,36,0.95)",
  background: "rgba(251,191,36,0.08)",
  border: "1px solid rgba(251,191,36,0.32)",
  padding: "2px 7px",
  borderRadius: 999,
};

const bodyStyle: CSSProperties = {
  padding: "10px 14px 12px",
  display: "grid",
  gap: 12,
};

const subheadStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  paddingLeft: 4,
};

const subheadLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  opacity: 0.65,
};

const subheadCount: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.45,
  padding: "1px 5px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.05)",
};

const subheadSublabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  opacity: 0.4,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.05)",
  margin: "2px 0",
};
