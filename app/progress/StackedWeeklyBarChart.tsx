"use client";

import { useEffect, useMemo, useState } from "react";

export type StackedBarSeries = {
  label: string;
  color: string;
  weeklyValues: number[];
  weeklyMinutes?: number[];
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
}: {
  title: string;
  weekLabels: string[];
  series: StackedBarSeries[];
  unit?: string;
  decimals?: number;
  compact?: boolean;
  /** Fires whenever the user pins or unpins a week — wrappers use this
   *  to render a per-week detail panel underneath the chart. The chart
   *  still owns its own state; this is a one-way notification. */
  onPinnedWeekChange?: (weekIndex: number | null) => void;
}) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const [pinnedWeek, setPinnedWeek] = useState<number | null>(null);
  const activeWeek = hoveredWeek ?? pinnedWeek;

  useEffect(() => {
    onPinnedWeekChange?.(pinnedWeek);
    // intentionally omit onPinnedWeekChange from deps — callers are
    // expected to pass a stable reference; we only want to fire when
    // the pin index itself changes.
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

  const width = 700;
  const height = compact ? 196 : 256;
  const margin = { top: 20, right: 16, bottom: 44, left: 52 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const barWidth = Math.max(12, Math.min(26, (innerW / weekLabels.length) * 0.42));
  const barStep = innerW / weekLabels.length;

  const tickValues = [0, yMax / 2, yMax].map((v) => parseFloat(v.toFixed(decimals)));
  const totalMiles = weekTotals.reduce((a, b) => a + b, 0);
  const maxMiles = Math.max(0, ...weekTotals);
  const avgMiles = weekLabels.length > 0 ? totalMiles / weekLabels.length : 0;
  const totalMinutesAll = weeklyMinutesTotals.reduce((a, b) => a + b, 0);
  const avgMinutes = weekLabels.length > 0 ? totalMinutesAll / weekLabels.length : 0;
  const fmt = (v: number) => `${v.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;

  return (
    <div style={chartShell}>
      <div style={headerStack}>
        <div style={titleStyle}>{title}</div>
        <div style={chipRow}>
          {[
            { label: "Total", value: fmt(totalMiles) },
            { label: "Best wk", value: fmt(maxMiles) },
            { label: "Avg / wk", value: fmt(avgMiles) },
          ].map((chip) => (
            <span key={chip.label} style={statChip}>
              <span style={statChipLabel}>{chip.label}</span>
              <span style={statChipValue}>{chip.value}</span>
            </span>
          ))}
          {hasAnyTime && [
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

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ marginTop: 8, display: "block", overflow: "visible" }}
        onPointerLeave={() => setHoveredWeek(null)}
        onClick={() => setPinnedWeek(null)}
      >
        <defs>
          <filter id="bar-shadow" x="-25%" y="-10%" width="150%" height="125%">
            <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="black" floodOpacity="0.22" />
          </filter>
          <filter id="col-glow" x="-35%" y="-25%" width="170%" height="150%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerH} stroke="rgba(255,255,255,0.08)" />
        <line x1={margin.left} y1={margin.top + innerH} x2={margin.left + innerW} y2={margin.top + innerH} stroke="rgba(255,255,255,0.14)" />

        {tickValues.map((tick) => {
          const tickY = margin.top + (1 - tick / yMax) * innerH;
          return (
            <g key={tick}>
              <line x1={margin.left} y1={tickY} x2={margin.left + innerW} y2={tickY} stroke="rgba(255,255,255,0.045)" strokeDasharray="2 7" />
              <text x={margin.left - 7} y={tickY + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.42)" fontWeight="700">
                {tick.toFixed(decimals)}
              </text>
            </g>
          );
        })}

        {weekLabels.map((label, wi) => {
          const cx = margin.left + wi * barStep + barStep / 2;
          const x = cx - barWidth / 2;
          const isActive = activeWeek === wi;
          const isDimmed = activeWeek !== null && !isActive;
          const isPinned = pinnedWeek === wi;
          const baseY = margin.top + innerH;
          const totalVal = series.reduce((sum, s) => sum + (s.weeklyValues[wi] ?? 0), 0);
          const railH = Math.max(4, (totalVal / yMax) * innerH);
          const railY = baseY - railH;
          const SEG_GAP = 3;

          let currentY = baseY;
          const visibleSegments = series
            .map((s, idx) => ({ s, idx, val: s.weeklyValues[wi] ?? 0 }))
            .filter((seg) => seg.val > 0);

          return (
            <g key={`bar-${wi}`}>
              {totalVal > 0 && (
                <rect
                  x={x - 2}
                  y={railY - 1}
                  width={barWidth + 4}
                  height={railH + 1}
                  rx={4}
                  fill={isActive ? "rgba(255,255,255,0.075)" : "rgba(255,255,255,0.035)"}
                  style={{ pointerEvents: "none" }}
                />
              )}

              <g opacity={isDimmed ? 0.32 : 1} filter={isActive ? "url(#col-glow)" : "url(#bar-shadow)"}>
                {visibleSegments.map((seg, segIdx) => {
                  const segmentH = (seg.val / yMax) * innerH;
                  currentY -= segmentH;
                  const drawY = segIdx === visibleSegments.length - 1 ? currentY : currentY + SEG_GAP;
                  const drawH = segIdx === visibleSegments.length - 1 ? segmentH : Math.max(0, segmentH - SEG_GAP);
                  if (drawH <= 0) return null;
                  return (
                    <rect
                      key={seg.s.label}
                      x={x}
                      y={drawY}
                      width={barWidth}
                      height={drawH}
                      rx={Math.min(3, drawH / 2)}
                      fill={visualSeriesColor(seg.idx)}
                      opacity={isActive ? 1 : 0.9}
                    />
                  );
                })}
              </g>

              <rect
                x={x - 5}
                y={margin.top}
                width={barWidth + 10}
                height={innerH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerEnter={() => setHoveredWeek(wi)}
                onClick={(e) => {
                  e.stopPropagation();
                  setPinnedWeek((p) => (p === wi ? null : wi));
                }}
              />

              <line x1={cx} y1={baseY} x2={cx} y2={baseY + 4} stroke={isActive ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.18)"} />
              {isPinned && (
                <rect x={cx - 17} y={baseY + 5} width={34} height={14} rx={4} fill="rgba(255,255,255,0.075)" stroke="rgba(255,255,255,0.18)" style={{ pointerEvents: "none" }} />
              )}
              <text x={cx} y={baseY + 16} textAnchor="middle" fontSize="10" fill={isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.42)"} fontWeight={isActive ? "800" : "500"}>
                {label}
              </text>
            </g>
          );
        })}

        {activeWeek !== null && weekTotals[activeWeek] > 0 ? (() => {
          const wi = activeWeek;
          const isPinnedTooltip = pinnedWeek === wi && hoveredWeek === null;
          const cx = margin.left + wi * barStep + barStep / 2;
          const activeEntries = series
            .map((s, idx) => ({ ...s, visualColor: visualSeriesColor(idx) }))
            .filter((s) => (s.weeklyValues[wi] ?? 0) > 0);
          const totalMinsWeek = weeklyMinutesTotals[wi] ?? 0;
          const weekHasTime = totalMinsWeek > 0;
          const maxNameLen = Math.max(5, ...activeEntries.map((e) => e.label.length));
          const tooltipW = Math.max(
            weekHasTime ? 204 : 162,
            weekHasTime ? 24 + maxNameLen * 7 + 126 : 24 + maxNameLen * 7 + 72
          );
          const MILES_COL = weekHasTime ? tooltipW - 62 : tooltipW - 8;
          const TIME_COL = tooltipW - 8;
          const WEEK_Y = 15;
          const DIVIDER_Y = 23;
          const TOTAL_Y = 38;
          const ROWS_START = 56;
          const ROW_H = 16;
          const tooltipH = activeEntries.length > 0 ? ROWS_START + activeEntries.length * ROW_H + 10 : TOTAL_Y + 16;
          const midX = margin.left + innerW / 2;
          const ty = margin.top;
          const tx = cx < midX ? margin.left + innerW - tooltipW : margin.left;

          return (
            <g>
              <line x1={cx} y1={margin.top} x2={cx} y2={margin.top + innerH} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 7" style={{ pointerEvents: "none" }} />
              <rect x={tx + 3} y={ty + 5} width={tooltipW} height={tooltipH} rx={10} fill="rgba(0,0,0,0.34)" />
              <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx={10} fill="rgba(8,17,28,0.98)" stroke={isPinnedTooltip ? "rgba(251,191,36,0.38)" : "rgba(255,255,255,0.16)"} strokeWidth="1" />
              <rect x={tx} y={ty} width={tooltipW} height={3} rx={10} fill={isPinnedTooltip ? "rgba(251,191,36,0.62)" : "rgba(56,189,248,0.58)"} />

              <text x={tx + 11} y={ty + WEEK_Y} fontSize="11" fill={isPinnedTooltip ? "rgba(251,220,140,0.95)" : "rgba(224,242,254,0.96)"} fontWeight="900">
                {weekLabels[wi]}
              </text>
              <text x={tx + tooltipW - 11} y={ty + WEEK_Y} fontSize="10" fill="rgba(255,255,255,0.36)" fontWeight="700" textAnchor="end">
                {isPinnedTooltip ? "click to close" : "click to pin"}
              </text>
              <line x1={tx + 8} y1={ty + DIVIDER_Y} x2={tx + tooltipW - 8} y2={ty + DIVIDER_Y} stroke="rgba(255,255,255,0.08)" />

              <text x={tx + 11} y={ty + TOTAL_Y} fontSize="11" fill="rgba(255,255,255,0.42)" fontWeight="800">
                Total
              </text>
              <text x={tx + MILES_COL} y={ty + TOTAL_Y} fontSize="11" fill="rgba(255,255,255,0.92)" textAnchor="end" fontWeight="700">
                {weekTotals[wi].toFixed(decimals)}{unit ? ` ${unit}` : ""}
              </text>
              {weekHasTime && (
                <text x={tx + TIME_COL} y={ty + TOTAL_Y} fontSize="11" fill="rgba(255,220,100,0.92)" textAnchor="end" fontWeight="700">
                  {fmtMins(totalMinsWeek)}
                </text>
              )}

              {activeEntries.map((s, i) => {
                const rowY = ty + ROWS_START + i * ROW_H;
                const mins = s.weeklyMinutes?.[wi] ?? 0;
                return (
                  <g key={s.label}>
                    <rect x={tx + 8} y={rowY - 10} width={7} height={7} rx={2} fill={s.visualColor} />
                    <text x={tx + 21} y={rowY} fontSize="11" fill="rgba(255,255,255,0.68)">
                      {s.label}
                    </text>
                    <text x={tx + MILES_COL} y={rowY} fontSize="11" fill="rgba(255,255,255,0.82)" textAnchor="end">
                      {s.weeklyValues[wi].toFixed(decimals)}{unit ? ` ${unit}` : ""}
                    </text>
                    {weekHasTime && (
                      <text x={tx + TIME_COL} y={rowY} fontSize="11" textAnchor="end" fill={mins > 0 ? "rgba(255,210,90,0.75)" : "rgba(255,255,255,0.18)"}>
                        {fmtMins(mins)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })() : null}

        {unit && (
          <text x={13} y={margin.top + innerH / 2} transform={`rotate(-90 13 ${margin.top + innerH / 2})`} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.34)" fontWeight="800">
            {unit}
          </text>
        )}
      </svg>

      {activeSeries.length > 1 && (
        <div style={legend}>
          {activeSeries.map((s, idx) => (
            <span key={s.label} style={legendItem}>
              <span style={{ ...legendSwatch, background: visualSeriesColor(idx) }} />
              <span style={{ opacity: 0.7, fontWeight: 800 }}>{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const chartShell: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  // Tightened from 14/10 → 12/8 — the chart card was wasting ~10px of
  // padding on every dashboard. Combined with the chip row at gap: 6
  // (was 10), the header region drops ~12px overall.
  padding: "12px 12px 8px",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.022))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

const headerStack: React.CSSProperties = { display: "grid", gap: 6 };
const titleStyle: React.CSSProperties = { fontWeight: 900, fontSize: 13, letterSpacing: 0, opacity: 0.92 };
const chipRow: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };
const statChip: React.CSSProperties = {
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
const statChipLabel: React.CSSProperties = {
  opacity: 0.48,
  fontWeight: 800,
  textTransform: "uppercase",
  fontSize: 9,
  letterSpacing: 0.6,
};
const statChipValue: React.CSSProperties = { opacity: 0.9 };
const timeChip: React.CSSProperties = {
  ...statChip,
  border: "1px solid rgba(251,199,92,0.18)",
  background: "rgba(251,199,92,0.05)",
};
const timeChipLabel: React.CSSProperties = {
  ...statChipLabel,
  color: "rgba(251,199,92,0.62)",
};
const timeChipValue: React.CSSProperties = { color: "rgba(251,220,120,0.95)" };
const legend: React.CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 6,
  paddingTop: 9,
  borderTop: "1px solid rgba(255,255,255,0.07)",
};
const legendItem: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 11 };
const legendSwatch: React.CSSProperties = {
  display: "inline-block",
  width: 9,
  height: 9,
  borderRadius: 3,
  flexShrink: 0,
};
