"use client";

// Home check-in — the one card that answers "am I doing what I said I would?"
// Goals behind pace this week, goals that have been slipping for weeks, and
// which domains are trending up or down. Derived entirely from the habit rows
// and domain series Home already loads.

import Link from "next/link";
import type { CSSProperties } from "react";
import type { DomainSeries, HabitRow } from "./types";
import { COLOR, RADIUS, cardHeader, cardHint, cardSurface, cardTitle } from "./tokens";
import { domainAccent } from "./client-utils";
import { getFrequencyRenderMode } from "@/lib/frequency-state";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";

const MAX_ROWS = 5;
const RECENT_WEEKS = 4;
const DAILY_LOOKBACK_DAYS = 14;
const TREND_WEEKS = 3;

type Attention = {
  row: HabitRow;
  notes: string[];
  severity: number;
};

function weeklyAttention(row: HabitRow): Attention | null {
  const window = row.state.currentWindow;
  const isPlainWeekly = row.target?.targetUnit === "WEEK" && row.target.targetInterval === 1;
  const notes: string[] = [];
  let severity = 0;

  if (row.status === "behind" || row.status === "at_risk") {
    notes.push(`${window.progress} of ${window.target} this ${isPlainWeekly ? "week" : "period"}`);
    severity += row.status === "at_risk" ? 2 : 1;
  }

  // Week-by-week history only reads cleanly for an N-per-week target. Weeks
  // before the goal existed don't count against it, and the last entry is the
  // week in progress.
  if (isPlainWeekly && row.target) {
    const recent = row.weeklyContributions
      .slice(0, -1)
      .filter((week) => week.weekStartYmd >= row.goalStartYmd)
      .slice(-RECENT_WEEKS);
    const perWeek = row.target.targetCount;
    const hits = recent.filter((week) => week.logs.length >= perWeek).length;
    if (recent.length >= 2 && hits <= recent.length / 2) {
      notes.push(`hit ${hits} of the last ${recent.length} weeks`);
      severity += recent.length - hits;
    }
  }

  return notes.length > 0 ? { row, notes, severity } : null;
}

function dailyAttention(row: HabitRow): Attention | null {
  const days = row.trailing30
    .filter((day) => day.state === "done" || day.state === "covered" || day.state === "missed")
    .slice(-DAILY_LOOKBACK_DAYS);
  if (days.length < DAILY_LOOKBACK_DAYS / 2) return null;
  const done = days.filter((day) => day.state !== "missed").length;
  if (done * 2 >= days.length) return null;
  return { row, notes: [`${done} of the last ${days.length} days`], severity: 1 + (days.length - done) / days.length };
}

type Trend = { series: DomainSeries; recent: number; earlier: number };

function domainTrends(series: DomainSeries[]): Trend[] {
  return series
    .map((s) => {
      const complete = s.weeks.slice(0, -1);
      const recent = complete.slice(-TREND_WEEKS).reduce((sum, week) => sum + week.count, 0);
      const earlier = complete.slice(-TREND_WEEKS * 2, -TREND_WEEKS).reduce((sum, week) => sum + week.count, 0);
      return { series: s, recent, earlier };
    })
    .filter((trend) => trend.recent + trend.earlier > 0);
}

export default function HomeCheckIn({ habitRows, domainSeries }: { habitRows: HabitRow[]; domainSeries: DomainSeries[] }) {
  const { openDrawer } = useLogDrawer();

  const attention = habitRows
    .map((row) => (getFrequencyRenderMode(row.target) === "weekly-bars" ? weeklyAttention(row) : dailyAttention(row)))
    .filter((item): item is Attention => item !== null)
    .sort((a, b) => b.severity - a.severity);
  const trends = domainTrends(domainSeries);

  if (habitRows.length === 0 && trends.length === 0) return null;

  const onPace = habitRows.length - attention.length;
  const shown = attention.slice(0, MAX_ROWS);

  return (
    <section style={cardSurface} aria-label="Check-in">
      <header style={cardHeader}>
        <span style={cardTitle}>Check-in</span>
        {habitRows.length > 0 ? (
          <span style={cardHint}>
            {onPace} of {habitRows.length} goals on pace
          </span>
        ) : null}
      </header>

      {habitRows.length > 0 && attention.length === 0 ? (
        <div style={allGood}>Every goal is on pace.</div>
      ) : null}

      {shown.length > 0 ? (
        <ul style={list}>
          {shown.map(({ row, notes }) => (
            <li key={row.goalId} style={item}>
              <span aria-hidden style={{ ...dot, background: domainAccent(row.domain) }} />
              <span style={itemText}>
                <span style={itemName}>{row.goalName}</span>
                <span style={itemNote}>{notes.join(" · ")}</span>
              </span>
              <button type="button" onClick={() => openDrawer(row.routineId)} style={logBtn}>
                Log
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {attention.length > shown.length ? (
        <Link href="/plan?view=goals" style={moreLink}>
          {attention.length - shown.length} more in Goals →
        </Link>
      ) : null}

      {trends.length > 0 ? (
        <div style={trendBlock}>
          <span style={trendLabel}>Sessions, last {TREND_WEEKS} full weeks vs the {TREND_WEEKS} before</span>
          <div style={trendRow}>
            {trends.map(({ series, recent, earlier }) => (
              <span key={series.domain} style={trendChip}>
                <span style={{ color: domainAccent(series.domain), fontWeight: 900 }}>{series.label}</span>
                <span style={trendValue}>
                  {recent}
                  <span style={trendArrow}>{recent > earlier ? "▲" : recent < earlier ? "▼" : "="}</span>
                  <span style={trendWas}>{earlier}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const allGood: CSSProperties = { fontSize: 13, color: COLOR.textDim };

const list: CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 };

const item: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "6px 6px 6px 10px",
  borderRadius: RADIUS.inner,
  border: `1px solid ${COLOR.border}`,
  background: COLOR.panelSoft,
};

const dot: CSSProperties = { width: 8, height: 8, borderRadius: 999, flexShrink: 0 };

const itemText: CSSProperties = { display: "grid", gap: 1, minWidth: 0, flex: 1 };

const itemName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const itemNote: CSSProperties = { fontSize: 11.5, color: COLOR.amber, fontWeight: 700 };

const logBtn: CSSProperties = {
  minHeight: 44,
  minWidth: 52,
  padding: "0 12px",
  borderRadius: RADIUS.control,
  border: "1px solid rgba(51,255,122,0.4)",
  background: COLOR.successSoft,
  color: COLOR.success,
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  flexShrink: 0,
};

const moreLink: CSSProperties = { fontSize: 11.5, fontWeight: 800, color: COLOR.textDim, textDecoration: "none" };

const trendBlock: CSSProperties = {
  display: "grid",
  gap: 6,
  paddingTop: 8,
  borderTop: `1px solid ${COLOR.border}`,
};

const trendLabel: CSSProperties = { fontSize: 10.5, fontWeight: 700, color: COLOR.textFaint };

const trendRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };

const trendChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "5px 9px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${COLOR.border}`,
  fontSize: 11.5,
};

const trendValue: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 900 };

const trendArrow: CSSProperties = { fontSize: 9, color: COLOR.textDim };

const trendWas: CSSProperties = { color: COLOR.textFaint, fontWeight: 700 };
