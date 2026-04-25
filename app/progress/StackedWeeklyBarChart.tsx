"use client";

import { useMemo, useState } from "react";

export type StackedBarSeries = {
  label: string; // activity type name
  color: string; // rgba fill
  weeklyValues: number[]; // one per week, same length as weekLabels
};

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

export default function StackedWeeklyBarChart({
  title,
  weekLabels,
  series,
  unit = "mi",
  decimals = 1,
}: {
  title: string;
  weekLabels: string[];
  series: StackedBarSeries[];
  unit?: string;
  decimals?: number;
}) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  const weekTotals = useMemo(
    () => weekLabels.map((_, wi) => series.reduce((sum, s) => sum + (s.weeklyValues[wi] ?? 0), 0)),
    [weekLabels, series]
  );

  const maxTotal = Math.max(0.001, ...weekTotals);
  const yMax = niceAxisMax(maxTotal);

  const width = 700;
  const height = 256;
  const margin = { top: 20, right: 16, bottom: 44, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const barWidth = Math.max(8, (innerW / weekLabels.length) * 0.62);
  const barStep = innerW / weekLabels.length;

  // y-axis ticks
  const tickValues = [0, yMax / 2, yMax].map((v) => parseFloat(v.toFixed(decimals)));

  const totalMiles = weekTotals.reduce((a, b) => a + b, 0);
  const maxMiles = Math.max(0, ...weekTotals);
  const avgMiles = weekLabels.length > 0 ? totalMiles / weekLabels.length : 0;

  const summaryChips = [
    { label: "Total", value: `${totalMiles.toFixed(decimals)} ${unit}` },
    { label: "Max week", value: `${maxMiles.toFixed(decimals)} ${unit}` },
    { label: "Avg/wk", value: `${avgMiles.toFixed(decimals)} ${unit}` },
  ];

  return (
    <div style={{ border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, padding: 12, background: "rgba(128,128,128,0.06)" }}>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>{title}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {summaryChips.map((chip) => (
            <span key={chip.label} style={{ display: "inline-flex", gap: 4, alignItems: "baseline", padding: "3px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", fontSize: 11, fontWeight: 700 }}>
              <span style={{ opacity: 0.58, fontWeight: 800, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>{chip.label}</span>
              <span>{chip.value}</span>
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={256}
        style={{ marginTop: 8 }}
        onPointerLeave={() => setHoveredWeek(null)}
      >
        {/* Axes */}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerH} stroke="rgba(255,255,255,0.35)" />
        <line x1={margin.left} y1={margin.top + innerH} x2={margin.left + innerW} y2={margin.top + innerH} stroke="rgba(255,255,255,0.35)" />

        {/* Y ticks */}
        {tickValues.map((tick) => {
          const tickY = margin.top + (1 - tick / yMax) * innerH;
          return (
            <g key={tick}>
              <line x1={margin.left} y1={tickY} x2={margin.left + innerW} y2={tickY} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              <text x={margin.left - 6} y={tickY + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.72)">
                {tick.toFixed(decimals)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {weekLabels.map((label, wi) => {
          const cx = margin.left + wi * barStep + barStep / 2;
          const x = cx - barWidth / 2;
          const isHovered = hoveredWeek === wi;
          let currentY = margin.top + innerH;

          return (
            <g key={`bar-${wi}`}>
              {series.map((s) => {
                const val = s.weeklyValues[wi] ?? 0;
                if (val <= 0) return null;
                const barH = (val / yMax) * innerH;
                currentY -= barH;
                return (
                  <rect
                    key={s.label}
                    x={x}
                    y={currentY}
                    width={barWidth}
                    height={barH}
                    fill={s.color}
                    opacity={isHovered ? 1 : 0.85}
                    rx={2}
                  />
                );
              })}

              {/* Hit area */}
              <rect
                x={x - 4}
                y={margin.top}
                width={barWidth + 8}
                height={innerH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerEnter={() => setHoveredWeek(wi)}
              />

              {/* X label */}
              <line x1={cx} y1={margin.top + innerH} x2={cx} y2={margin.top + innerH + 5} stroke="rgba(255,255,255,0.4)" />
              <text x={cx} y={margin.top + innerH + 17} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.7)">
                {label}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {hoveredWeek !== null && weekTotals[hoveredWeek] > 0 ? (() => {
          const wi = hoveredWeek;
          const cx = margin.left + wi * barStep + barStep / 2;
          const activeLines = series
            .filter((s) => (s.weeklyValues[wi] ?? 0) > 0)
            .map((s) => `${s.label}: ${s.weeklyValues[wi].toFixed(decimals)} ${unit}`);
          const tooltipLines = [weekLabels[wi], `Total: ${weekTotals[wi].toFixed(decimals)} ${unit}`, ...activeLines];
          const tooltipW = Math.max(140, Math.max(...tooltipLines.map((l) => l.length * 6.2 + 20)));
          const tooltipH = 14 + tooltipLines.length * 14;
          const tx = cx + tooltipW + 10 > width - margin.right ? cx - tooltipW - 6 : cx + 6;
          const barTopY = margin.top + innerH - (weekTotals[wi] / yMax) * innerH;
          const ty = Math.max(margin.top, barTopY - 10);
          return (
            <g>
              <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx={6} fill="rgba(17,27,46,0.96)" stroke="rgba(78,148,255,0.5)" />
              {tooltipLines.map((line, i) => (
                <text key={`${line}-${i}`} x={tx + 8} y={ty + 13 + i * 14} fontSize="11" fill={i === 0 ? "rgba(167,224,255,0.9)" : "rgba(255,255,255,0.9)"} fontWeight={i === 0 ? "800" : "400"}>
                  {line}
                </text>
              ))}
            </g>
          );
        })() : null}

        {/* Y axis label */}
        <text
          x={14}
          y={margin.top + innerH / 2}
          transform={`rotate(-90 14 ${margin.top + innerH / 2})`}
          textAnchor="middle"
          fontSize="11"
          fill="rgba(255,255,255,0.75)"
        >
          {unit}
        </text>
      </svg>

      {/* Legend */}
      {series.filter((s) => s.weeklyValues.some((v) => v > 0)).length > 1 ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {series.filter((s) => s.weeklyValues.some((v) => v > 0)).map((s) => (
            <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, opacity: 0.82 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
