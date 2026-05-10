// Frequency targets list — single-row, dense layout. Renders one row per
// active FrequencyGoal that isn't already covered by the habit lane.
//
// Each row shows: domain accent · goal name · routine summary · progress bar
// · X/Y count · streak. Status is encoded in the bar color so we don't need
// a redundant pill.

import Link from "next/link";
import type { CSSProperties } from "react";
import {
  frequencyStatusColor,
  type FrequencyState,
  type FrequencyTarget,
} from "@/lib/frequency-state";
import { domainColor } from "@/lib/routines";

export type FrequencyTargetRow = {
  goalId: string;
  goalName: string;
  routineNames: string[];
  primaryDomain: string;
  isGroup: boolean;
  target: FrequencyTarget;
  state: FrequencyState;
};

export default function FrequencyTargetsCard({ rows }: { rows: FrequencyTargetRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={emptyInline}>
        <span style={{ opacity: 0.65 }}>No frequency targets yet —</span>
        <Link href="/goals?type=FREQUENCY&mode=new" style={emptyInlineLink}>
          create one
        </Link>
        <span style={{ opacity: 0.5, fontSize: 11 }}>
          (e.g. &ldquo;3× per week&rdquo;)
        </span>
      </div>
    );
  }

  return (
    <div style={listShell}>
      {rows.map((row) => (
        <FrequencyRow key={row.goalId} row={row} />
      ))}
    </div>
  );
}

function FrequencyRow({ row }: { row: FrequencyTargetRow }) {
  const { state, target } = row;
  const accent = domainColor(row.primaryDomain);
  const statusColor = frequencyStatusColor(state.currentWindow.status);
  const detailHref = row.isGroup
    ? `/goals/group-frequency:${row.goalId}?mode=edit`
    : `/routines/${row.goalId.replace(/^fg_/, "")}`;

  const fraction = Math.min(1, state.currentWindow.progress / Math.max(1, state.currentWindow.target));
  const targetLabel = formatTarget(target);
  const routineSummary = summarizeRoutines(row.routineNames);
  const streakValue = state.windowStreak > 0 ? state.windowStreak : state.currentDayStreak;
  const streakUnit = state.windowStreak > 0 ? "wk" : "d";

  return (
    <Link href={detailHref} style={rowCard}>
      <div style={{ ...rowAccent, background: accent }} />

      <div style={col1}>
        <div style={nameLine}>
          <span style={nameText}>{row.goalName}</span>
          <span style={subText}>· {targetLabel}</span>
        </div>
        <div style={routineLine}>{routineSummary}</div>
      </div>

      <div style={progressArea}>
        <div style={progressTrack}>
          <div
            style={{
              ...progressFill,
              width: `${Math.max(2, fraction * 100)}%`,
              background: statusColor,
            }}
          />
        </div>
      </div>

      <div style={progressNumber}>
        <span style={{ ...progressNumberValue, color: statusColor }}>
          {state.currentWindow.progress}
        </span>
        <span style={progressNumberDenom}>/{state.currentWindow.target}</span>
      </div>

      <div style={trailing}>
        {streakValue > 0 ? (
          <span style={streakChip}>
            {streakValue}
            <span style={streakUnitText}>{streakUnit}</span>
          </span>
        ) : (
          <span style={{ ...streakChip, opacity: 0.35 }}>—</span>
        )}
      </div>
    </Link>
  );
}

function formatTarget(t: FrequencyTarget): string {
  const unit = t.targetUnit === "DAY" ? "day" : t.targetUnit === "WEEK" ? "week" : "month";
  if (t.targetInterval === 1) return `${t.targetCount}× / ${unit}`;
  return `${t.targetCount}× / ${t.targetInterval} ${unit}s`;
}

function summarizeRoutines(names: string[]): string {
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

const listShell: CSSProperties = {
  display: "grid",
  gap: 4,
};

const emptyInline: CSSProperties = {
  fontSize: 12,
  padding: "10px 4px",
  display: "inline-flex",
  gap: 5,
  flexWrap: "wrap",
  alignItems: "center",
};

const emptyInlineLink: CSSProperties = {
  color: "rgba(100,180,255,0.95)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const rowCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "3px minmax(120px, 1.7fr) minmax(72px, 1.6fr) 48px 50px",
  gap: 9,
  alignItems: "center",
  padding: "6px 8px 6px 0",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.015)",
  color: "inherit",
  textDecoration: "none",
  minHeight: 36,
};

const rowAccent: CSSProperties = {
  height: 22,
  width: 3,
  borderRadius: "0 2px 2px 0",
};

const col1: CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 1,
};

const nameLine: CSSProperties = {
  display: "flex",
  gap: 4,
  alignItems: "baseline",
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const nameText: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  lineHeight: 1.15,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const subText: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  opacity: 0.55,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const routineLine: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 500,
  opacity: 0.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const progressArea: CSSProperties = {
  display: "flex",
  alignItems: "center",
  minWidth: 0,
};

const progressTrack: CSSProperties = {
  height: 5,
  width: "100%",
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

const progressNumber: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
  gap: 1,
};

const progressNumberValue: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1,
};

const progressNumberDenom: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  opacity: 0.55,
};

const trailing: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
};

const streakChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 1,
  fontSize: 13,
  fontWeight: 900,
  color: "rgba(251,146,60,0.95)",
  lineHeight: 1,
};

const streakUnitText: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  opacity: 0.65,
  marginLeft: 1,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};
