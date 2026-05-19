"use client";

// HabitGrid — 7-day grid of frequency-goal rows. Tapping a row expands an
// inline detail panel below it (30-day strip + stats + actions). Only one
// row expanded at a time. No modal popovers.
//
// The dot strip uses CSS grid (not flex) so every dot lands at exactly 1/7
// of the column width, regardless of intrinsic size.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type { HabitRow } from "./types";
import DrawerLogButton from "@/app/routines/DrawerLogButton";
import WeeklyFrequencyBars from "@/app/components/dashboard/WeeklyFrequencyBars";
import { COLOR, RADIUS, cardSurface, cardHeader, cardTitle, cardHint } from "./tokens";
import { frequencyStatusColor, getFrequencyRenderMode } from "@/lib/frequency-state";

type Props = {
  rows: HabitRow[];
  today: string;
};

export default function HabitGrid({ rows, today }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section id="habits-grid" style={cardSurface}>
        <header style={cardHeader}>
          <span style={cardTitle}>Frequency Goals</span>
        </header>
        <div style={emptyState}>
          No frequency goals yet. Add one to a routine (set how often you want to do it) and it&apos;ll show here.
        </div>
      </section>
    );
  }

  // 7-day strip ending today.
  const last7: string[] = [];
  for (let i = 6; i >= 0; i--) last7.push(shiftYmd(today, -i));

  return (
    <section id="habits-grid" style={cardSurface}>
      <header style={cardHeader}>
        <span style={cardTitle}>Frequency Goals</span>
        <span style={cardHint}>last 7 days · tap row to expand</span>
      </header>

      {/* Day-label header row. Same grid columns as the habit rows so the
          weekday letters align exactly with the dot cells below. */}
      <div style={headerRow} className="homeV2HabitHeader">
        <div className="homeV2HabitHeaderSpacer" />
        <div style={dayLabelGrid}>
          {last7.map((ymd) => (
            <span key={ymd} style={{ ...dayLabelText, ...(ymd === today ? dayLabelToday : null) }}>
              {dayInitial(ymd)}
            </span>
          ))}
        </div>
        <div style={trailingHeaderText}>streak · this wk</div>
      </div>

      <ul style={list}>
        {rows.map((row) => {
          const accent = frequencyStatusColor(row.status);
          const expanded = openId === row.goalId;
          // Streak unit follows the target shape: daily-style targets use day
          // streaks; weekly/monthly targets use window streaks.
          const renderMode = getFrequencyRenderMode(row.target);
          const streakUnit_ = renderMode === "weekly-bars" ? "w" : "d";
          return (
            <li key={row.goalId}>
              <button
                type="button"
                onClick={() => setOpenId((current) => (current === row.goalId ? null : row.goalId))}
                className="homeV2HabitRow"
                aria-expanded={expanded}
              >
                <div style={nameColumn} className="homeV2HabitName">
                  <span style={{ ...accentDot, background: accent }} aria-hidden />
                  <span style={nameText}>{row.goalName}</span>
                  {row.isGroup ? (
                    <span style={groupBadge} title={`Group goal — ${row.primaryRoutines.map((r) => r.name).join(", ")}`}>
                      ×{row.primaryRoutines.length}
                    </span>
                  ) : null}
                </div>
                <div style={dotStripGrid}>
                  {last7.map((ymd) => {
                    let state = row.trailing30.find((d) => d.ymd === ymd)?.state ?? "rest";
                    // Quiet the compact strip for flexible weekly/monthly
                    // goals — the underlying classifier marks open-window
                    // days as "missed" when behind pace, but in the row
                    // header those red dots are misleading (the user can
                    // still hit the window). The expansion's bars view
                    // shows the real story.
                    if (renderMode === "weekly-bars" && state === "missed") {
                      state = "rest";
                    }
                    return <span key={ymd} style={dotCell(state, ymd === today, accent)} />;
                  })}
                </div>
                <div style={trailingCol}>
                  {row.currentStreak > 0 ? (
                    <span style={streakPill}>
                      <span style={streakFlame} aria-hidden>🔥</span>
                      <span style={streakValue}>{row.currentStreak}</span>
                      <span style={streakUnit}>{streakUnit_}</span>
                    </span>
                  ) : (
                    <span style={streakPillMuted}>—</span>
                  )}
                  <span
                    style={fractionPill(row.status)}
                    title={`This ${row.target?.targetUnit === "MONTH" ? "month" : "week"}: ${row.weekFraction.progress} of ${Math.max(row.weekFraction.target, row.weekFraction.progress)}`}
                  >
                    {row.weekFraction.progress}/{Math.max(row.weekFraction.target, row.weekFraction.progress)}
                  </span>
                  <span style={{ ...chevron, transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }} aria-hidden>›</span>
                </div>
              </button>

              {expanded ? <ExpandedDetail row={row} today={today} /> : null}
            </li>
          );
        })}
      </ul>

      <style>{`
        /* Fixed trailing column width so the header "T W T F S S M" labels
           line up exactly over the dot cells in each row.
           Note: avoiding 'all: unset' on the button — it left display in an
           inconsistent state that prevented the grid from filling the parent
           width. Resetting only what's needed instead. */
        .homeV2HabitRow {
          appearance: none;
          -webkit-appearance: none;
          margin: 0;
          font: inherit;
          color: inherit;
          text-align: left;
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: minmax(110px, 1.4fr) minmax(0, 2.6fr) 110px;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.018);
          transition: border-color 120ms ease, background 120ms ease;
          min-height: 44px;
        }
        .homeV2HabitRow:hover,
        .homeV2HabitRow:focus-visible {
          border-color: rgba(255,255,255,0.20);
          background: rgba(255,255,255,0.035);
        }
        .homeV2HabitHeader {
          display: grid;
          grid-template-columns: minmax(110px, 1.4fr) minmax(0, 2.6fr) 110px;
          align-items: center;
          gap: 10px;
          padding: 0 12px 2px;
        }
        @media (max-width: 540px) {
          /* Two-row layout on mobile so long goal names don't truncate
             behind the dot strip. Row 1: name spans full width. Row 2:
             dots + streak/fraction/chevron. The header drops its spacer
             column so day-initials still align over the dots below. */
          .homeV2HabitRow {
            grid-template-columns: minmax(0, 1fr) 96px;
            grid-template-rows: auto auto;
            gap: 4px 8px;
            padding-inline: 10px;
          }
          .homeV2HabitRow .homeV2HabitName {
            grid-column: 1 / -1;
            min-width: 0;
          }
          .homeV2HabitHeader {
            grid-template-columns: minmax(0, 1fr) 96px;
            padding-inline: 10px;
          }
          .homeV2HabitHeader .homeV2HabitHeaderSpacer {
            display: none;
          }
        }
        @media (max-width: 400px) {
          .homeV2HabitRow,
          .homeV2HabitHeader {
            grid-template-columns: minmax(0, 1fr) 88px;
            gap: 4px 6px;
            padding-inline: 8px;
            font-size: 12px;
          }
        }
      `}</style>
    </section>
  );
}

