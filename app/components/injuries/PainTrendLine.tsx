"use client";

// Shared pain-trend line — one visual language for "pain over time" across the
// home/body injuries section (sm) and the injury detail page (lg). Auto-scales
// the y-axis to the data so a 1-2 point swing fills the height instead of
// vanishing on a flat 0-10 chart, calls out the selected (default latest)
// point, and lets you tap any point to read its date + level.

import { useState } from "react";

export type PainTrendPoint = {
  ymd: string;
  level: number;
  /** Routine logged the same session, if any — shown when a point is tapped. */
  routineName?: string | null;
  /** Aggravating factors tagged on that day's peak log — shown when tapped. */
  factors?: string[];
  /** Pain context for that day's peak log (e.g. AFTER_ACTIVITY). */
  context?: string;
};

const POST_ACTIVITY_CONTEXTS = new Set(["AFTER_ACTIVITY", "DURING_ACTIVITY"]);

function painLevelColor(level: number) {
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  return "#86EFAC";
}

function shortDate(ymd: string) {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const SIZES = {
  sm: { H: 54, padY: 7, callout: 12, axis: 9, dot: 2.5, dotSel: 4, hit: 11 },
  lg: { H: 124, padY: 10, callout: 16, axis: 11, dot: 3.5, dotSel: 6, hit: 16 },
} as const;

// The associated routine + aggravating factors for the selected point. Renders
// nothing when the point carries no metadata (e.g. the home card's trend), so
// the line stays backward-compatible.
function PointMeta({ point }: { point: PainTrendPoint }) {
  const hasFactors = (point.factors?.length ?? 0) > 0;
  if (!point.routineName && !hasFactors) return null;
  const afterPrefix = point.context && POST_ACTIVITY_CONTEXTS.has(point.context) ? "after " : "";
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {point.routineName ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}>
          {afterPrefix}{point.routineName}
        </span>
      ) : null}
      {point.factors?.map((f) => (
        <span
          key={f}
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid rgba(251,146,60,0.4)",
            background: "rgba(251,146,60,0.10)",
            color: "#FED7AA",
          }}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

export default function PainTrendLine({
  trend,
  size = "sm",
}: {
  trend: PainTrendPoint[];
  size?: "sm" | "lg";
}) {
  const [sel, setSel] = useState<number | null>(null);
  const s = SIZES[size];

  if (trend.length === 0) {
    return <div style={{ fontSize: size === "lg" ? 13 : 11.5, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>No pain logged yet.</div>;
  }
  if (trend.length === 1) {
    const only = trend[0];
    return (
      <div style={{ display: "grid", gap: 3 }}>
        <div style={{ fontSize: size === "lg" ? 15 : 12.5, fontWeight: 800 }}>
          <span style={{ color: painLevelColor(only.level) }}>{only.level}/10</span>{" "}
          <span style={{ opacity: 0.55, fontWeight: 700 }}>· {shortDate(only.ymd)}</span>
        </div>
        <PointMeta point={only} />
      </div>
    );
  }

  const levels = trend.map((d) => d.level);
  let lo = Math.max(0, Math.min(...levels) - 1);
  let hi = Math.min(10, Math.max(...levels) + 1);
  if (hi - lo < 3) {
    hi = Math.min(10, lo + 3);
    lo = Math.max(0, hi - 3);
  }
  const mid = Math.round((lo + hi) / 2);

  const W = 320;
  const H = s.H;
  const padX = 6;
  const x = (i: number) => padX + (i / (trend.length - 1)) * (W - padX * 2);
  const y = (lvl: number) => s.padY + (1 - (lvl - lo) / (hi - lo)) * (H - s.padY * 2);
  const line = trend.map((d, i) => `${x(i)},${y(d.level)}`).join(" ");

  const selected = sel != null ? trend[sel] : trend[trend.length - 1];
  const gridLevels = size === "lg" ? [lo, mid, hi] : [lo, hi];

  return (
    <div style={{ display: "grid", gap: size === "lg" ? 6 : 4 }}>
      <div style={{ display: "grid", gap: 3 }}>
        <div style={{ fontSize: s.callout, fontWeight: 800 }}>
          <span style={{ color: painLevelColor(selected.level) }}>{selected.level}/10</span>{" "}
          <span style={{ opacity: 0.55, fontWeight: 700 }}>· {shortDate(selected.ymd)}{sel == null ? " (latest)" : ""}</span>
        </div>
        <PointMeta point={selected} />
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", fontSize: s.axis, fontWeight: 800, color: "rgba(255,255,255,0.4)", paddingBlock: 2 }}>
          {[...gridLevels].reverse().map((g) => (
            <span key={g}>{g}</span>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block", overflow: "visible" }} role="img" aria-label="Pain trend">
          {gridLevels.map((g) => (
            <line key={g} x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}
          <polyline points={line} fill="none" stroke="rgba(248,113,113,0.7)" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {trend.map((d, i) => {
            const isSel = sel == null ? i === trend.length - 1 : i === sel;
            return (
              <g key={`${d.ymd}-${i}`}>
                <circle cx={x(i)} cy={y(d.level)} r={s.hit} fill="transparent" style={{ cursor: "pointer" }} onClick={() => setSel(i)} />
                <circle cx={x(i)} cy={y(d.level)} r={isSel ? s.dotSel : s.dot} fill={isSel ? painLevelColor(d.level) : "rgba(248,113,113,0.85)"} stroke={isSel ? "#0b1422" : "none"} strokeWidth={1.5} pointerEvents="none" />
              </g>
            );
          })}
        </svg>
      </div>
      {size === "lg" && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", paddingLeft: 16 }}>
          <span>{shortDate(trend[0].ymd)}</span>
          <span>{shortDate(trend[trend.length - 1].ymd)}</span>
        </div>
      )}
    </div>
  );
}
