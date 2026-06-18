"use client";

import { useState, useMemo, type CSSProperties } from "react";
import StackedWeeklyBarChart, { type StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import { LogDetailPopover, type OpenLog } from "@/app/_home/DomainSparklines";

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
  /** Training load (effort × duration, convex). When present on any
   *  session, the chart shows a Sessions⇄Load toggle and the panel rows
   *  surface a load badge. Absent for surfaces with no effort capture. */
  load?: number;
  /** True when `load` was computed from an ESTIMATED effort (the session
   *  was never rated). The badge marks these so a guess never reads as a
   *  real rating. */
  loadEstimated?: boolean;
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
  primaryLabel = "Sessions",
}: {
  title: string;
  weekLabels: string[];
  series: StackedBarSeries[];
  sessionsByWeek: SessionsByWeek;
  unit?: string;
  decimals?: number;
  compact?: boolean;
  /** Left label of the Sessions⇄Load toggle — names the default-view
   *  metric ("Sessions", "Distance", "Volume"). Only shown when sessions
   *  carry load. */
  primaryLabel?: string;
}) {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  // Sessions (default metric) vs Load view. Only meaningful when load data
  // is present; the toggle is hidden otherwise.
  const [view, setView] = useState<"primary" | "load">("primary");
  // Clicked session row → opens the shared LogDetailPopover (same one
  // the home dashboard uses) instead of navigating to a separate page.
  const [openLog, setOpenLog] = useState<OpenLog>(null);

  // Any session carrying a load value unlocks the Load view. Derive the
  // load bars from the per-session loads so builders only attach `load`
  // to each session and never duplicate the stacking logic.
  const hasLoad = useMemo(
    () => sessionsByWeek.some((wk) => wk.some((s) => s.load != null)),
    [sessionsByWeek]
  );
  const loadSeries = useMemo<StackedBarSeries[] | null>(() => {
    if (!hasLoad) return null;
    return series.map((s) => ({
      label: s.label,
      color: s.color,
      weeklyValues: weekLabels.map((_, wi) =>
        (sessionsByWeek[wi] ?? [])
          .filter((ws) => ws.seriesLabel === s.label)
          .reduce((sum, ws) => sum + (ws.load ?? 0), 0)
      ),
    }));
  }, [hasLoad, series, sessionsByWeek, weekLabels]);

  const isLoadView = view === "load" && loadSeries != null;
  const activeSeries = isLoadView ? loadSeries! : series;
  const activeUnit = isLoadView ? "" : unit;
  const activeDecimals = isLoadView ? 0 : decimals;

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
    const dec = activeDecimals ?? 1;
    const total = activeSeries.reduce(
      (sum, s) => sum + (s.weeklyValues[selectedWeek] ?? 0),
      0
    );
    const totalMins = series.reduce(
      (sum, s) => sum + (s.weeklyMinutes?.[selectedWeek] ?? 0),
      0
    );
    // In the default view, surface the week's load as a secondary stat so
    // both data + load read at a glance (the load view already shows it as
    // the headline total).
    const loadTotal = loadSeries
      ? loadSeries.reduce((sum, s) => sum + (s.weeklyValues[selectedWeek] ?? 0), 0)
      : 0;
    return {
      total: `${total.toFixed(dec)}${activeUnit ? ` ${activeUnit}` : ""}`,
      mins: totalMins > 0 ? totalMins : null,
      load: !isLoadView && loadTotal > 0 ? Math.round(loadTotal) : null,
    };
  }, [selectedWeek, activeSeries, activeUnit, activeDecimals, series, loadSeries, isLoadView]);

  // Enrich each series with a per-week "top session" string so the
  // chart tooltip can render the week's top session for that series
  // as a small sub-line under the totals. Picks the latest session
  // matching the series label (sessionsByWeek is date-sorted oldest
  // → newest, so .at(-1) gives the most recent). For series with no
  // matching sessions in a given week, leave null and the chart
  // skips the sub-line.
  const enrichedSeries = useMemo(() => {
    return activeSeries.map((s) => {
      const topSessionPerWeek: Array<string | null> = sessionsByWeek.map((wkSessions) => {
        const matches = wkSessions.filter((ws) => ws.seriesLabel === s.label);
        if (matches.length === 0) return null;
        return matches[matches.length - 1].metricFormatted;
      });
      return { ...s, topSessionPerWeek };
    });
  }, [activeSeries, sessionsByWeek]);

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
        // Desktop cap — keeps bars from going squat-and-wide at 1000px+
        // column widths. Mobile sits below the cap and ignores it.
        width: "100%",
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      {loadSeries != null ? (
        <div style={toggleRow}>
          <div style={toggleGroup} role="tablist" aria-label="Chart metric">
            <button
              type="button"
              role="tab"
              aria-selected={!isLoadView}
              onClick={() => setView("primary")}
              style={!isLoadView ? toggleBtnActive : toggleBtn}
            >
              {primaryLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isLoadView}
              onClick={() => setView("load")}
              style={isLoadView ? toggleBtnActive : toggleBtn}
            >
              Load
            </button>
          </div>
        </div>
      ) : null}

      <StackedWeeklyBarChart
        title={isLoadView ? `${title} · Load` : title}
        weekLabels={weekLabels}
        series={enrichedSeries}
        unit={activeUnit}
        decimals={activeDecimals}
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
          onSelectSession={(session) => setOpenLog(buildOpenLogFromSession(session))}
        />
      ) : null}
      <LogDetailPopover open={openLog} onClose={() => setOpenLog(null)} />
    </div>
  );
}

