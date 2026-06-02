"use client";

import { useState, type CSSProperties } from "react";

// Tiny interactive sparkline used on the routine detail page and on
// the strength dashboard's Top Exercises cards. Same visual shape as
// the static sparklines those pages used to render (line + soft fill +
// last-point dot), but with hover/tap detail: a crosshair, a snap dot,
// and a date+value label that appears in a `detail` slot below.
//
// Designed to be drop-in cheap — caller controls width via CSS; height
// is a fixed prop. Points are positioned linearly (one per session) so
// callers don't need to think about date scaling.
export type SparklinePoint = {
  date: Date;
  /** The metric value at this point (top weight, etc.). */
  value: number;
  /** Pre-formatted label shown in the detail row on hover, e.g.
   *  "210 lb × 3 reps". Caller has the context to format. */
  label: string;
};

export default function InteractiveSparkline({
  points,
  accent,
  height = 28,
}: {
  points: SparklinePoint[];
  /** rgba(...) color from the family palette. */
  accent: string;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Need at least 2 points to plot a meaningful line.
  if (points.length < 2) {
    return (
      <div style={emptyStyle}>
        Need 2+ sessions to plot
      </div>
    );
  }

  const W = 100;
  const H = height;
  const lastIdx = points.length - 1;
  const xOf = (i: number) => (i / lastIdx) * W;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const yOf = (v: number) => H - ((v - min) / range) * (H - 4) - 2;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath = `${path} L ${W} ${H} L 0 ${H} Z`;

  const fillColor = accent.replace("0.9)", "0.12)").replace("0.92)", "0.12)").replace("0.95)", "0.12)");
  const lineColor = accent;

  const activeIdx = hoverIdx ?? lastIdx;
  const active = points[activeIdx];

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: H, overflow: "visible" }}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {/* Filled area */}
        <path d={areaPath} fill={fillColor} stroke="none" />
        {/* Line */}
        <path
          d={path}
          stroke={lineColor}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Last/active point dot */}
        <circle cx={xOf(activeIdx)} cy={yOf(active.value)} r={hoverIdx === null ? 2.2 : 3} fill={lineColor} />

        {/* Crosshair while hovering */}
        {hoverIdx !== null ? (
          <line
            x1={xOf(hoverIdx)}
            y1={0}
            x2={xOf(hoverIdx)}
            y2={H}
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={0.8}
            strokeDasharray="2 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* Invisible hit slabs per point (split the width evenly so any
            pointer position snaps to the nearest data point). */}
        {points.map((_, i) => {
          const slab = W / points.length;
          return (
            <rect
              key={i}
              x={i * slab}
              y={0}
              width={slab}
              height={H}
              fill="transparent"
              onPointerEnter={() => setHoverIdx(i)}
              style={{ cursor: "default" }}
            />
          );
        })}
      </svg>

      {/* Tiny detail strip — fixed height so the layout doesn't jump
          when hovering on/off. */}
      <div style={detailRowStyle(hoverIdx !== null)}>
        <span style={{ fontWeight: 800 }}>
          {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(active.date)}
        </span>
        <span style={{ opacity: 0.65 }}>·</span>
        <span style={{ fontWeight: 700 }}>{active.label}</span>
      </div>
    </div>
  );
}

const emptyStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.45,
  fontStyle: "italic",
  height: 28,
  display: "flex",
  alignItems: "center",
};

function detailRowStyle(hovering: boolean): CSSProperties {
  return {
    display: "flex",
    gap: 6,
    fontSize: 10.5,
    opacity: hovering ? 0.85 : 0.55,
    minHeight: 14,
    lineHeight: 1.25,
    transition: "opacity 120ms ease",
  };
}
