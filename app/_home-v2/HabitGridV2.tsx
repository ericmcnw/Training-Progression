"use client";

// HabitGridV2 — 7-day grid of habit rows. Tapping a row expands an inline
// detail panel below it (30-day strip + stats + actions). Only one row
// expanded at a time. No modal popovers.
//
// The dot strip uses CSS grid (not flex) so every dot lands at exactly 1/7
// of the column width, regardless of intrinsic size.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type { HabitRow } from "./types";
import DrawerLogButton from "@/app/routines/DrawerLogButton";
import { COLOR, RADIUS, cardSurface, cardHeader, cardTitle, cardHint } from "./tokens";
import { frequencyStatusColor } from "@/lib/frequency-state";

type Props = {
  rows: HabitRow[];
  today: string;
};

export default function HabitGridV2({ rows, today }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section id="habits-grid" style={cardSurface}>
        <header style={cardHeader}>
          <span style={cardTitle}>Habits</span>
        </header>
        <div style={emptyState}>
          No habit-domain routines yet. Set a routine&apos;s domain to <em>Habit / Routine</em> to track it here.
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
        <span style={cardTitle}>Habits</span>
        <span style={cardHint}>last 7 days · tap row to expand</span>
      </header>

      {/* Day-label header row. Same grid columns as the habit rows so the
          weekday letters align exactly with the dot cells below. */}
      <div style={headerRow} className="homeV2HabitHeader">
        <div />
        <div style={dayLabelGrid}>
          {last7.map((ymd) => (
            <span key={ymd} style={{ ...dayLabelText, ...(ymd === today ? dayLabelToday : null) }}>
              {dayInitial(ymd)}
            </span>
          ))}
        </div>
        <div style={trailingHeaderText}>streak · wk</div>
      </div>

      <ul style={list}>
        {rows.map((row) => {
          const accent = frequencyStatusColor(row.status);
          const expanded = openId === row.routineId;
          return (
            <li key={row.routineId}>
              <button
                type="button"
                onClick={() => setOpenId((current) => (current === row.routineId ? null : row.routineId))}
                className="homeV2HabitRow"
                aria-expanded={expanded}
              >
                <div style={nameColumn}>
                  <span style={{ ...accentDot, background: accent }} aria-hidden />
                  <span style={nameText}>{row.routineName}</span>
                </div>
                <div style={dotStripGrid}>
                  {last7.map((ymd) => {
                    const state = row.trailing30.find((d) => d.ymd === ymd)?.state ?? "rest";
                    return <span key={ymd} style={dotCell(state, ymd === today, accent)} />;
                  })}
                </div>
                <div style={trailingCol}>
                  {row.currentStreak > 0 ? (
                    <span style={streakPill}>
                      <span style={streakFlame} aria-hidden>🔥</span>
                      <span style={streakValue}>{row.currentStreak}</span>
                      <span style={streakUnit}>d</span>
                    </span>
                  ) : (
                    <span style={streakPillMuted}>—</span>
                  )}
                  <span style={fractionPill(row.status)}>
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
          .homeV2HabitRow,
          .homeV2HabitHeader {
            grid-template-columns: minmax(90px, 1.2fr) minmax(0, 2.4fr) 96px;
            gap: 8px;
            padding-inline: 10px;
          }
        }
        @media (max-width: 400px) {
          .homeV2HabitRow,
          .homeV2HabitHeader {
            grid-template-columns: minmax(70px, 1fr) minmax(0, 2fr) 88px;
            gap: 6px;
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
  // Split trailing30 into 4 lines of 7 (oldest → newest).
  const lines: HabitRow["trailing30"][] = [];
  for (let i = 0; i < row.trailing30.length; i += 7) {
    lines.push(row.trailing30.slice(i, i + 7));
  }
  const completedDays = row.trailing30.filter((d) => d.state === "done").length;
  const missedDays = row.trailing30.filter((d) => d.state === "missed").length;

  return (
    <div style={expansionShell}>
      <div style={expansionGrid}>
        <div style={expansionPanel}>
          <div style={expansionLabel}>Last 30 days</div>
          <div style={dotGridShell}>
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
          <StatTile label="Done" value={`${completedDays}d`} />
          <StatTile label="Missed" value={`${missedDays}d`} />
          <StatTile label="Best" value={`${row.longestStreak}d`} />
        </div>
      </div>

      <div style={actionRow}>
        <DrawerLogButton
          routineId={row.routineId}
          defaultDate={today}
          label="Log today"
          className=""
          style={primaryAction}
        />
        <Link href={`/routines/${row.routineId}`} style={secondaryAction}>
          Edit habit
        </Link>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={statTile}>
      <span style={statValue}>{value}</span>
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
  state: "done" | "missed" | "rest" | "future",
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
