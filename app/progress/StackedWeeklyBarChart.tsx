"use client";

import { useMemo, useState } from "react";

export type StackedBarSeries = {
  label: string;
  color: string;
  weeklyValues: number[];
  weeklyMinutes?: number[];
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

function fmtMins(mins: number): string {
  const m = Math.round(mins);
  if (m <= 0) return "—";
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
}: {
  title: string;
  weekLabels: string[];
  series: StackedBarSeries[];
  unit?: string;
  decimals?: number;
  compact?: boolean;
}) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  // Clicking a bar pins its tooltip — stays visible after pointer leaves.
  // Click the same bar again (or the chart background) to dismiss.
  const [pinnedWeek, setPinnedWeek] = useState<number | null>(null);
  const activeWeek = hoveredWeek ?? pinnedWeek;

  const weekTotals = useMemo(
    () => weekLabels.map((_, wi) => series.reduce((sum, s) => sum + (s.weeklyValues[wi] ?? 0), 0)),
    [weekLabels, series]
  );

  const weeklyMinutesTotals = useMemo(
    () => weekLabels.map((_, wi) => series.reduce((sum, s) => sum + (s.weeklyMinutes?.[wi] ?? 0), 0)),
    [weekLabels, series]
  );

  const hasAnyTime = weeklyMinutesTotals.some((m) => m > 0);

  const maxTotal = Math.max(0.001, ...weekTotals);
  const yMax = niceAxisMax(maxTotal);

  const width = 700;
  const height = compact ? 196 : 256;
  const margin = { top: 20, right: 16, bottom: 44, left: 52 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const barWidth = Math.max(8, (innerW / weekLabels.length) * 0.58);
  const barStep = innerW / weekLabels.length;

  const tickValues = [0, yMax / 2, yMax].map((v) => parseFloat(v.toFixed(decimals)));

  const totalMiles = weekTotals.reduce((a, b) => a + b, 0);
  const maxMiles = Math.max(0, ...weekTotals);
  const avgMiles = weekLabels.length > 0 ? totalMiles / weekLabels.length : 0;
  const totalMinutesAll = weeklyMinutesTotals.reduce((a, b) => a + b, 0);
  const avgMinutes = weekLabels.length > 0 ? totalMinutesAll / weekLabels.length : 0;

  const fmt = (v: number) => `${v.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "14px 14px 10px",
      background: "linear-gradient(160deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)",
    }}>
      {/* Header */}
      <div style={{ display: "grid", gap: 9 }}>
        <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.2, opacity: 0.95 }}>{title}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[
            { label: "Total", value: fmt(totalMiles) },
            { label: "Best wk", value: fmt(maxMiles) },
            { label: "Avg / wk", value: fmt(avgMiles) },
          ].map((chip) => (
            <span key={chip.label} style={{
              display: "inline-flex", gap: 4, alignItems: "baseline",
              padding: "3px 9px", borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.09)",
              background: "rgba(255,255,255,0.05)",
              fontSize: 11, fontWeight: 700,
            }}>
              <span style={{ opacity: 0.45, fontWeight: 800, textTransform: "uppercase", fontSize: 9, letterSpacing: 0.7 }}>{chip.label}</span>
              <span style={{ opacity: 0.9 }}>{chip.value}</span>
            </span>
          ))}
          {hasAnyTime && [
            { label: "Total time", value: fmtMins(totalMinutesAll) },
            { label: "Avg / wk", value: fmtMins(avgMinutes) },
          ].map((chip) => (
            <span key={chip.label + "-t"} style={{
              display: "inline-flex", gap: 4, alignItems: "baseline",
              padding: "3px 9px", borderRadius: 999,
              border: "1px solid rgba(251,199,92,0.2)",
              background: "rgba(251,199,92,0.06)",
              fontSize: 11, fontWeight: 700,
            }}>
              <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 9, letterSpacing: 0.7, color: "rgba(251,199,92,0.6)" }}>{chip.label}</span>
              <span style={{ color: "rgba(251,220,120,0.95)" }}>{chip.value}</span>
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ marginTop: 6 }}
        onPointerLeave={() => setHoveredWeek(null)}
        onClick={() => setPinnedWeek(null)}
      >
        <defs>
          {/* Soft drop shadow beneath each bar — calibrated to read on the
              chart's dark gradient panel without looking heavy. */}
          <filter id="bar-shadow" x="-25%" y="-10%" width="150%" height="125%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="black" floodOpacity="0.32" />
          </filter>

          {/* Bloom glow applied to the hovered column */}
          <filter id="col-glow" x="-35%" y="-25%" width="170%" height="150%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Axes */}
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerH} stroke="rgba(255,255,255,0.15)" />
        <line x1={margin.left} y1={margin.top + innerH} x2={margin.left + innerW} y2={margin.top + innerH} stroke="rgba(255,255,255,0.15)" />

        {/* Y-grid + tick labels */}
        {tickValues.map((tick) => {
          const tickY = margin.top + (1 - tick / yMax) * innerH;
          return (
            <g key={tick}>
              <line x1={margin.left} y1={tickY} x2={margin.left + innerW} y2={tickY}
                stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" />
              <text x={margin.left - 7} y={tickY + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.45)">
                {tick.toFixed(decimals)}
              </text>
            </g>
          );
        })}

        {/* Bars — Direction A: solid flat segments separated by 2px gaps
            that reveal the chart panel background, one rounded top corner
            cap per bar, soft drop shadow beneath the whole stack, hairline
            highlight along the top edge to catch light. No gradients. */}
        {weekLabels.map((label, wi) => {
          const cx = margin.left + wi * barStep + barStep / 2;
          const x = cx - barWidth / 2;
          const isActive = activeWeek === wi;
          const isDimmed = activeWeek !== null && !isActive;
          const isPinned = pinnedWeek === wi;
          const baseY = margin.top + innerH;
          const totalVal = series.reduce((sum, s) => sum + (s.weeklyValues[wi] ?? 0), 0);
          const totalBarH = (totalVal / yMax) * innerH;
          const barTopY = baseY - totalBarH;
          // Subtle radius — barely-rounded so the bars still feel architectural
          // and dense, just softened at the top. Matches the small 4px pyramid
          // bar radius in ClimbingProgressView for visual consistency.
          const cornerR = Math.min(4, totalBarH / 2);
          // Gap between stacked segments. Reveals the chart panel background,
          // giving the bar a clean "stacked card" feel.
          const SEG_GAP = 2;

          // Path with rounded TOP corners only — bottom sits on the axis line.
          const clipId = `bar-clip-${wi}`;
          const roundedTopPath = totalBarH > 0
            ? `M ${x},${barTopY + cornerR} Q ${x},${barTopY} ${x + cornerR},${barTopY} L ${x + barWidth - cornerR},${barTopY} Q ${x + barWidth},${barTopY} ${x + barWidth},${barTopY + cornerR} L ${x + barWidth},${baseY} L ${x},${baseY} Z`
            : "";

          let currentY = baseY;
          const visibleSegments = series
            .map((s, idx) => ({ s, idx, val: s.weeklyValues[wi] ?? 0 }))
            .filter((seg) => seg.val > 0);

          return (
            <g key={`bar-${wi}`}>
              {totalBarH > 0 && (
                <defs>
                  <clipPath id={clipId}>
                    <path d={roundedTopPath} />
                  </clipPath>
                </defs>
              )}

              {/* Segments — clipped to a single rounded-top container.
                  Each non-topmost segment loses 2px from its top edge,
                  creating a transparent gap above it. Inside the clipPath,
                  the gaps reveal the chart panel background. */}
              <g
                opacity={isDimmed ? 0.35 : 1}
                filter={isActive ? "url(#col-glow)" : "url(#bar-shadow)"}
                clipPath={totalBarH > 0 ? `url(#${clipId})` : undefined}
              >
                {visibleSegments.map((seg, segIdx) => {
                  const barH = (seg.val / yMax) * innerH;
                  currentY -= barH;
                  const segY = currentY;
                  const isTopmost = segIdx === visibleSegments.length - 1;
                  const drawY = isTopmost ? segY : segY + SEG_GAP;
                  const drawH = isTopmost ? barH : Math.max(0, barH - SEG_GAP);
                  if (drawH <= 0) return null;
                  return (
                    <rect
                      key={seg.s.label}
                      x={x}
                      y={drawY}
                      width={barWidth}
                      height={drawH}
                      fill={seg.s.color}
                    />
                  );
                })}
              </g>

              {/* Hairline highlight along the rounded top — catches "light"
                  and defines the bar edge without making it look heavy. */}
              {totalBarH > 0 && (
                <path
                  d={roundedTopPath}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* Transparent hit area — hover shows tooltip, click pins it */}
              <rect
                x={x - 4} y={margin.top}
                width={barWidth + 8} height={innerH}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerEnter={() => setHoveredWeek(wi)}
                onClick={(e) => {
                  e.stopPropagation();
                  setPinnedWeek((p) => (p === wi ? null : wi));
                }}
              />

              {/* X-axis label — pinned weeks render with a subtle pill outline so the user knows it's "stuck" */}
              <line
                x1={cx} y1={margin.top + innerH}
                x2={cx} y2={margin.top + innerH + 4}
                stroke={isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}
              />
              {isPinned && (
                <rect
                  x={cx - 17} y={margin.top + innerH + 5}
                  width={34} height={14} rx={4}
                  fill="rgba(100,170,255,0.12)"
                  stroke="rgba(100,170,255,0.35)"
                  style={{ pointerEvents: "none" }}
                />
              )}
              <text
                x={cx} y={margin.top + innerH + 16}
                textAnchor="middle" fontSize="10"
                fill={isActive ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.42)"}
                fontWeight={isActive ? "700" : "400"}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Tooltip — shows for hover OR pinned week. Hover takes precedence. */}
        {activeWeek !== null && weekTotals[activeWeek] > 0 ? (() => {
          const wi = activeWeek;
          const isPinnedTooltip = pinnedWeek === wi && hoveredWeek === null;
          const cx = margin.left + wi * barStep + barStep / 2;
          const activeEntries = series.filter((s) => (s.weeklyValues[wi] ?? 0) > 0);
          const totalMinsWeek = weeklyMinutesTotals[wi] ?? 0;
          const weekHasTime = totalMinsWeek > 0;

          const maxNameLen = Math.max(5, ...activeEntries.map((e) => e.label.length));
          const tooltipW = Math.max(
            weekHasTime ? 188 : 148,
            weekHasTime ? 22 + maxNameLen * 7 + 116 : 22 + maxNameLen * 7 + 62
          );

          const MILES_COL = weekHasTime ? tooltipW - 62 : tooltipW - 8;
          const TIME_COL  = tooltipW - 8;
          const WEEK_Y      = 15;
          const DIVIDER_Y   = 23;
          const TOTAL_Y     = 38;
          const ROWS_START  = 56;
          const ROW_H       = 16;

          const tooltipH = activeEntries.length > 0
            ? ROWS_START + activeEntries.length * ROW_H + 10
            : TOTAL_Y + 16;

          // Pin tooltip to the top corner furthest from the hovered bar so it never overlaps bars
          const midX = margin.left + innerW / 2;
          const ty = margin.top;
          const tx = cx < midX
            ? margin.left + innerW - tooltipW  // bar on left → tooltip top-right
            : margin.left;                      // bar on right → tooltip top-left

          return (
            <g>
              {/* Card shadow */}
              <rect x={tx + 2} y={ty + 3} width={tooltipW} height={tooltipH} rx={9}
                fill="rgba(0,0,0,0.4)" />
              {/* Card — pinned tooltips get a warmer amber accent so the user
                  knows it's "stuck" and not just a hover preview. */}
              <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx={9}
                fill="rgba(6,12,30,0.97)"
                stroke={isPinnedTooltip ? "rgba(251,191,36,0.35)" : "rgba(120,180,255,0.2)"}
                strokeWidth="1" />
              {/* Top accent line */}
              <rect x={tx} y={ty} width={tooltipW} height={2} rx={9}
                fill={isPinnedTooltip ? "rgba(251,191,36,0.55)" : "rgba(100,170,255,0.35)"} />

              {/* Week label */}
              <text x={tx + 11} y={ty + WEEK_Y} fontSize="11"
                fill={isPinnedTooltip ? "rgba(251,220,140,0.95)" : "rgba(160,215,255,0.95)"}
                fontWeight="800" letterSpacing="0.2">
                {weekLabels[wi]}
              </text>

              {/* Close hint — only when pinned. Tells the user how to dismiss. */}
              {isPinnedTooltip && (
                <text x={tx + tooltipW - 11} y={ty + WEEK_Y} fontSize="10"
                  fill="rgba(255,255,255,0.4)" fontWeight="700" textAnchor="end">
                  ✕ click to close
                </text>
              )}

              {/* Divider */}
              <line x1={tx + 8} y1={ty + DIVIDER_Y} x2={tx + tooltipW - 8} y2={ty + DIVIDER_Y}
                stroke="rgba(255,255,255,0.07)" />

              {/* Total row */}
              <text x={tx + 11} y={ty + TOTAL_Y} fontSize="11"
                fill="rgba(255,255,255,0.38)" fontWeight="600">
                Total
              </text>
              <text x={tx + MILES_COL} y={ty + TOTAL_Y} fontSize="11"
                fill="rgba(255,255,255,0.92)" textAnchor="end" fontWeight="700">
                {weekTotals[wi].toFixed(decimals)}{unit ? ` ${unit}` : ""}
              </text>
              {weekHasTime && (
                <text x={tx + TIME_COL} y={ty + TOTAL_Y} fontSize="11"
                  fill="rgba(255,220,100,0.92)" textAnchor="end" fontWeight="700">
                  {fmtMins(totalMinsWeek)}
                </text>
              )}

              {/* Per-activity rows */}
              {activeEntries.map((s, i) => {
                const rowY = ty + ROWS_START + i * ROW_H;
                const mins = s.weeklyMinutes?.[wi] ?? 0;
                return (
                  <g key={s.label}>
                    <circle cx={tx + 11} cy={rowY - 4} r={3.5} fill={s.color}
                      style={{ filter: `drop-shadow(0 0 3px ${s.color})` }} />
                    <text x={tx + 21} y={rowY} fontSize="11" fill="rgba(255,255,255,0.68)">
                      {s.label}
                    </text>
                    <text x={tx + MILES_COL} y={rowY} fontSize="11"
                      fill="rgba(255,255,255,0.82)" textAnchor="end">
                      {s.weeklyValues[wi].toFixed(decimals)}{unit ? ` ${unit}` : ""}
                    </text>
                    {weekHasTime && (
                      <text x={tx + TIME_COL} y={rowY} fontSize="11" textAnchor="end"
                        fill={mins > 0 ? "rgba(255,210,90,0.75)" : "rgba(255,255,255,0.18)"}>
                        {fmtMins(mins)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })() : null}

        {/* Y axis unit label */}
        {unit && (
          <text
            x={13} y={margin.top + innerH / 2}
            transform={`rotate(-90 13 ${margin.top + innerH / 2})`}
            textAnchor="middle" fontSize="10"
            fill="rgba(255,255,255,0.3)"
          >
            {unit}
          </text>
        )}
      </svg>

      {/* Legend */}
      {series.filter((s) => s.weeklyValues.some((v) => v > 0)).length > 1 && (
        <div style={{
          display: "flex", gap: 14, flexWrap: "wrap",
          marginTop: 4, paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          {series.filter((s) => s.weeklyValues.some((v) => v > 0)).map((s) => (
            <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: 2,
                background: s.color,
                boxShadow: `0 0 6px ${s.color}88`,
                flexShrink: 0,
              }} />
              <span style={{ opacity: 0.65, fontWeight: 600 }}>{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