// ───────────────────────────── inline expansion panel

function ExpandedDetail({ row, today }: { row: HabitRow; today: string }) {
  // Render mode is picked from the goal's target shape — daily-style targets
  // get the calendar grid, flexible weekly/monthly targets get the bars view
  // (which is more meaningful for "3× per week" since a 30-day grid would be
  // mostly empty cells).
  const renderMode = getFrequencyRenderMode(row.target);

  if (renderMode === "weekly-bars") {
    return (
      <div style={expansionShell}>
        <WeeklyFrequencyBars target={row.target!} state={row.state} today={today} />
        <GoalActionRow row={row} today={today} />
      </div>
    );
  }

  // Daily-grid path — calendar-aligned 30-day view + stat tiles.
  // Padding logic: first real cell lands in its correct DOW column, end is
  // padded so the row fills cleanly.
  const cells: Array<HabitRow["trailing30"][number] | null> = [];
  if (row.trailing30.length > 0) {
    const firstDow = new Date(`${row.trailing30[0].ymd}T00:00:00.000Z`).getUTCDay();
    for (let i = 0; i < firstDow; i++) cells.push(null);
    cells.push(...row.trailing30);
    while (cells.length % 7 !== 0) cells.push(null);
  }
  const lines: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) lines.push(cells.slice(i, i + 7));

  const todayDow = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const completedDays = row.trailing30.filter((d) => d.state === "done").length;
  const coveredDays = row.trailing30.filter((d) => d.state === "covered").length;
  const missedDays = row.trailing30.filter((d) => d.state === "missed").length;

  return (
    <div style={expansionShell}>
      <div style={expansionGrid}>
        <div style={expansionPanel}>
          <div style={expansionLabel}>Last 30 days</div>
          <div style={dotGridShell}>
            <div style={dotGridRow}>
              {DAY_INITIALS.map((d, i) => (
                <span
                  key={i}
                  style={{
                    ...weekdayHeader,
                    ...(i === todayDow ? weekdayHeaderToday : null),
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
            {lines.map((line, lineIdx) => (
              <div key={lineIdx} style={dotGridRow}>
                {Array.from({ length: 7 }).map((_, dotIdx) => {
                  const cell = line[dotIdx];
                  if (!cell) return <span key={dotIdx} style={dotPlaceholder} />;
                  return (
                    <span
                      key={cell.ymd}
                      style={detailDot(cell.state, cell.ymd === today)}
                      title={`${cell.ymd} — ${cell.state}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div style={statRow}>
          <StatTile label="Done" value={`${completedDays}d`} tone="done" />
          {coveredDays > 0 ? <StatTile label="Covered" value={`${coveredDays}d`} tone="covered" /> : null}
          <StatTile label="Missed" value={`${missedDays}d`} tone="missed" />
          <StatTile label="Best" value={`${row.longestStreak}d`} tone="best" />
        </div>
      </div>

      <GoalActionRow row={row} today={today} />
    </div>
  );
}

// Action row at the bottom of any expansion. For per-routine goals it's a
// single big "Log today" button + Edit link. For group goals it lists each
// primary routine with its own log button so the user can log against the
// specific routine that fired (a Pull Day vs a Push Day).
function GoalActionRow({ row, today }: { row: HabitRow; today: string }) {
  if (!row.isGroup) {
    return (
      <div style={actionRow}>
        <DrawerLogButton
          routineId={row.routineId}
          defaultDate={today}
          label="Log today"
          className=""
          style={primaryAction}
        />
        <Link href={`/routines/${row.routineId}`} style={secondaryAction}>
          Edit
        </Link>
      </div>
    );
  }

  return (
    <div style={groupActionShell}>
      <div style={groupActionLabel}>Log a routine</div>
      <div style={groupActionList}>
        {row.primaryRoutines.map((r) => (
          <DrawerLogButton
            key={r.id}
            routineId={r.id}
            defaultDate={today}
            label={r.name}
            className=""
            style={groupRoutineButton}
          />
        ))}
        {row.substituteRoutines.length > 0 ? (
          <>
            <div style={groupActionDivider}>Substitutes</div>
            {row.substituteRoutines.map((r) => (
              <DrawerLogButton
                key={r.id}
                routineId={r.id}
                defaultDate={today}
                label={r.name}
                className=""
                style={groupSubstituteButton}
              />
            ))}
          </>
        ) : null}
      </div>
      <div style={groupActionFooter}>
        <Link href={`/goals/${encodeURIComponent(row.goalId.startsWith("fg_") ? row.goalId : `group-frequency:${row.goalId}`)}`} style={secondaryAction}>
          Edit goal
        </Link>
      </div>
    </div>
  );
}

type StatTone = "done" | "covered" | "missed" | "best";

// Tone borrows the same swatch palette the heatmap uses, so the counters
// read at a glance as "the yellow ones / blue ones / red ones."
const STAT_TONE: Record<StatTone, { border: string; value: string; bg: string }> = {
  done:    { border: "rgba(251,191,36,0.55)", value: "rgba(251,191,36,1)",  bg: "rgba(251,191,36,0.08)" },
  covered: { border: "rgba(132,204,255,0.55)", value: "rgba(132,204,255,1)", bg: "rgba(132,204,255,0.08)" },
  missed:  { border: "rgba(248,113,113,0.55)", value: "rgba(248,113,113,1)", bg: "rgba(248,113,113,0.07)" },
  best:    { border: "rgba(251,146,60,0.55)",  value: "rgba(251,146,60,1)",  bg: "rgba(251,146,60,0.08)" },
};

function StatTile({ label, value, tone }: { label: string; value: string; tone?: StatTone }) {
  const palette = tone ? STAT_TONE[tone] : null;
  const tileStyle = palette
    ? { ...statTile, borderColor: palette.border, background: palette.bg }
    : statTile;
  const valueStyle = palette ? { ...statValue, color: palette.value } : statValue;
  return (
    <div style={tileStyle}>
      <span style={valueStyle}>{value}</span>
      <span style={statLabel}>{label}</span>
    </div>
  );
}

// ───────────────────────────── helpers

function shiftYmd(ymd: string, plus: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + plus);
  return d.toISOString().slice(0, 10);
}

function dayInitial(ymd: string): string {
  const initials = ["S", "M", "T", "W", "T", "F", "S"];
  return initials[new Date(`${ymd}T00:00:00.000Z`).getUTCDay()];
}

function dotCell(
  state: "done" | "covered" | "missed" | "rest" | "future",
  isToday: boolean,
  accent: string,
): CSSProperties {
  const base: CSSProperties = {
    width: "100%",
    height: 12,
    borderRadius: 4,
    display: "block",
  };
  const todayRing: CSSProperties = isToday
    ? { outline: "1.5px solid rgba(255,255,255,0.55)", outlineOffset: 1 }
    : {};
  switch (state) {
    case "done":
      return { ...base, ...todayRing, background: COLOR.amber, border: `1px solid ${COLOR.amber}` };
    case "covered":
      return { ...base, ...todayRing, background: "rgba(132,204,255,0.85)", border: "1px solid rgba(132,204,255,0.55)" };
    case "missed":
      return { ...base, ...todayRing, background: "transparent", border: `1px solid ${COLOR.red}` };
    case "future":
      return { ...base, ...todayRing, background: "transparent", border: `1px dashed ${COLOR.textFaint}` };
    case "rest":
    default:
      return { ...base, ...todayRing, background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.06)` };
  }
}

function detailDot(state: string, isToday: boolean): CSSProperties {
  const base: CSSProperties = {
    width: "100%",
    height: 16,
    borderRadius: 5,
    display: "block",
  };
  const ring = isToday ? { outline: "1.5px solid rgba(255,255,255,0.55)", outlineOffset: 1 } : {};
  switch (state) {
    case "done":
      return { ...base, ...ring, background: COLOR.amber, border: `1px solid ${COLOR.amber}` };
    case "covered":
      return { ...base, ...ring, background: "rgba(132,204,255,0.85)", border: "1px solid rgba(132,204,255,0.55)" };
    case "missed":
      return { ...base, ...ring, background: "transparent", border: `1px solid ${COLOR.red}` };
    case "future":
      return { ...base, ...ring, background: "transparent", border: `1px dashed ${COLOR.textFaint}` };
    default:
      return { ...base, ...ring, background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.05)` };
  }
}

// ───────────────────────────── styles

const list: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 4,
};

const headerRow: CSSProperties = {};

const dayLabelGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
  width: "100%",
};

const dayLabelText: CSSProperties = {
  textAlign: "center",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.6,
  color: COLOR.textFaint,
  textTransform: "uppercase",
};

const dayLabelToday: CSSProperties = {
  color: COLOR.success,
};

const trailingHeaderText: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  textAlign: "right",
};

const nameColumn: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
};

const accentDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const nameText: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const dotStripGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
  width: "100%",
};

const trailingCol: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 6,
};

const streakPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "baseline",
  gap: 1,
  padding: "3px 7px",
  borderRadius: 999,
  background: COLOR.amberSoft,
  border: `1px solid rgba(251,191,36,0.30)`,
  fontSize: 11,
  fontWeight: 900,
  color: COLOR.amber,
  lineHeight: 1,
};

const streakFlame: CSSProperties = { fontSize: 9, marginRight: 1 };
const streakValue: CSSProperties = { fontSize: 12 };
const streakUnit: CSSProperties = { fontSize: 9, fontWeight: 800, opacity: 0.75, marginLeft: 1 };

const streakPillMuted: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${COLOR.border}`,
  fontSize: 11,
  fontWeight: 800,
  color: COLOR.textFaint,
  lineHeight: 1,
};

function fractionPill(status: HabitRow["status"]): CSSProperties {
  const tone =
    status === "at_risk" ? COLOR.red
      : status === "behind" ? COLOR.amber
      : status === "complete" ? COLOR.success
      : COLOR.textDim;
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px 7px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${COLOR.border}`,
    fontSize: 11,
    fontWeight: 800,
    color: tone,
    lineHeight: 1,
    minWidth: 32,
  };
}

const chevron: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 18,
  fontSize: 14,
  fontWeight: 800,
  color: COLOR.textFaint,
  transition: "transform 160ms ease",
  marginLeft: 2,
};

const emptyState: CSSProperties = {
  fontSize: 12,
  color: COLOR.textDim,
  padding: "16px 6px",
  lineHeight: 1.5,
};

// ───────── expansion-panel styles

const expansionShell: CSSProperties = {
  marginTop: 4,
  marginBottom: 2,
  padding: "12px",
  borderRadius: 12,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 10,
};

const expansionGrid: CSSProperties = {
  display: "grid",
  gap: 10,
};

const expansionPanel: CSSProperties = {
  display: "grid",
  gap: 6,
};

const expansionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textDim,
};

const dotGridShell: CSSProperties = {
  display: "grid",
  gap: 4,
};

const dotGridRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 4,
};

const dotPlaceholder: CSSProperties = {
  background: "transparent",
};

// Tiny "×N" badge next to a group goal's name. Tells the user at a glance
// that this row aggregates multiple routines.
const groupBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 6px",
  marginLeft: 6,
  borderRadius: 999,
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: COLOR.textDim,
  flexShrink: 0,
};

// Group goal action panel. Replaces the single "Log today" button with a
// list of per-routine log buttons so the user can log the specific routine
// that fired today.
const groupActionShell: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.02)",
};

const groupActionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};

const groupActionList: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const groupActionDivider: CSSProperties = {
  flexBasis: "100%",
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(132,204,255,0.65)",
  paddingTop: 2,
};

const groupRoutineButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(251,191,36,0.45)",
  background: "rgba(251,191,36,0.08)",
  color: "rgba(251,191,36,1)",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  cursor: "pointer",
};

const groupSubstituteButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(132,204,255,0.45)",
  background: "rgba(132,204,255,0.07)",
  color: "rgba(132,204,255,1)",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  cursor: "pointer",
};

const groupActionFooter: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

// Sun-first day initials for the calendar-aligned 30-day grid.
const DAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const weekdayHeader: CSSProperties = {
  textAlign: "center",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.5,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  paddingBottom: 1,
};

const weekdayHeaderToday: CSSProperties = {
  color: COLOR.success,
  fontWeight: 900,
};

const statRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 6,
};

const statTile: CSSProperties = {
  display: "grid",
  gap: 1,
  padding: "8px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.025)",
  textAlign: "center",
};

const statValue: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: COLOR.text,
  lineHeight: 1.1,
};

const statLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const actionRow: CSSProperties = {
  display: "flex",
  gap: 8,
};

const primaryAction: CSSProperties = {
  flex: 1,
  textAlign: "center",
  padding: "9px 12px",
  borderRadius: 10,
  border: `1px solid rgba(51,255,122,0.42)`,
  background: COLOR.successSoft,
  color: COLOR.success,
  fontSize: 12.5,
  fontWeight: 900,
  textDecoration: "none",
  letterSpacing: 0.3,
};

const secondaryAction: CSSProperties = {
  flex: 1,
  textAlign: "center",
  padding: "9px 12px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.04)",
  color: COLOR.textDim,
  fontSize: 12.5,
  fontWeight: 800,
  textDecoration: "none",
};
