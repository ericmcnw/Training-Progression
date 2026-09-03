"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

// Pure HTML/CSS bar chart, modeled on /_home/DomainSparklines.
//
// Each week is a native HTML <button> styled via a CSS class (not
// inline styles). Bars are <div> elements with percentage heights.
// No SVG anywhere. iOS treats these as standard interactive controls,
// so tapping doesn't trigger zoom-to-fit.
//
// Layout:
//   chartShell
//     header (title + stat chips)
//     chartRow (yAxis | barsTrack — buttons, one per week)
//     xAxisRow (week labels under bars; thinned out at high counts)
//     legend (only when 2+ active series)

export type StackedBarSeries = {
  label: string;
  color: string;
  weeklyValues: number[];
  weeklyMinutes?: number[];
  /** Kept for type-compatibility with existing callers. */
  topSessionPerWeek?: Array<string | null>;
};

// Fallback palette only — callers should supply each series'
// `color` explicitly so different categories (routines, activity
// types) stay color-stable across visits.
const seriesPalette = [
  "rgba(56,189,248,0.94)",
  "rgba(251,191,36,0.94)",
  "rgba(167,139,250,0.94)",
  "rgba(74,222,128,0.92)",
  "rgba(248,113,113,0.92)",
  "rgba(251,146,60,0.92)",
];

function seriesColor(s: StackedBarSeries | undefined, idx: number) {
  return s?.color ?? seriesPalette[idx % seriesPalette.length];
}

// A segment shorter than this can't fit 9px text without clipping.
const SEGMENT_LABEL_MIN_PCT = 16;

function niceAxisMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / magnitude;
  if (n <= 1) return magnitude;
  if (n <= 2) return 2 * magnitude;
  if (n <= 2.5) return 2.5 * magnitude;
  if (n <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function fmtMins(mins: number) {
  const m = Math.round(mins);
  if (m <= 0) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

function fmtValue(v: number, decimals: number, unit?: string) {
  return `${v.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

export default function StackedWeeklyBarChart({
  title,
  weekLabels,
  series,
  unit = "",
  decimals = 1,
  compact = false,
  onPinnedWeekChange,
  hideTooltip: _hideTooltip,
}: {
  title: string;
  weekLabels: string[];
  series: StackedBarSeries[];
  unit?: string;
  decimals?: number;
  compact?: boolean;
  onPinnedWeekChange?: (weekIndex: number | null) => void;
  /** Accepted for API compatibility — there is no in-chart tooltip
   *  anymore; the sessions panel below the chart is the single source
   *  of truth. */
  hideTooltip?: boolean;
}) {
  const [pinnedWeek, setPinnedWeek] = useState<number | null>(null);
  // Isolating a series is the readability lever: one saturated color at a
  // time beats decoding a dozen. Works the same on desktop and mobile.
  const [isolated, setIsolated] = useState<string | null>(null);

  useEffect(() => {
    onPinnedWeekChange?.(pinnedWeek);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedWeek]);

  const weekTotals = useMemo(
    () => weekLabels.map((_, wi) => series.reduce((s, ser) => s + (ser.weeklyValues[wi] ?? 0), 0)),
    [weekLabels, series]
  );
  const weeklyMinutesTotals = useMemo(
    () => weekLabels.map((_, wi) => series.reduce((s, ser) => s + (ser.weeklyMinutes?.[wi] ?? 0), 0)),
    [weekLabels, series]
  );

  const hasAnyTime = weeklyMinutesTotals.some((m) => m > 0);
  const activeSeries = series.filter((s) => s.weeklyValues.some((v) => v > 0));

  // Every series is kept — ranking by window total just puts the routines
  // that actually drove the period at the front of the legend.
  const displaySeries = useMemo<Array<StackedBarSeries & { total: number }>>(
    () =>
      activeSeries
        .map((s) => ({ ...s, total: s.weeklyValues.reduce((a, b) => a + b, 0) }))
        .sort((a, b) => b.total - a.total),
    [activeSeries]
  );

  const yMax = niceAxisMax(Math.max(0.001, ...weekTotals));

  const totalAll = weekTotals.reduce((a, b) => a + b, 0);
  const bestWeek = Math.max(0, ...weekTotals);
  const avgWeek = weekLabels.length > 0 ? totalAll / weekLabels.length : 0;
  const totalMins = weeklyMinutesTotals.reduce((a, b) => a + b, 0);
  const avgMins = weekLabels.length > 0 ? totalMins / weekLabels.length : 0;

  const chartHeight = compact ? 96 : 132;

  // Thin out week labels when there's no room — show every Nth label
  // and the last one, always. With ~24px per bar slot, labels like
  // "3/15-3/21" are too wide to show under every bar.
  const labelStride = weekLabels.length > 10 ? 3 : weekLabels.length > 6 ? 2 : 1;

  return (
    <div style={chartShell}>
      <div style={headerStack}>
        <div style={titleStyle}>{title}</div>
        <div style={chipRow}>
          <Chip label="Total" value={fmtValue(totalAll, decimals, unit)} />
          <Chip label="Best wk" value={fmtValue(bestWeek, decimals, unit)} />
          <Chip label="Avg / wk" value={fmtValue(avgWeek, decimals, unit)} />
          {hasAnyTime ? (
            <>
              <Chip label="Total time" value={fmtMins(totalMins)} accent="amber" />
              <Chip label="Avg / wk" value={fmtMins(avgMins)} accent="amber" />
            </>
          ) : null}
        </div>
      </div>

      <div style={chartRow}>
        <div style={yAxis} aria-hidden>
          <span style={yAxisTick}>{yMax.toFixed(decimals)}</span>
          <span style={yAxisTick}>0</span>
        </div>
        <div style={{ ...barsTrack, height: chartHeight }}>
          {weekLabels.map((wkLabel, wi) => {
            const isPinned = pinnedWeek === wi;
            const weekTotal = weekTotals[wi];
            return (
              <button
                key={wi}
                type="button"
                className="swbcBar"
                aria-label={`Week ${wkLabel}: ${fmtValue(weekTotal, decimals, unit)}`}
                aria-pressed={isPinned}
                onClick={() => setPinnedWeek((p) => (p === wi ? null : wi))}
              >
                <div style={barCell(isPinned)}>
                  {displaySeries
                    .map((s, idx) => ({ s, idx, val: s.weeklyValues[wi] ?? 0 }))
                    .filter((seg) => seg.val > 0)
                    .map((seg) => {
                      const pct = (seg.val / yMax) * 100;
                      const dimmed = isolated !== null && seg.s.label !== isolated;
                      return (
                        <div
                          key={seg.s.label}
                          style={{
                            width: "100%",
                            height: `${pct}%`,
                            background: seriesColor(seg.s, seg.idx),
                            borderRadius: 2,
                            marginTop: 1,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: dimmed ? 0.15 : 1,
                            transition: "opacity 0.12s",
                          }}
                        >
                          {/* Only tall segments get an in-bar name, and the
                              class hides it below 720px where a weekly column
                              is ~28px wide and nothing legible fits. */}
                          {pct >= SEGMENT_LABEL_MIN_PCT ? (
                            <span className="swbcSegLabel" style={segLabel}>
                              {seg.s.label}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={xAxisRow} aria-hidden>
        <div style={xAxisGutter} />
        <div style={xAxisLabels}>
          {weekLabels.map((wkLabel, wi) => {
            const isLast = wi === weekLabels.length - 1;
            const show = wi % labelStride === 0 || isLast;
            // Intentionally NOT styling pinned labels differently —
            // any change to font-weight or font-style here causes a
            // subtle width recompute when the user taps a bar, which
            // makes the whole chart appear to "wiggle".
            return (
              <span key={wi} style={xAxisLabelSlot}>
                {show ? <span style={xAxisLabelText}>{shortWeekLabel(wkLabel)}</span> : null}
              </span>
            );
          })}
        </div>
      </div>

      {displaySeries.length > 1 ? (
        <div style={legend}>
          {displaySeries.map((s, idx) => {
            const on = isolated === s.label;
            const dimmed = isolated !== null && !on;
            return (
              <button
                key={s.label}
                type="button"
                className="swbcLegendBtn"
                aria-pressed={on}
                onClick={() => setIsolated((prev) => (prev === s.label ? null : s.label))}
                style={{ ...legendItem, ...(on ? legendItemOn : null), opacity: dimmed ? 0.4 : 1 }}
              >
                <span style={{ ...legendSwatch, background: seriesColor(s, idx) }} />
                <span style={legendLabel}>{s.label}</span>
                <span style={legendCount}>{fmtValue(s.total, decimals, unit)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: "amber" }) {
  const styleObj = accent === "amber" ? chipAmber : chipBase;
  const labelStyle = accent === "amber" ? chipAmberLabel : chipLabel;
  const valueStyle = accent === "amber" ? chipAmberValue : chipValue;
  return (
    <span style={styleObj}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value}</span>
    </span>
  );
}

// "3/15-3/21" → "3/15". Keeps mobile x-axis legible.
function shortWeekLabel(label: string): string {
  const dashIdx = label.indexOf("-");
  return dashIdx > 0 ? label.slice(0, dashIdx) : label;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const chartShell: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  padding: "12px 12px 10px",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.022))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  display: "grid",
  // Single column hard-capped to container width — otherwise default
  // grid track sizing lets children push past the card on mobile.
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 8,
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  touchAction: "manipulation",
  position: "relative",
  // Isolate the chart card so internal state changes (active bar,
  // hover, etc.) can't trigger reflow on anything outside the card.
  contain: "layout paint",
};

const headerStack: CSSProperties = { display: "grid", gap: 6, minWidth: 0 };

const titleStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  opacity: 0.92,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chipRow: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  minWidth: 0,
};

const chipBase: CSSProperties = {
  display: "inline-flex",
  gap: 4,
  alignItems: "baseline",
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.035)",
  fontSize: 11,
  fontWeight: 700,
};

const chipLabel: CSSProperties = {
  opacity: 0.48,
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 9,
  letterSpacing: 0.5,
};

const chipValue: CSSProperties = { opacity: 0.9 };

const chipAmber: CSSProperties = {
  ...chipBase,
  border: "1px solid rgba(251,199,92,0.18)",
  background: "rgba(251,199,92,0.05)",
};

const chipAmberLabel: CSSProperties = { ...chipLabel, color: "rgba(251,199,92,0.62)" };
const chipAmberValue: CSSProperties = { color: "rgba(251,220,120,0.95)" };

const chartRow: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "stretch",
  marginTop: 2,
  minWidth: 0,
};

const yAxis: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "flex-end",
  minWidth: 18,
  paddingRight: 4,
  borderRight: "1px dashed rgba(255,255,255,0.10)",
};

const yAxisTick: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  color: "rgba(255,255,255,0.5)",
  lineHeight: 1,
};

const barsTrack: CSSProperties = {
  flex: 1,
  display: "flex",
  gap: 4,
  alignItems: "stretch",
  minWidth: 0,
};

function barCell(isPinned: boolean): CSSProperties {
  return {
    flex: 1,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "stretch",
    minHeight: 0,
    padding: "0 3px",
    borderRadius: 4,
    boxShadow: isPinned ? "inset 0 0 0 1px rgba(255,255,255,0.28)" : "none",
    transition: "box-shadow 100ms ease",
  };
}

const xAxisRow: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "stretch",
  minWidth: 0,
};

// Matches the y-axis column width so the x-labels start where the
// bars-track starts.
const xAxisGutter: CSSProperties = {
  minWidth: 18,
  paddingRight: 4,
};

const xAxisLabels: CSSProperties = {
  flex: 1,
  display: "flex",
  gap: 4,
  minWidth: 0,
};

const xAxisLabelSlot: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  paddingTop: 4,
};

const xAxisLabelText: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  color: "rgba(255,255,255,0.55)",
  whiteSpace: "nowrap",
};

const legend: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 2,
  paddingTop: 8,
  borderTop: "1px solid rgba(255,255,255,0.07)",
};

const legendItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  minHeight: 34,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  cursor: "pointer",
  touchAction: "manipulation",
  transition: "opacity 0.12s, border-color 0.12s, background 0.12s",
};
const legendItemOn: CSSProperties = {
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.14)",
};
const legendSwatch: CSSProperties = {
  display: "inline-block",
  width: 9,
  height: 9,
  borderRadius: 3,
  flexShrink: 0,
};
const legendLabel: CSSProperties = { opacity: 0.7, fontWeight: 800 };
const legendCount: CSSProperties = { opacity: 0.45, fontWeight: 800, fontVariantNumeric: "tabular-nums" };
const segLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 900,
  lineHeight: 1,
  color: "rgba(10,12,16,0.82)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "clip",
  padding: "0 3px",
  pointerEvents: "none",
};
