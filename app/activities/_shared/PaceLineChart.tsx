"use client";

import { useMemo, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { formatPace } from "@/lib/progress";
import type { PaceChartData } from "@/lib/activities/endurance-pace";
import { LogDetailPopover, type OpenLog } from "@/app/_home/DomainSparklines";

// Interactive SVG line chart for pace data. Two modes:
//
//   weekly: one polyline per series. Lines connect every non-null week
//   for the series in chronological order — gaps are skipped over so an
//   isolated week point still joins its neighbors. Hovering anywhere
//   along the chart shows a vertical tracker + a per-series read-out
//   for the nearest week.
//
//   session: single polyline + per-point dots, sized by distance. Each
//   dot is clickable and opens the same log detail popover the home
//   dashboard uses.
//
// Y axis uses natural ordering: bigger minutes-per-mile at the TOP,
// smaller at the BOTTOM. Lower-on-the-chart = faster.

export default function PaceLineChart({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: NonNullable<PaceChartData>;
}) {
  // Canvas — fixed viewBox so the chart scales with its container.
  const W = 640;
  const H = 320;
  const padL = 56;
  const padR = 16;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const svgRef = useRef<SVGSVGElement | null>(null);
  // Mouse-tracked week index for weekly mode, or session index for
  // session mode. null when the cursor is outside the chart.
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Clicked log for session-mode dot taps → drives the popover.
  const [openLog, setOpenLog] = useState<OpenLog>(null);

  // Collect every defined pace value to size the Y axis.
  const allPaces: number[] =
    data.mode === "weekly"
      ? data.series.flatMap((s) => s.weeklyPaceSec.filter((v): v is number => v != null))
      : data.points.map((p) => p.paceSec);

  if (allPaces.length === 0) {
    return (
      <div style={containerStyle}>
        <Header title={title} subtitle={subtitle} />
        <div style={emptyStyle}>No pace data in this window.</div>
      </div>
    );
  }

  const minPace = Math.min(...allPaces);
  const maxPace = Math.max(...allPaces);
  const rawSpan = maxPace - minPace;
  const span = Math.max(rawSpan, 60);
  const yMin = Math.max(0, minPace - span * 0.08);
  const yMax = maxPace + span * 0.08;

  // 4 horizontal grid lines (5 ticks total). Top tick = yMax (slowest).
  const tickCount = 4;
  const tickPaces: number[] = [];
  for (let i = 0; i <= tickCount; i += 1) {
    tickPaces.push(yMax - (i / tickCount) * (yMax - yMin));
  }

  // Natural Y ordering: bigger paceSec (slower) sits higher on the
  // chart (smaller pixel y).
  const yFor = (paceSec: number) => {
    const t = (paceSec - yMin) / (yMax - yMin);
    return padT + innerH - t * innerH;
  };

  // X positioning + tick labels per mode.
  let xFor: (pointIdx: number) => number;
  let xTicks: Array<{ x: number; label: string }> = [];
  let pointCount = 0;
  if (data.mode === "weekly") {
    pointCount = data.weekLabels.length;
    const n = pointCount;
    xFor = (i) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    xTicks = data.weekLabels
      .map((label, i) => ({ x: xFor(i), label }))
      .filter((_, i) => i % 3 === 0 || i === n - 1);
  } else {
    pointCount = data.points.length;
    const pts = data.points;
    const first = pts[0].performedAt.getTime();
    const last = pts[pts.length - 1].performedAt.getTime();
    const range = Math.max(1, last - first);
    xFor = (i) => padL + ((pts[i].performedAt.getTime() - first) / range) * innerW;
    const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    if (pts.length >= 2) {
      xTicks = [
        { x: xFor(0), label: formatDate(pts[0].performedAt) },
        { x: xFor(pts.length - 1), label: formatDate(pts[pts.length - 1].performedAt) },
      ];
      if (pts.length >= 6) {
        const midIdx = Math.floor(pts.length / 2);
        xTicks.splice(1, 0, { x: xFor(midIdx), label: formatDate(pts[midIdx].performedAt) });
      }
    } else {
      xTicks = [{ x: xFor(0), label: formatDate(pts[0].performedAt) }];
    }
  }

  // Precompute per-series point lists for weekly mode (used by the path
  // builder + dot renderer).
  const weeklySeries = useMemo(() => {
    if (data.mode !== "weekly") return [];
    return data.series.map((s) => {
      const pts: Array<{ idx: number; x: number; y: number; paceSec: number }> = [];
      s.weeklyPaceSec.forEach((v, i) => {
        if (v == null) return;
        pts.push({ idx: i, x: xFor(i), y: yFor(v), paceSec: v });
      });
      return { ...s, pts };
    });
  }, [data, xFor, yFor]);

  // Map cursor x → nearest point index. For weekly mode that's a week
  // index; for session mode it's a session index. Used by hover.
  function indexFromClientX(clientX: number): number | null {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    // Convert client x → SVG viewBox x (the SVG scales linearly).
    const svgX = ((clientX - rect.left) / rect.width) * W;
    if (svgX < padL || svgX > W - padR) return null;
    if (pointCount === 0) return null;

    // Find nearest by stored x-coords — accurate for both modes because
    // session mode uses time-spaced x.
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pointCount; i += 1) {
      const dx = Math.abs(xFor(i) - svgX);
      if (dx < bestDist) {
        bestDist = dx;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function onMove(e: MouseEvent<SVGSVGElement>) {
    setHoverIdx(indexFromClientX(e.clientX));
  }
  function onLeave() {
    setHoverIdx(null);
  }
  function onTouch(e: TouchEvent<SVGSVGElement>) {
    const t = e.touches[0];
    if (!t) return;
    setHoverIdx(indexFromClientX(t.clientX));
  }

  // Hover tracker line + tooltip content.
  const tracker = (() => {
    if (hoverIdx === null) return null;
    const x = xFor(hoverIdx);
    if (data.mode === "weekly") {
      const rows = weeklySeries
        .map((s) => {
          const pace = s.weeklyPaceSec[hoverIdx];
          if (pace == null) return null;
          return { label: s.label, color: s.color, value: formatPace(pace) };
        })
        .filter((r): r is { label: string; color: string; value: string } => r !== null);
      return {
        x,
        weekLabel: data.weekLabels[hoverIdx],
        rows,
      };
    }
    const pt = data.points[hoverIdx];
    return {
      x,
      weekLabel: `${pt.performedAt.getMonth() + 1}/${pt.performedAt.getDate()}`,
      rows: [
        {
          label: pt.routineName,
          color: data.color,
          value: `${formatPace(pt.paceSec)} · ${pt.distanceMi.toFixed(1)} mi`,
        },
      ],
    };
  })();

  function handleSessionDotClick(pt: { id: string; performedAt: Date; routineName: string; href: string }) {
    if (data.mode !== "session") return;
    const ymd = pt.performedAt.toISOString().slice(0, 10);
    const timeLabel = pt.performedAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    setOpenLog({
      log: {
        logId: pt.id,
        routineId: pt.href.split("/")[2] ?? "",
        routineName: pt.routineName,
        performedYmd: ymd,
        performedTimeLabel: timeLabel,
      },
      accent: data.color,
      label: data.typeName,
    });
  }

  return (
    <div style={containerStyle}>
      <Header title={title} subtitle={subtitle} />

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        style={{ display: "block", maxWidth: "100%", touchAction: "manipulation" }}
        role="img"
        aria-label={title}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onTouchStart={onTouch}
        onTouchMove={onTouch}
      >
        {/* Y grid + labels */}
        {tickPaces.map((pace, i) => {
          const y = yFor(pace);
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.55)"
                fontWeight={700}
              >
                {formatTick(pace)}
              </text>
            </g>
          );
        })}

        {/* X axis baseline + ticks */}
        <line
          x1={padL}
          x2={W - padR}
          y1={H - padB}
          y2={H - padB}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
        />
        {xTicks.map((t, i) => (
          <text
            key={i}
            x={t.x}
            y={H - padB + 14}
            textAnchor="middle"
            fontSize={10}
            fill="rgba(255,255,255,0.55)"
            fontWeight={700}
          >
            {t.label}
          </text>
        ))}

        {/* Hover tracker line */}
        {tracker ? (
          <line
            x1={tracker.x}
            x2={tracker.x}
            y1={padT}
            y2={H - padB}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            strokeDasharray="3 3"
            pointerEvents="none"
          />
        ) : null}

        {/* Series lines + dots */}
        {data.mode === "weekly"
          ? weeklySeries.map((s) => (
              <SeriesGroup
                key={s.label}
                color={s.color}
                points={s.pts.map((p) => ({ x: p.x, y: p.y, idx: p.idx }))}
                hoverIdx={hoverIdx}
              />
            ))
          : (() => {
              const pts = data.points.map((p, i) => ({
                x: xFor(i),
                y: yFor(p.paceSec),
                p,
                idx: i,
              }));
              return (
                <g>
                  <path
                    d={buildPath(pts.map((pt) => ({ x: pt.x, y: pt.y })))}
                    fill="none"
                    stroke={data.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {pts.map((pt) => {
                    const isHover = hoverIdx === pt.idx;
                    const base = Math.max(3, Math.min(8, 2 + Math.sqrt(pt.p.distanceMi)));
                    return (
                      <circle
                        key={pt.p.id}
                        cx={pt.x}
                        cy={pt.y}
                        r={isHover ? base + 2 : base}
                        fill={data.color}
                        stroke="rgba(0,0,0,0.45)"
                        strokeWidth={1}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleSessionDotClick(pt.p)}
                      >
                        <title>
                          {`${pt.p.routineName}\n${formatPace(pt.p.paceSec)} · ${pt.p.distanceMi.toFixed(1)} mi`}
                        </title>
                      </circle>
                    );
                  })}
                </g>
              );
            })()}
      </svg>

      {/* Hover read-out — sits under the chart so it doesn't overlap
          the SVG and works on mobile without flyout positioning. */}
      <div style={readoutStyle}>
        {tracker ? (
          <>
            <span style={readoutWeekStyle}>{tracker.weekLabel}</span>
            <div style={readoutRowsStyle}>
              {tracker.rows.length === 0 ? (
                <span style={readoutMutedStyle}>No pace this week</span>
              ) : (
                tracker.rows.map((r, i) => (
                  <span key={i} style={readoutChipStyle}>
                    <span style={{ ...legendDotStyle, background: r.color }} />
                    <span style={readoutChipLabelStyle}>{r.label}</span>
                    <span style={readoutChipValueStyle}>{r.value}</span>
                  </span>
                ))
              )}
            </div>
          </>
        ) : (
          <span style={readoutHintStyle}>
            {data.mode === "weekly" ? "Hover or tap to read a week" : "Tap a dot to open the session"}
          </span>
        )}
      </div>

      {/* Legend — one chip per series, color-matched. */}
      {data.mode === "weekly" && (
        <div style={legendRowStyle}>
          {data.series.map((s) => (
            <span key={s.label} style={legendChipStyle}>
              <span style={{ ...legendDotStyle, background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <LogDetailPopover open={openLog} onClose={() => setOpenLog(null)} />
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={headerStyle}>
      <div style={titleStyle}>{title}</div>
      {subtitle ? <div style={subtitleStyle}>{subtitle}</div> : null}
    </div>
  );
}

// One series: a single polyline that joins every non-null point in
// order (gaps are bridged), plus a dot at every point. Hover bumps the
// matching dot.
function SeriesGroup({
  color,
  points,
  hoverIdx,
}: {
  color: string;
  points: Array<{ x: number; y: number; idx: number }>;
  hoverIdx: number | null;
}) {
  if (points.length === 0) return null;
  return (
    <g>
      <path
        d={buildPath(points.map((p) => ({ x: p.x, y: p.y })))}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p) => {
        const isHover = hoverIdx === p.idx;
        return (
          <circle
            key={p.idx}
            cx={p.x}
            cy={p.y}
            r={isHover ? 5 : 3.5}
            fill={color}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}

// One continuous polyline through every supplied point — no gaps. The
// caller filters out nulls, so the line skips over weeks with no data.
function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function formatTick(paceSec: number): string {
  const m = Math.floor(paceSec / 60);
  const s = Math.round(paceSec % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px 12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  width: "100%",
  maxWidth: 760,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  fontWeight: 700,
};

const emptyStyle: React.CSSProperties = {
  padding: "30px 10px",
  textAlign: "center",
  fontSize: 12,
  opacity: 0.65,
};

const readoutStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minHeight: 36,
  padding: "6px 8px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const readoutWeekStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  opacity: 0.7,
  letterSpacing: 0.3,
};

const readoutRowsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const readoutChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const readoutChipLabelStyle: React.CSSProperties = {
  opacity: 0.7,
};

const readoutChipValueStyle: React.CSSProperties = {
  fontWeight: 900,
};

const readoutMutedStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  fontStyle: "italic",
};

const readoutHintStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.5,
  fontWeight: 700,
};

const legendRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  paddingTop: 2,
};

const legendChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const legendDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  display: "inline-block",
};
