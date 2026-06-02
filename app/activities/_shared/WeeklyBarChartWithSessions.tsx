"use client";

import Link from "next/link";
import { useState, useMemo, type CSSProperties } from "react";
import StackedWeeklyBarChart, { type StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";

// One per-week session entry shown in the panel under the chart when
// the user clicks a week. Pre-formatted by the chart-data helper so
// the panel just renders strings.
export type WeekSession = {
  /** RoutineLog id — also used as React key. */
  id: string;
  performedAt: Date;
  routineName: string;
  /** Which chart series this session contributed to (e.g., "Running",
   *  "Sessions", "Volume"). Lets the panel group by series within a
   *  week when multiple activity types fired the same week. */
  seriesLabel: string;
  /** Hex / rgba color for the series — used as a left-stripe on the
   *  row so the visual ties back to the bar segment. */
  seriesColor: string;
  /** Pre-formatted metric (e.g., "3.2 mi", "1500 lb", "45m"). The
   *  panel renders this verbatim — keeps the panel agnostic of unit. */
  metricFormatted: string;
  /** Optional href — if present the row becomes a link to the session
   *  detail page. */
  href?: string;
};

// `sessionsByWeek[i]` = sessions that contributed to week index `i`
// (matches StackedBarSeries.weeklyValues alignment). Empty arrays for
// weeks with no sessions.
export type SessionsByWeek = WeekSession[][];

// Wraps StackedWeeklyBarChart with a click-to-reveal sessions panel.
// Click a week bar → the panel below populates with that week's
// sessions. Click again (or click empty area on the chart) → panel
// clears.
export default function WeeklyBarChartWithSessions({
  title,
  weekLabels,
  series,
  sessionsByWeek,
  unit,
  decimals,
  compact,
}: {
  title: string;
  weekLabels: string[];
  series: StackedBarSeries[];
  sessionsByWeek: SessionsByWeek;
  unit?: string;
  decimals?: number;
  compact?: boolean;
}) {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  const weekSessions = useMemo(() => {
    if (selectedWeek === null) return null;
    return sessionsByWeek[selectedWeek] ?? [];
  }, [selectedWeek, sessionsByWeek]);

  // Week-total summary string shown above the session rows. Sums the
  // active series for the selected week and formats with the chart's
  // unit/decimals so the panel reads as one continuous breakdown of
  // the bar that was tapped.
  const weekTotalLabel = useMemo(() => {
    if (selectedWeek === null) return null;
    const dec = decimals ?? 1;
    const total = series.reduce(
      (sum, s) => sum + (s.weeklyValues[selectedWeek] ?? 0),
      0
    );
    const totalMins = series.reduce(
      (sum, s) => sum + (s.weeklyMinutes?.[selectedWeek] ?? 0),
      0
    );
    return {
      total: `${total.toFixed(dec)}${unit ? ` ${unit}` : ""}`,
      mins: totalMins > 0 ? totalMins : null,
    };
  }, [selectedWeek, series, unit, decimals]);

  // Enrich each series with a per-week "top session" string so the
  // chart tooltip can render the week's top session for that series
  // as a small sub-line under the totals. Picks the latest session
  // matching the series label (sessionsByWeek is date-sorted oldest
  // → newest, so .at(-1) gives the most recent). For series with no
  // matching sessions in a given week, leave null and the chart
  // skips the sub-line.
  const enrichedSeries = useMemo(() => {
    return series.map((s) => {
      const topSessionPerWeek: Array<string | null> = sessionsByWeek.map((wkSessions) => {
        const matches = wkSessions.filter((ws) => ws.seriesLabel === s.label);
        if (matches.length === 0) return null;
        return matches[matches.length - 1].metricFormatted;
      });
      return { ...s, topSessionPerWeek };
    });
  }, [series, sessionsByWeek]);

  return (
    <div
      style={{
        display: "grid",
        // Pin the single grid track to the container width — default
        // `auto` tracks let a wide child (long session-row metric)
        // push this grid wider than its parent, which is what was
        // scrolling the whole strength page sideways on tap.
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 10,
        minWidth: 0,
      }}
    >
      <StackedWeeklyBarChart
        title={title}
        weekLabels={weekLabels}
        series={enrichedSeries}
        unit={unit}
        decimals={decimals}
        // Default to compact mode on activity dashboards — saves ~60px
        // of vertical space per chart on mobile and the bars stay
        // readable at the smaller height. Callers can opt back into
        // full-size by passing `compact={false}` explicitly.
        compact={compact ?? true}
        // The panel below duplicates the chart's hover tooltip data
        // (week label + per-series detail). Hide the tooltip so users
        // get one source of truth — tap a bar to open the panel.
        hideTooltip
        onPinnedWeekChange={setSelectedWeek}
      />
      {selectedWeek !== null ? (
        <WeekSessionsPanel
          weekLabel={weekLabels[selectedWeek] ?? "Week"}
          sessions={weekSessions ?? []}
          weekTotal={weekTotalLabel}
          onClear={() => setSelectedWeek(null)}
        />
      ) : null}
    </div>
  );
}

// ─── Sessions panel ──────────────────────────────────────────────────────────

function WeekSessionsPanel({
  weekLabel,
  sessions,
  weekTotal,
  onClear,
}: {
  weekLabel: string;
  sessions: WeekSession[];
  weekTotal: { total: string; mins: number | null } | null;
  onClear: () => void;
}) {
  return (
    <section style={panelStyle} aria-label={`Sessions for week of ${weekLabel}`}>
      <header style={panelHeaderStyle}>
        <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
          <div style={panelEyebrowStyle}>Week of {weekLabel}</div>
          <div style={panelTitleStyle}>
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </div>
        </div>
        <button type="button" onClick={onClear} style={clearBtnStyle}>
          Close
        </button>
      </header>

      {weekTotal ? (
        <div style={weekTotalRow}>
          <span style={weekTotalLabel}>Week total</span>
          <span style={weekTotalValue}>{weekTotal.total}</span>
          {weekTotal.mins ? (
            <span style={weekTotalMins}>· {formatMins(weekTotal.mins)}</span>
          ) : null}
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <div style={emptyStateStyle}>No sessions logged this week.</div>
      ) : (
        <div style={{ display: "grid", gap: 3 }}>
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function formatMins(mins: number) {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

function SessionRow({ session }: { session: WeekSession }) {
  // Short day label: "Mon 5/26". Drops the long month name to keep
  // each row to a single line on mobile.
  const dayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(session.performedAt);

  const content = (
    <div style={rowStyle}>
      <span style={{ ...stripeStyle, background: session.seriesColor }} aria-hidden />
      <span style={rowDateStyle}>{dayLabel}</span>
      <span style={rowRoutineStyle}>{session.routineName}</span>
      <span style={rowMetricStyle}>{session.metricFormatted}</span>
      {session.href ? <span style={rowCaretStyle}>›</span> : null}
    </div>
  );

  if (session.href) {
    return (
      <Link href={session.href} style={{ textDecoration: "none", color: "inherit" }}>
        {content}
      </Link>
    );
  }
  return content;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 14,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.025)",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden",
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const panelEyebrowStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  opacity: 0.55,
};

const panelTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: -0.2,
};

const clearBtnStyle: CSSProperties = {
  minHeight: 32,
  padding: "5px 11px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const emptyStateStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
  fontStyle: "italic",
  padding: "8px 4px",
};

// Single-line, dense row: stripe · date · routine name · metric ·
// optional caret. Was a two-line layout with a 48px min-height —
// half the panel was vertical padding on mobile.
const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 30,
  padding: "5px 8px 5px 0",
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
  overflow: "hidden",
};

const stripeStyle: CSSProperties = {
  width: 3,
  alignSelf: "stretch",
  flexShrink: 0,
};

const rowDateStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.65,
  letterSpacing: 0.2,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
  flexShrink: 0,
  marginLeft: 4,
};

const rowRoutineStyle: CSSProperties = {
  // Both routine name and metric can shrink. The metric used to be
  // flexShrink: 0 — but long strings like "15 sets · 845 lb · top:
  // 35×5 Pull-Up" then pushed the row past the panel/viewport and
  // the whole page scrolled sideways on tap.
  flex: "2 1 0",
  minWidth: 0,
  fontSize: 12.5,
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMetricStyle: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  fontSize: 11.5,
  fontWeight: 800,
  opacity: 0.9,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

const rowCaretStyle: CSSProperties = {
  fontSize: 14,
  opacity: 0.4,
  fontWeight: 700,
  paddingRight: 2,
  flexShrink: 0,
};

// Week-total summary line — sits between the panel header and the
// session rows. Pulls focus to "X mi this week" before the per-
// session breakdown.
const weekTotalRow: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  padding: "8px 10px",
  borderRadius: 9,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.10)",
  background: "rgba(56,189,248,0.05)",
};

const weekTotalLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const weekTotalValue: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: -0.2,
  fontVariantNumeric: "tabular-nums",
  color: "rgba(186,230,253,0.95)",
};

const weekTotalMins: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.7,
};
