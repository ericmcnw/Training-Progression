"use client";

import { useMemo, useState } from "react";

type Point = {
  label: string;
  value: number;
  detailLines?: string[];
};

function formatValue(value: number, decimals: number, unit: string) {
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

function formatAxisNumber(value: number, decimals: number) {
  return value.toFixed(decimals);
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

export default function MetricLineChart({
  title,
  yLabel,
  xLabel,
  points,
  unit = "",
  decimals = 1,
  compact = false,
  valueLabel,
  targetValue,
  targetLabel,
  targetUnit,
  targetDecimals,
  yAxisTicks,
}: {
  title: string;
  yLabel: string;
  xLabel: string;
  points: Point[];
  unit?: string;
  decimals?: number;
  compact?: boolean;
  valueLabel?: string;
  targetValue?: number;
  targetLabel?: string;
  targetUnit?: string;
  targetDecimals?: number;
  yAxisTicks?: number[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const hitRadius = compact ? 12 : 10;

  function togglePoint(index: number) {
    setActiveIndex((current) => (current === index ? null : index));
  }

  const metrics = useMemo(() => {
    if (points.length === 0) return { max: 0, avg: 0, latest: 0, total: 0 };
    const values = points.map((p) => p.value);
    const total = values.reduce((sum, v) => sum + v, 0);
    const max = Math.max(...values);
    const latest = values[values.length - 1];
    const avg = total / values.length;
    return { max, avg, latest, total };
  }, [points]);

  const width = 700;
  const height = compact ? 196 : 256;
  const margin = { top: 20, right: 16, bottom: 44, left: 72 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const goalValue = targetValue !== undefined && Number.isFinite(targetValue) && targetValue > 0 ? targetValue : undefined;
  const yMax = niceAxisMax(Math.max(metrics.max, goalValue ?? 0));

  const series = points.map((p, i) => {
    const x = points.length === 1 ? margin.left + innerW / 2 : margin.left + (i / (points.length - 1)) * innerW;
    const y = margin.top + (1 - (p.value <= 0 ? 0 : p.value / yMax)) * innerH;
    return { ...p, x, y };
  });

  const linePath = series.map((p) => `${p.x},${p.y}`).join(" ");

  const markerCount = Math.min(6, Math.max(2, series.length));
  const markerIndices = new Set<number>();
  for (let i = 0; i < markerCount; i++) {
    const idx = Math.round((i / (markerCount - 1)) * (series.length - 1));
    markerIndices.add(idx);
  }

  const focusedIndex = activeIndex ?? hoverIndex;
  const hovered = focusedIndex !== null ? points[focusedIndex] : null;
  const hoveredSeriesPoint = focusedIndex !== null ? series[focusedIndex] : null;
  const hoverMetricLabel = valueLabel ?? yLabel;
  const hoverValueText =
    hovered && hoveredSeriesPoint
      ? `${hoverMetricLabel}: ${formatValue(hovered.value, decimals, unit)}`
      : "";
  const detailLines = hovered?.detailLines ?? [];
  const hoverTextWidth = Math.max(
    120,
    Math.max(
      (hovered?.label ?? "").length * 6.2 + 14,
      hoverValueText.length * 6.2 + 14,
      ...detailLines.map((line) => line.length * 6.2 + 14),
    ),
  );
  const hoverX =
    hoveredSeriesPoint && hoveredSeriesPoint.x + 10 + hoverTextWidth > width - margin.right
      ? hoveredSeriesPoint.x - hoverTextWidth - 10
      : (hoveredSeriesPoint?.x ?? 0) + 10;
  const hoverY = hoveredSeriesPoint ? Math.max(margin.top, hoveredSeriesPoint.y - 26) : 0;
  const goalY =
    goalValue !== undefined ? margin.top + (1 - (goalValue <= 0 ? 0 : goalValue / yMax)) * innerH : null;
  const tickValues = Array.from(new Set([0, metrics.max, yMax, ...(yAxisTicks ?? [])]))
    .filter((value) => value >= 0 && value <= yMax)
    .sort((a, b) => b - a);

  return (
    <div
      style={{
        border: "1px solid rgba(128,128,128,0.35)",
        borderRadius: 12,
        padding: 12,
        background: "rgba(128,128,128,0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          Max: {formatValue(metrics.max, decimals, unit)} | Latest: {formatValue(metrics.latest, decimals, unit)} | Avg:{" "}
          {formatValue(metrics.avg, decimals, unit)} | Total: {formatValue(metrics.total, decimals, unit)}
          {goalValue !== undefined
            ? ` | Target: ${formatValue(goalValue, targetDecimals ?? decimals, targetUnit ?? unit)}`
            : ""}
        </div>
      </div>

      {series.length === 0 ? (
        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>No data</div>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={compact ? 196 : 256} style={{ marginTop: 8 }}>
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onClick={() => {
              setHoverIndex(null);
              setActiveIndex(null);
            }}
          />
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerH} stroke="rgba(255,255,255,0.35)" />
          <line
            x1={margin.left}
            y1={margin.top + innerH}
            x2={margin.left + innerW}
            y2={margin.top + innerH}
            stroke="rgba(255,255,255,0.35)"
          />

          {tickValues.map((tick, index) => {
            const tickY = margin.top + (1 - (tick <= 0 ? 0 : tick / yMax)) * innerH;
            const isBaseline = tick === 0;
            return (
              <g key={`${tick}-${index}`}>
                <line
                  x1={margin.left}
                  y1={tickY}
                  x2={margin.left + innerW}
                  y2={tickY}
                  stroke={isBaseline ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)"}
                  strokeDasharray={isBaseline ? undefined : "4 4"}
                />
                <text
                  x={margin.left - 8}
                  y={tickY + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill={isBaseline ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.85)"}
                >
                  {formatAxisNumber(tick, decimals)}
                </text>
              </g>
            );
          })}
          {goalY !== null && (
            <>
              <line
                x1={margin.left}
                y1={goalY}
                x2={margin.left + innerW}
                y2={goalY}
                stroke="rgba(255,180,80,0.95)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <text x={margin.left + 8} y={goalY - 4} fontSize="11" fill="rgba(255,210,150,0.95)">
                {targetLabel ?? "Target"}
              </text>
            </>
          )}

          {series.length > 1 && <polyline fill="none" stroke="rgba(51,255,122,0.95)" strokeWidth="2" points={linePath} />}

          {series.map((p, idx) => (
            <g key={`${p.label}-${idx}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hitRadius}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onPointerEnter={() => {
                  if (activeIndex === null) setHoverIndex(idx);
                }}
                onPointerLeave={() => {
                  if (activeIndex === null) setHoverIndex(null);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePoint(idx);
                }}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill="rgba(51,255,122,0.95)"
                style={{ pointerEvents: "none" }}
              >
                <title>{`${p.label}: ${formatValue(p.value, decimals, unit)}`}</title>
              </circle>

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

          {hoveredSeriesPoint && (
            <g>
              <rect
                x={hoverX}
                y={hoverY}
                width={hoverTextWidth}
                height={34 + detailLines.length * 13}
                rx={6}
                fill="rgba(17,27,46,0.96)"
                stroke="rgba(51,255,122,0.65)"
              />
              <text x={hoverX + 7} y={hoverY + 13} fontSize="11" fill="rgba(255,255,255,0.95)">
                {hovered?.label}
              </text>
              <text x={hoverX + 7} y={hoverY + 27} fontSize="11" fill="rgba(255,255,255,0.95)">
                {hoverValueText}
              </text>
              {detailLines.map((line, idx) => (
                <text key={`${line}-${idx}`} x={hoverX + 7} y={hoverY + 40 + idx * 13} fontSize="11" fill="rgba(255,255,255,0.95)">
                  {line}
                </text>
              ))}
            </g>
          )}

          <text x={margin.left + innerW / 2} y={height - 4} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.8)">
            {xLabel}
          </text>
          <text
            x={18}
            y={margin.top + innerH / 2}
            transform={`rotate(-90 18 ${margin.top + innerH / 2})`}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.8)"
          >
            {unit ? `${yLabel} (${unit})` : yLabel}
          </text>
        </svg>
      )}
    </div>
  );
}