// Convert a chart session row into the OpenLog shape the popover wants.
// The href carries the routineId in segment 2 (`/routines/<id>/...`);
// performedAt is local-time formatted to match the home dashboard's
// expectations.
function buildOpenLogFromSession(session: WeekSession): OpenLog {
  const routineId = session.href ? session.href.split("/")[2] ?? "" : "";
  const ymd = session.performedAt.toISOString().slice(0, 10);
  const timeLabel = session.performedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    log: {
      logId: session.id,
      routineId,
      routineName: session.routineName,
      performedYmd: ymd,
      performedTimeLabel: timeLabel,
    },
    accent: session.seriesColor,
    label: session.seriesLabel,
  };
}

// ─── Sessions panel ──────────────────────────────────────────────────────────

function WeekSessionsPanel({
  weekLabel,
  sessions,
  weekTotal,
  onClear,
  onSelectSession,
}: {
  weekLabel: string;
  sessions: WeekSession[];
  weekTotal: { total: string; mins: number | null; load: number | null } | null;
  onClear: () => void;
  onSelectSession: (session: WeekSession) => void;
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
          {weekTotal.load != null ? (
            <span style={weekTotalLoad}>· {weekTotal.load} load</span>
          ) : null}
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <div style={emptyStateStyle}>No sessions logged this week.</div>
      ) : (
        <div style={{ display: "grid", gap: 3 }}>
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} onSelect={() => onSelectSession(s)} />
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

function SessionRow({ session, onSelect }: { session: WeekSession; onSelect: () => void }) {
  // Short day label: "Mon 5/26". Locked to en-US so non-US locales
  // don't flip into DD/MM (the default `undefined` locale was reading
  // "24/05" for the user, who wants M/D).
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(session.performedAt);
  const dayLabel = `${weekday} ${session.performedAt.getMonth() + 1}/${session.performedAt.getDate()}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      style={rowButtonStyle}
      aria-label={`Open session: ${session.routineName} on ${dayLabel}`}
    >
      <span style={{ ...stripeStyle, background: session.seriesColor }} aria-hidden />
      <span style={rowDateStyle}>{dayLabel}</span>
      <span style={rowRoutineStyle}>{session.routineName}</span>
      <span style={rowMetricStyle}>{session.metricFormatted}</span>
      {session.load != null ? (
        <span
          style={session.loadEstimated ? rowLoadBadgeEst : rowLoadBadge}
          title={session.loadEstimated ? "Estimated load — this session isn't rated yet" : "Training load"}
        >
          {session.loadEstimated ? "~" : ""}{Math.round(session.load)}
        </span>
      ) : null}
      <span style={rowCaretStyle}>›</span>
    </button>
  );
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

// Button variant — same chrome as rowStyle but clears native button
// styles (font, alignment, padding) so the row reads the same as it
// did when it was an anchor.
const rowButtonStyle: CSSProperties = {
  ...rowStyle,
  width: "100%",
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
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

const weekTotalLoad: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(251,146,60,0.95)",
};

// Sessions⇄Load segmented toggle above the chart.
const toggleRow: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const toggleGroup: CSSProperties = {
  display: "inline-flex",
  gap: 2,
  padding: 2,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
};

const toggleBtn: CSSProperties = {
  minHeight: 30,
  padding: "5px 14px",
  borderRadius: 999,
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: 0.2,
  cursor: "pointer",
  opacity: 0.6,
};

const toggleBtnActive: CSSProperties = {
  ...toggleBtn,
  background: "rgba(255,255,255,0.10)",
  opacity: 1,
};

// Per-session load chip — orange to tie back to the load accent.
const rowLoadBadge: CSSProperties = {
  flexShrink: 0,
  fontSize: 10.5,
  fontWeight: 900,
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px solid rgba(251,146,60,0.35)",
  background: "rgba(251,146,60,0.1)",
  color: "rgba(251,146,60,0.95)",
  fontVariantNumeric: "tabular-nums",
};

// Estimated-load variant — muted + dashed so a guess never reads as a
// real rating (the "~" prefix reinforces it).
const rowLoadBadgeEst: CSSProperties = {
  ...rowLoadBadge,
  border: "1px dashed rgba(148,163,184,0.45)",
  background: "rgba(148,163,184,0.08)",
  color: "rgba(148,163,184,0.9)",
};
