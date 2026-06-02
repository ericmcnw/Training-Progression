"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

// Pure HTML/CSS stacked bar chart — no SVG, no canvas. Mirrors the
// architecture of /_home/DomainSparklines so iOS treats every
// interactive element as a native <button> and never triggers
// double-tap-zoom or the implicit "zoom to readable content" gesture
// that SVG <rect> hit areas suffered from in the previous SVG-based
// implementation.
//
// Layout:
//   chart shell (div)
//     ├── header (title + stat chips + time chips)
//     ├── chart body (flex row)
//     │    ├── y-axis (3 ticks: yMax, yMax/2, 0)
//     │    └── bars track (flex row of <button>, one per week)
//     │         └── each button: value label, bar cell with stacked
//     │           series segments, x-axis week label
//     └── legend (when multiple series)

export type StackedBarSeries = {
  label: string;
  color: string;
  weeklyValues: number[];
  weeklyMinutes?: number[];
  /** Pre-formatted "top session" detail per week index. Surfaced in
   *  the optional hover popover when not suppressed via hideTooltip. */
  topSessionPerWeek?: Array<string | null>;
};

const enduranceChartPalette = [
  "rgba(56,189,248,0.94)",
  "rgba(251,191,36,0.94)",
  "rgba(167,139,250,0.94)",
  "rgba(74,222,128,0.92)",
  "rgba(248,113,113,0.92)",
  "rgba(251,146,60,0.92)",
  "rgba(244,114,182,0.90)",
  "rgba(203,213,225,0.88)",
];

function visualSeriesColor(index: number) {
  return enduranceChartPalette[index % enduranceChartPalette.length];
}

function niceAxisMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  if (normalized <= 7.5) return 7.5 * magnitude;
  return 10 * magnitude;
}

