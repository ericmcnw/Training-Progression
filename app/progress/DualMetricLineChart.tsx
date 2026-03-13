"use client";

import { useMemo, useState } from "react";

type Point = {
  label: string;
  left: number;
  right: number;
  rightDetailLines?: string[];
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

function fmt(value: number, decimals: number, unit: string) {
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}
function fmtNum(value: number, decimals: number) {
  return value.toFixed(decimals);
}

export default function DualMetricLineChart({
  title,
  xLabel,
  leftLabel,
  rightLabel,
  leftUnit = "",
  rightUnit = "",
  leftDecimals = 1,
  rightDecimals = 0,
  points,
  compact = false,
  extraLatestLabel,
  extraLatestValue,
  extraLatestUnit = "",
  extraLatestDecimals = 0,
  leftTargetValue,
  rightTargetValue,
  leftTargetLabel,
  rightTargetLabel,
}: {
  title: string;
  xLabel: string;
  leftLabel: string;
  rightLabel: string;
  leftUnit?: string;
  rightUnit?: string;
  leftDecimals?: number;
  rightDecimals?: number;
  points: Point[];
  compact?: boolean;
  extraLatestLabel?: string;
  extraLatestValue?: number;
  extraLatestUnit?: string;
  extraLatestDecimals?: number;
  leftTargetValue?: number;
  rightTargetValue?: number;
  leftTargetLabel?: string;
  rightTargetLabel?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const hitRadius = compact ? 12 : 10;

  function togglePoint(index: number) {
    setHoverIndex((current) => (current === index ? null : index));
  }

  const width = 700;
  const height = compact ? 216 : 266;
  const margin = { top: 22, right: 64, bottom: 46, left: 72 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const stats = useMemo(() => {
    if (!points.length) return { leftMax: 0, rightMax: 0, leftLatest: 0, rightLatest: 0 };
    return {
      leftMax: Math.max(...points.map((p) => p.left)),
      rightMax: Math.max(...points.map((p) => p.right)),
      leftLatest: points[points.length - 1].left,
      rightLatest: points[points.length - 1].right,
    };
  }, [points]);

  const leftGoal = leftTargetValue !== undefined && Number.isFinite(leftTargetValue) && leftTargetValue > 0 ? leftTargetValue : undefined;
  const rightGoal =
    rightTargetValue !== undefined && Number.isFinite(rightTargetValue) && rightTargetValue > 0 ? rightTargetValue : undefined;
  const leftAxisMax = niceAxisMax(Math.max(stats.leftMax, leftGoal ?? 0) * 1.1);
  const rightAxisMax = niceAxisMax(Math.max(stats.rightMax, rightGoal ?? 0) * 1.1);

  const plotted = points.map((p, i) => {
    const x = points.length === 1 ? margin.left + innerW / 2 : margin.left + (i / (points.length - 1)) * innerW;
    const yLeft = margin.top + (1 - p.left / leftAxisMax) * innerH;
    const yRight = margin.top + (1 - p.right / rightAxisMax) * innerH;
    return { ...p, x, yLeft, yRight };
  });

  const leftLine = plotted.map((p) => `${p.x},${p.yLeft}`).join(" ");
  const rightLine = plotted.map((p) => `${p.x},${p.yRight}`).join(" ");

  const markerCount = Math.min(6, Math.max(2, plotted.length));
  const markerIndices = new Set<number>();
  for (let i = 0; i < markerCount; i++) {
    const idx = Math.round((i / (markerCount - 1)) * (plotted.length - 1));
    markerIndices.add(idx);
  }

  const hovered = hoverIndex !== null ? plotted[hoverIndex] : null;
  const detailLines = hovered?.rightDetailLines ?? [];
  const line1 = hovered ? `${hovered.label}` : "";
  const line2 = hovered ? `${leftLabel}: ${fmt(hovered.left, leftDecimals, leftUnit)}` : "";
  const line3 = hovered ? `${rightLabel}: ${fmt(hovered.right, rightDecimals, rightUnit)}` : "";
  const tooltipLines = [line1, line2, line3, ...detailLines];
  const tipWidth = Math.max(150, ...tooltipLines.map((l) => l.length * 6.3 + 14));
  const tipHeight = 8 + tooltipLines.length * 13;
  const tipX = hovered
    ? hovered.x + 10 + tipWidth > width - margin.right
      ? hovered.x - tipWidth - 10
      : hovered.x + 10
    : 0;
  const tipY = hovered ? Math.max(margin.top, Math.min(hovered.yLeft, hovered.yRight) - tipHeight + 8) : 0;
  const leftGoalY = leftGoal !== undefined ? margin.top + (1 - leftGoal / leftAxisMax) * innerH : null;
  const rightGoalY = rightGoal !== undefined ? margin.top + (1 - rightGoal / rightAxisMax) * innerH : null;
  const leftPeakY = margin.top + (1 - (stats.leftMax > 0 ? stats.leftMax : 0) / leftAxisMax) * innerH;
  const rightPeakY = margin.top + (1 - (stats.rightMax > 0 ? stats.rightMax : 0) / rightAxisMax) * innerH;
  const showLeftPeakTick = stats.leftMax > 0 && stats.leftMax !== leftAxisMax;
  const showRightPeakTick = stats.rightMax > 0 && stats.rightMax !== rightAxisMax;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.85 }}>
          {leftLabel} latest: {fmt(stats.leftLatest, leftDecimals, leftUnit)} | {rightLabel} latest:{" "}
          {fmt(stats.rightLatest, rightDecimals, rightUnit)}
          {extraLatestLabel && extraLatestValue !== undefined
            ? ` | ${extraLatestLabel}: ${fmt(extraLatestValue, extraLatestDecimals, extraLatestUnit)}`
            : ""}
          {leftGoal !== undefined ? ` | ${leftTargetLabel ?? `${leftLabel} target`}: ${fmt(leftGoal, leftDecimals, leftUnit)}` : ""}
          {rightGoal !== undefined ? ` | ${rightTargetLabel ?? `${rightLabel} target`}: ${fmt(rightGoal, rightDecimals, rightUnit)}` : ""}
        </div>
      </div>

      {plotted.length === 0 ? (
        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>No data</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={compact ? 216 : 266} style={{ marginTop: 8 }}>
          <rect x={0} y={0} width={width} height={height} fill="transparent" onClick={() => setHoverIndex(null)} />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerH} stroke="rgba(255,255,255,0.35)" />
          <line
            x1={margin.left + innerW}
            y1={margin.top}
            x2={margin.left + innerW}
            y2={margin.top + innerH}
            stroke="rgba(255,255,255,0.35)"
          />
          <line
            x1={margin.left}
            y1={margin.top + innerH}
            x2={margin.left + innerW}
            y2={margin.top + innerH}
            stroke="rgba(255,255,255,0.35)"
          />
          <text
            x={18}
            y={margin.top + innerH / 2}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.8)"
            transform={`rotate(-90 18 ${margin.top + innerH / 2})`}
          >
            {leftUnit ? `${leftLabel} (${leftUnit})` : leftLabel}
          </text>
          <text
            x={width - 18}
            y={margin.top + innerH / 2}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.8)"
            transform={`rotate(90 ${width - 18} ${margin.top + innerH / 2})`}
          >
            {rightUnit ? `${rightLabel} (${rightUnit})` : rightLabel}
          </text>
          {leftGoalY !== null && (
            <>
              <line
                x1={margin.left}
                y1={leftGoalY}
                x2={margin.left + innerW}
                y2={leftGoalY}
                stroke="rgba(255,180,80,0.95)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <text x={margin.left + 8} y={leftGoalY - 4} fontSize="11" fill="rgba(255,210,150,0.95)">
                {leftTargetLabel ?? "Target"}
              </text>
            </>
          )}
          {rightGoalY !== null && (
            <>
              <line
                x1={margin.left}
                y1={rightGoalY}
                x2={margin.left + innerW}
                y2={rightGoalY}
                stroke="rgba(180,210,255,0.95)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <text x={margin.left + innerW - 8} y={rightGoalY - 4} textAnchor="end" fontSize="11" fill="rgba(200,220,255,0.95)">
                {rightTargetLabel ?? "Target"}
              </text>
            </>
          )}

          <text x={margin.left - 8} y={margin.top + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.82)">
            {fmtNum(leftAxisMax, leftDecimals)}
          </text>
          <text x={margin.left - 8} y={margin.top + innerH + 4} textAnchor="end" fontSize="11" fill="rgba(255,255,255,0.72)">
            0
          </text>
          {showLeftPeakTick ? (
            <text
              x={margin.left - 8}
              y={Math.max(margin.top + 12, leftPeakY + 4)}
              textAnchor="end"
              fontSize="11"
              fill="rgba(255,255,255,0.92)"
            >
              {fmtNum(stats.leftMax, leftDecimals)}
            </text>
          ) : null}

          <text x={width - margin.right + 6} y={margin.top + innerH + 4} fontSize="11" fill="rgba(255,255,255,0.72)">
            0
          </text>
          <text x={width - margin.right + 6} y={margin.top + 4} fontSize="11" fill="rgba(255,255,255,0.82)">
            {fmtNum(rightAxisMax, rightDecimals)}
          </text>
          {showRightPeakTick ? (
            <text x={width - margin.right + 6} y={Math.max(margin.top + 12, rightPeakY + 4)} fontSize="11" fill="rgba(255,255,255,0.92)">
              {fmtNum(stats.rightMax, rightDecimals)}
            </text>
          ) : null}

          {plotted.length > 1 && (
            <>
              <polyline fill="none" stroke="rgba(51,255,122,1)" strokeWidth="2.8" points={leftLine} />
              <polyline fill="none" stroke="rgba(120,190,255,0.6)" strokeWidth="1.6" points={rightLine} />
            </>
          )}

          {plotted.map((p, idx) => (
            <g key={`${p.label}-${idx}`}>
              <circle
                cx={p.x}
                cy={p.yLeft}
                r={hitRadius}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePoint(idx);
                }}
              />
              <circle
                cx={p.x}
                cy={p.yRight}
                r={hitRadius}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePoint(idx);
                }}
              />
              <circle
                cx={p.x}
                cy={p.yLeft}
                r={4.2}
                fill="rgba(51,255,122,1)"
                style={{ pointerEvents: "none" }}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePoint(idx);
                }}
              />
              <circle
                cx={p.x}
                cy={p.yRight}
                r={2.8}
                fill="rgba(120,190,255,0.72)"
                style={{ pointerEvents: "none" }}
                onMouseEnter={() => setHoverIndex(idx)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePoint(idx);
                }}
              />

              {markerIndices.has(idx) && (
                <>
                  <line
                    x1={p.x}
                    y1={margin.top + innerH}
                    x2={p.x}
                    y2={margin.top + innerH + 6}
                    stroke="rgba(255,255,255,0.45)"
                  />
                  <text
                    x={p.x}
                    y={margin.top + innerH + 18}
                    textAnchor="middle"
                    fontSize="10"
                    fill="rgba(255,255,255,0.72)"
                  >
                    {p.label}
                  </text>
                </>
              )}
            </g>
          ))}

          {hovered && (
            <g>
              <rect
                x={tipX}
                y={tipY}
                width={tipWidth}
                height={tipHeight}
                rx={6}
                fill="rgba(17,27,46,0.96)"
                stroke="rgba(51,255,122,0.65)"
              />
              {tooltipLines.map((line, idx) => (
                <text key={`${line}-${idx}`} x={tipX + 7} y={tipY + 13 + idx * 13} fontSize="11" fill="rgba(255,255,255,0.96)">
                  {line}
                </text>
              ))}
            </g>
          )}

          <text x={margin.left + innerW / 2} y={height - 4} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.8)">
            {xLabel}
          </text>
        </svg>
      )}

      <div style={{ marginTop: 4, fontSize: 11, opacity: 0.75, display: "flex", gap: 12 }}>
        <span>
          <span style={{ color: "rgba(51,255,122,0.95)" }}>●</span> {leftLabel}
        </span>
        <span>
          <span style={{ color: "rgba(120,190,255,0.95)" }}>●</span> {rightLabel}
        </span>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.06)",
};
