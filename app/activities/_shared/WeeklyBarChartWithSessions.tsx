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

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <StackedWeeklyBarChart
        title={title}
        weekLabels={weekLabels}
        series={series}
        unit={unit}
        decimals={decimals}
        compact={compact}
        onPinnedWeekChange={setSelectedWeek}
      />
      {selectedWeek !== null ? (
        <WeekSessionsPanel
          weekLabel={weekLabels[selectedWeek] ?? "Week"}
          sessions={weekSessions ?? []}
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
  onClear,
}: {
  weekLabel: string;
  sessions: WeekSession[];
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
      {sessions.length === 0 ? (
        <div style={emptyStateStyle}>No sessions logged this week.</div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function SessionRow({ session }: { session: WeekSession }) {
  const dayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(session.performedAt);

  const content = (
    <div style={rowStyle}>
      <span style={{ ...stripeStyle, background: session.seriesColor }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitleRowStyle}>
          <span style={rowDateStyle}>{dayLabel}</span>
          <span style={rowSeriesStyle}>{session.seriesLabel}</span>
        </div>
        <div style={rowRoutineStyle}>{session.routineName}</div>
      </div>
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
  gap: 10,
  padding: "12px 14px",
  borderRadius: 14,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.025)",
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

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minHeight: 48,
  padding: "8px 10px 8px 0",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
  overflow: "hidden",
};

const stripeStyle: CSSProperties = {
  width: 4,
  alignSelf: "stretch",
  flexShrink: 0,
};

const rowTitleRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "baseline",
  flexWrap: "wrap",
};

const rowDateStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.7,
  letterSpacing: 0.2,
};

const rowSeriesStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  opacity: 0.55,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const rowRoutineStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  marginTop: 2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowMetricStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.85,
  whiteSpace: "nowrap",
};

const rowCaretStyle: CSSProperties = {
  fontSize: 16,
  opacity: 0.4,
  fontWeight: 700,
  paddingRight: 4,
};