function fmtMins(mins: number): string {
  const m = Math.round(mins);
  if (m <= 0) return "-";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export default function StackedWeeklyBarChart({
  title,
  weekLabels,
  series,
  unit = "mi",
  decimals = 1,
  compact = false,
  onPinnedWeekChange,
  hideTooltip = false,
}: {
  title: string;
  weekLabels: string[];
  series: StackedBarSeries[];
  unit?: string;
  decimals?: number;
  compact?: boolean;
  onPinnedWeekChange?: (weekIndex: number | null) => void;
  hideTooltip?: boolean;
}) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const [pinnedWeek, setPinnedWeek] = useState<number | null>(null);
  const activeWeek = hoveredWeek ?? pinnedWeek;

  useEffect(() => {
    onPinnedWeekChange?.(pinnedWeek);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedWeek]);

  const weekTotals = useMemo(
    () => weekLabels.map((_, wi) => series.reduce((sum, s) => sum + (s.weeklyValues[wi] ?? 0), 0)),
    [weekLabels, series]
  );

  const weeklyMinutesTotals = useMemo(
    () => weekLabels.map((_, wi) => series.reduce((sum, s) => sum + (s.weeklyMinutes?.[wi] ?? 0), 0)),
    [weekLabels, series]
  );

  const activeSeries = series.filter((s) => s.weeklyValues.some((v) => v > 0));
  const hasAnyTime = weeklyMinutesTotals.some((m) => m > 0);
  const maxTotal = Math.max(0.001, ...weekTotals);
  const yMax = niceAxisMax(maxTotal);

  const totalAll = weekTotals.reduce((a, b) => a + b, 0);
  const maxWeek = Math.max(0, ...weekTotals);
  const avgWeek = weekLabels.length > 0 ? totalAll / weekLabels.length : 0;
  const totalMinutesAll = weeklyMinutesTotals.reduce((a, b) => a + b, 0);
  const avgMinutes = weekLabels.length > 0 ? totalMinutesAll / weekLabels.length : 0;
  const fmt = (v: number) => `${v.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;

  const chartHeight = compact ? 110 : 150;

  return (
    <div style={chartShell}>
      {/* Header — title + stat chips + optional time chips */}
      <div style={headerStack}>
        <div style={titleStyle}>{title}</div>
        <div style={chipRow}>
          {[
            { label: "Total", value: fmt(totalAll) },
            { label: "Best wk", value: fmt(maxWeek) },
            { label: "Avg / wk", value: fmt(avgWeek) },
          ].map((chip) => (
            <span key={chip.label} style={statChip}>
              <span style={statChipLabel}>{chip.label}</span>
              <span style={statChipValue}>{chip.value}</span>
            </span>
          ))}
          {hasAnyTime &&
            [
              { label: "Total time", value: fmtMins(totalMinutesAll) },
              { label: "Avg / wk", value: fmtMins(avgMinutes) },
            ].map((chip) => (
              <span key={`${chip.label}-time`} style={timeChip}>
                <span style={timeChipLabel}>{chip.label}</span>
                <span style={timeChipValue}>{chip.value}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Chart body — y-axis on the left, bars track on the right */}
      <div style={chartBody}>
        <div style={yAxis} aria-hidden>
          <span style={yAxisTick}>{yMax.toFixed(decimals)}</span>
          <span style={yAxisTick}>{(yMax / 2).toFixed(decimals)}</span>
          <span style={yAxisTick}>0</span>
        </div>

        <div
          style={{ ...barsTrack, height: chartHeight }}
          onPointerLeave={() => setHoveredWeek(null)}
        >
          {weekLabels.map((wkLabel, wi) => {
            const weekTotal = weekTotals[wi];
            const isActive = activeWeek === wi;
            const isPinned = pinnedWeek === wi;
            const isDimmed = activeWeek !== null && !isActive;

            return (
              <button
                key={wi}
                type="button"
                aria-label={`Week ${wkLabel}: ${weekTotal.toFixed(decimals)}${unit ? ` ${unit}` : ""}`}
                aria-pressed={isPinned}
                onPointerEnter={() => setHoveredWeek(wi)}
                onClick={() => setPinnedWeek((p) => (p === wi ? null : wi))}
                style={barButtonStyle}
              >
                <span style={barValueLabel(isActive, weekTotal > 0)}>
                  {weekTotal > 0 ? weekTotal.toFixed(weekTotal >= 10 ? 0 : decimals) : ""}
                </span>
                <div style={barCellStyle(isActive)}>
                  {/* Stack visible series segments from bottom to top.
                      Each segment height = (val / yMax) * 100%; flex
                      column with justifyContent: flex-end means they
                      stack from the bottom up. */}
                  {series
                    .map((s, idx) => ({ s, idx, val: s.weeklyValues[wi] ?? 0 }))
                    .filter((seg) => seg.val > 0)
                    .map((seg) => (
                      <div
                        key={seg.s.label}
                        style={{
                          width: "100%",
                          height: `${(seg.val / yMax) * 100}%`,
                          background: visualSeriesColor(seg.idx),
                          opacity: isDimmed ? 0.35 : 1,
                          borderRadius: 2,
                          marginTop: 1,
                        }}
                      />
                    ))}
                </div>
                <span style={barXLabel(isActive)}>{wkLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional hover/pin tooltip — rendered as an HTML overlay
          positioned absolutely over the chart. Most callers wrap
          this component in WeeklyBarChartWithSessions which passes
          hideTooltip=true (the panel below the chart replaces it),
          so this code path is rarely hit. */}
      {!hideTooltip && activeWeek !== null && weekTotals[activeWeek] > 0 ? (
        <div style={tooltipOverlay} aria-live="polite">
          <div style={tooltipHeader}>
            <span style={tooltipWeekLabel}>{weekLabels[activeWeek]}</span>
            <span style={tooltipHint}>
              {pinnedWeek === activeWeek && hoveredWeek === null ? "tap to close" : "tap to pin"}
            </span>
          </div>
          <div style={tooltipDivider} />
          <div style={tooltipTotalRow}>
            <span style={tooltipLabel}>Total</span>
            <span style={tooltipValue}>
              {weekTotals[activeWeek].toFixed(decimals)}
              {unit ? ` ${unit}` : ""}
            </span>
            {hasAnyTime ? (
              <span style={tooltipTimeValue}>{fmtMins(weeklyMinutesTotals[activeWeek] ?? 0)}</span>
            ) : null}
          </div>
          {series
            .map((s, idx) => ({ s, idx, val: s.weeklyValues[activeWeek] ?? 0 }))
            .filter((seg) => seg.val > 0)
            .map((seg) => {
              const sessionDetail = seg.s.topSessionPerWeek?.[activeWeek] ?? null;
              return (
                <div key={seg.s.label} style={tooltipSeriesRow}>
                  <span
                    style={{
                      ...tooltipColorDot,
                      background: visualSeriesColor(seg.idx),
                    }}
                  />
                  <span style={tooltipSeriesLabel}>{seg.s.label}</span>
                  <span style={tooltipSeriesValue}>
                    {seg.val.toFixed(decimals)}
                    {unit ? ` ${unit}` : ""}
                  </span>
                  {sessionDetail ? <div style={tooltipDetailLine}>{sessionDetail}</div> : null}
                </div>
              );
            })}
        </div>
      ) : null}

      {/* Legend — only render when there's more than one active series */}
      {activeSeries.length > 1 ? (
        <div style={legend}>
          {activeSeries.map((s, idx) => (
            <span key={s.label} style={legendItem}>
              <span style={{ ...legendSwatch, background: visualSeriesColor(idx) }} />
              <span style={{ opacity: 0.7, fontWeight: 800 }}>{s.label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const chartShell: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  padding: "12px 12px 10px",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.022))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  position: "relative",
  display: "grid",
  gap: 8,
};

const headerStack: CSSProperties = { display: "grid", gap: 6 };
const titleStyle: CSSProperties = { fontWeight: 900, fontSize: 13, letterSpacing: 0, opacity: 0.92 };
const chipRow: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const statChip: CSSProperties = {
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
const statChipLabel: CSSProperties = {
  opacity: 0.48,
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 9,
  letterSpacing: 0.6,
};
const statChipValue: CSSProperties = { opacity: 0.9 };
const timeChip: CSSProperties = {
  ...statChip,
  border: "1px solid rgba(251,199,92,0.18)",
  background: "rgba(251,199,92,0.05)",
};
const timeChipLabel: CSSProperties = { ...statChipLabel, color: "rgba(251,199,92,0.62)" };
const timeChipValue: CSSProperties = { color: "rgba(251,220,120,0.95)" };

const chartBody: CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "stretch",
  marginTop: 4,
};

const yAxis: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "flex-end",
  paddingTop: 12, // matches barValueLabel height so y-axis "max" aligns with top of bars
  paddingBottom: 18, // matches barXLabel height so "0" aligns with baseline
  paddingRight: 6,
  minWidth: 22,
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
  gap: 3,
  alignItems: "stretch",
  minWidth: 0,
};

// Per-bar HTML <button> — native button so iOS treats it as
// interactive (no double-tap-zoom, no zoom-to-fit).
const barButtonStyle: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 0,
  appearance: "none",
  WebkitAppearance: "none",
  margin: 0,
  padding: 0,
  background: "transparent",
  border: "none",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  touchAction: "manipulation",
};

function barValueLabel(isActive: boolean, hasValue: boolean): CSSProperties {
  return {
    height: 12,
    minHeight: 12,
    lineHeight: 1,
    fontSize: 9.5,
    fontWeight: isActive ? 900 : 700,
    color: !hasValue
      ? "transparent"
      : isActive
      ? "rgba(255,255,255,0.95)"
      : "rgba(255,255,255,0.55)",
    letterSpacing: 0.2,
    textAlign: "center",
    paddingBottom: 2,
  };
}

function barCellStyle(isActive: boolean): CSSProperties {
  return {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "stretch",
    minHeight: 0,
    padding: "0 1px",
    borderRadius: 4,
    background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
    transition: "background 100ms ease",
  };
}

function barXLabel(isActive: boolean): CSSProperties {
  return {
    height: 16,
    minHeight: 16,
    lineHeight: 1.2,
    fontSize: 8.5,
    fontWeight: isActive ? 800 : 700,
    color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)",
    textAlign: "center",
    paddingTop: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

// ─── Tooltip overlay styles ──────────────────────────────────────────────────

const tooltipOverlay: CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  maxWidth: "min(260px, calc(100% - 8px))",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(8,17,28,0.98)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  display: "grid",
  gap: 6,
  pointerEvents: "none",
  zIndex: 10,
};

const tooltipHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
};

const tooltipWeekLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "rgba(224,242,254,0.96)",
};

const tooltipHint: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: "rgba(255,255,255,0.36)",
};

const tooltipDivider: CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.08)",
};

const tooltipTotalRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 6,
};

const tooltipLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const tooltipValue: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.92)",
};

const tooltipTimeValue: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "rgba(251,220,120,0.92)",
  marginLeft: 6,
};

const tooltipSeriesRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "8px 1fr auto",
  alignItems: "center",
  columnGap: 6,
  rowGap: 2,
};

const tooltipColorDot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 2,
};

const tooltipSeriesLabel: CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.7)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tooltipSeriesValue: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.85)",
  whiteSpace: "nowrap",
};

const tooltipDetailLine: CSSProperties = {
  gridColumn: "2 / span 2",
  fontSize: 9.5,
  fontStyle: "italic",
  color: "rgba(255,255,255,0.5)",
  lineHeight: 1.3,
};

// ─── Legend styles ───────────────────────────────────────────────────────────

const legend: CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 2,
  paddingTop: 8,
  borderTop: "1px solid rgba(255,255,255,0.07)",
};
const legendItem: CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 11 };
const legendSwatch: CSSProperties = {
  display: "inline-block",
  width: 9,
  height: 9,
  borderRadius: 3,
  flexShrink: 0,
};
