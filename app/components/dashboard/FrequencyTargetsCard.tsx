// Frequency Targets module — compact card on the dashboard listing every
// active FrequencyGoal that isn't already covered by the habit lane (i.e.,
// non-habit-domain goals + group goals). Shows window progress, streak chip,
// and a thin progress bar so the user can scan status at a glance.
//
// Math comes from lib/frequency-state.ts; this component is presentational.

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  frequencyStatusColor,
  frequencyStatusLabel,
  type FrequencyState,
  type FrequencyTarget,
} from "@/lib/frequency-state";
import { domainColor } from "@/lib/routines";

export type FrequencyTargetRow = {
  goalId: string;            // raw FrequencyGoal id (with `fg_` prefix for per-routine)
  goalName: string;
  routineNames: string[];    // for group goals; one entry for single-routine
  primaryDomain: string;     // domain accent — first routine's domain
  isGroup: boolean;
  target: FrequencyTarget;
  state: FrequencyState;
};

export default function FrequencyTargetsCard({ rows }: { rows: FrequencyTargetRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={emptyShell}>
        <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85 }}>No frequency targets</div>
        <div style={{ fontSize: 12, opacity: 0.62, lineHeight: 1.45 }}>
          Frequency targets track how often you complete a routine across a window — like
          &ldquo;3× per week&rdquo;. Create one from the Goals page.
        </div>
        <Link href="/goals?type=FREQUENCY&mode=new" style={emptyCta}>New frequency goal</Link>
      </div>
    );
  }

  return (
    <div style={shell}>
      {rows.map((row) => (
        <FrequencyRow key={row.goalId} row={row} />
      ))}
    </div>
  );
}

function FrequencyRow({ row }: { row: FrequencyTargetRow }) {
  const { state, target } = row;
  const accent = domainColor(row.primaryDomain);
  // Group goals have a dedicated detail page; single-routine `fg_*` goals
  // belong to a specific routine and route there instead.
  const detailHref = row.isGroup
    ? `/goals/group-frequency:${row.goalId}?mode=edit`
    : `/routines/${row.routineNames.length > 0 ? row.goalId.replace(/^fg_/, "") : row.goalId}`;
  const statusColor = frequencyStatusColor(state.currentWindow.status);
  const statusLabel = frequencyStatusLabel(state.currentWindow.status);
  const fraction = Math.min(1, state.currentWindow.progress / Math.max(1, state.currentWindow.target));
  const targetLabel = formatTarget(target);
  const subRoutines = row.routineNames.length === 1
    ? row.routineNames[0]
    : `${row.routineNames.length} routines`;

  return (
    <Link href={detailHref} style={rowCard}>
      <div style={accentBar(accent)} />

      <div style={rowContent}>
        <div style={topLine}>
          <div style={topLineLeft}>
            <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>{row.goalName}</div>
            <div style={metaLine}>
              <span style={{ opacity: 0.78 }}>{subRoutines}</span>
              <span style={{ opacity: 0.45 }}>·</span>
              <span style={{ opacity: 0.78 }}>{targetLabel}</span>
            </div>
          </div>
          <div style={progressLabel}>
            <span style={{ fontSize: 18, fontWeight: 900, color: statusColor, lineHeight: 1 }}>
              {state.currentWindow.progress}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.55, lineHeight: 1 }}>
              / {state.currentWindow.target}
            </span>
          </div>
        </div>

        <div style={progressTrack}>
          <div
            style={{
              ...progressFill,
              width: `${Math.max(2, fraction * 100)}%`,
              background: `linear-gradient(90deg, ${withAlpha(statusColor, 0.6)}, ${statusColor})`,
            }}
          />
        </div>

        <div style={bottomRow}>
          <span style={{ ...statusPill, color: statusColor, borderColor: statusColor }}>{statusLabel}</span>
          {state.windowStreak > 0 ? (
            <span style={streakChip}>
              <FlameIcon /> {state.windowStreak} window{state.windowStreak === 1 ? "" : "s"}
            </span>
          ) : state.currentDayStreak > 0 ? (
            <span style={streakChip}>
              <FlameIcon /> {state.currentDayStreak} day{state.currentDayStreak === 1 ? "" : "s"}
            </span>
          ) : null}
          {state.longestWindowStreak > state.windowStreak && state.longestWindowStreak > 1 ? (
            <span style={subStat}>Best: {state.longestWindowStreak}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function FlameIcon() {
  return (
    <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
      <path
        d="M5 0.5C5 2.5 7 3 7 5C7 6 6.5 6.5 6 6.5C6 5 5 4.5 5 4.5C5 5.5 4 6 4 7.5C4 8.5 4.5 9 5 9C5.5 9 6 8.5 6 8C6.8 8.5 7.5 9.5 7.5 10.5C7.5 11.3 6.5 11.5 5 11.5C3.5 11.5 2.5 10.3 2.5 9C2.5 6.5 5 5.5 5 0.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatTarget(t: FrequencyTarget): string {
  const unit = t.targetUnit === "DAY" ? "day" : t.targetUnit === "WEEK" ? "week" : "month";
  const intervalLabel = t.targetInterval === 1 ? unit : `${t.targetInterval} ${unit}s`;
  return `${t.targetCount}× per ${intervalLabel}`;
}

function withAlpha(rgba: string, alpha: number): string {
  // accepts "rgba(r,g,b,a)" — replace the trailing alpha
  const match = rgba.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return rgba;
  const parts = match[1].split(",").map((p) => p.trim());
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

const shell: CSSProperties = {
  display: "grid",
  gap: 8,
};

const emptyShell: CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "16px 18px",
  borderRadius: 14,
  border: "1px dashed rgba(100,180,255,0.28)",
  background: "rgba(100,180,255,0.04)",
  justifyItems: "start",
};

const emptyCta: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(100,180,255,0.95)",
  textDecoration: "none",
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(100,180,255,0.4)",
  background: "rgba(100,180,255,0.08)",
};

const rowCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "4px 1fr",
  alignItems: "stretch",
  gap: 10,
  padding: "10px 12px 10px 0",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
  color: "inherit",
  textDecoration: "none",
  overflow: "hidden",
};

function accentBar(color: string): CSSProperties {
  return {
    width: 4,
    borderRadius: "3px 0 0 3px",
    background: color,
    opacity: 0.85,
  };
}

const rowContent: CSSProperties = {
  display: "grid",
  gap: 8,
  paddingLeft: 8,
};

const topLine: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const topLineLeft: CSSProperties = {
  display: "grid",
  gap: 3,
  minWidth: 0,
  flex: 1,
};

const metaLine: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  fontSize: 11.5,
};

const progressLabel: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 3,
  flexShrink: 0,
};

const progressTrack: CSSProperties = {
  height: 6,
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.04)",
  overflow: "hidden",
};

const progressFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 200ms ease",
};

const bottomRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const statusPill: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  border: "1px solid",
  padding: "2px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.02)",
};

const streakChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(251,146,60,0.95)",
  border: "1px solid rgba(251,146,60,0.32)",
  background: "rgba(251,146,60,0.08)",
  padding: "2px 7px",
  borderRadius: 999,
};

const subStat: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  opacity: 0.55,
};
