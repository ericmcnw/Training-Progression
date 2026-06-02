"use client";

import { useMemo, useState } from "react";

// One session's aggregated metrics — produced server-side by
// ExerciseDetailPage from the exercise's SessionExercise + SetEntry
// rows.
export type ExerciseSessionPoint = {
  /** RoutineLog id — used to link out from a clicked tooltip. */
  logId: string;
  routineId: string;
  routineName: string;
  performedAt: Date;
  /** Heaviest weight × any reps in the session. 0 if none recorded. */
  topWeightLb: number;
  /** Reps for the top-weight set (the heaviest single set). */
  topWeightReps: number;
  /** Highest single-set rep count regardless of weight. */
  topReps: number;
  /** Total sets in the session. */
  totalSets: number;
  /** Longest single-set seconds (for timed exercises). 0 if none. */
  maxTimeSec: number;
  /** Total reps across all sets — useful for the "reps" line when the
   *  user cares about volume-of-reps rather than top single-set reps. */
  totalReps: number;
};

type MetricKey = "weight" | "reps" | "sets" | "time";
type ViewKey = "all" | MetricKey;

// Per-metric configuration: label, color, accessor, unit suffix, format.
const METRIC_CONFIG: Record<MetricKey, {
  label: string;
  color: string;
  unit: string;
  accessor: (p: ExerciseSessionPoint) => number;
  format: (v: number) => string;
}> = {
  weight: {
    label: "Weight",
    color: "rgba(251,191,36,0.95)",
    unit: "lb",
    accessor: (p) => p.topWeightLb,
    format: (v) => `${Math.round(v)} lb`,
  },
  reps: {
    label: "Reps",
    color: "rgba(132,204,255,0.95)",
    unit: "reps",
    // Top single-set reps reads more like "best rep effort"; total reps
    // would conflate volume with effort. Default to single-set max.
    accessor: (p) => p.topReps,
    format: (v) => `${Math.round(v)} reps`,
  },
  sets: {
    label: "Sets",
    color: "rgba(84,203,130,0.95)",
    unit: "sets",
    accessor: (p) => p.totalSets,
    format: (v) => `${Math.round(v)} sets`,
  },
  time: {
    label: "Time",
    color: "rgba(192,132,252,0.95)",
    unit: "sec",
    accessor: (p) => p.maxTimeSec,
    format: (v) => `${Math.round(v)}s`,
  },
};

export default function ExerciseMetricChart({
  sessions,
  supportsWeight,
  isTimeBased,
}: {
  sessions: ExerciseSessionPoint[];
  supportsWeight: boolean;
  isTimeBased: boolean;
}) {
  // Filter the available metric set down based on the exercise's
  // capabilities. Weight only shows for weighted exercises; time only
  // for timed (unit=TIME). Sets + reps always available.
  const availableMetrics = useMemo<MetricKey[]>(() => {
    const m: MetricKey[] = ["sets"];
    if (!isTimeBased) m.push("reps");
    if (supportsWeight) m.push("weight");
    if (isTimeBased) m.push("time");
    return m;
  }, [supportsWeight, isTimeBased]);

  const [view, setView] = useState<ViewKey>("all");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const activeIdx = hoverIdx ?? pinnedIdx;

  // Sort sessions oldest → newest for chart rendering. Chart x position
  // is the index in this sorted list (evenly spaced — no calendar
  // scale, so sparse periods don't open big gaps).
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime()),
    [sessions]
  );

  if (sortedSessions.length === 0) {
    return (
      <div style={emptyStyle}>
        No logged sessions for this exercise yet.
      </div>
    );
  }

  // Chart dimensions
  const W = 600;
  const H = 200;
  const PAD_LEFT = view === "all" ? 8 : 44;
  const PAD_RIGHT = 8;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 28;
  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;

  const lastIdx = sortedSessions.length - 1;
  const xOf = (i: number) => PAD_LEFT + (lastIdx === 0 ? plotW / 2 : (i / lastIdx) * plotW);

  // Build per-metric (min, max, normalized + actual values) maps.
  // In "all" view each line is normalized to its own 0..1 (over the
  // plot's vertical range) so all the trends fit on one canvas. In
  // single-metric view, that one metric gets the actual axis.
  type Series = { key: MetricKey; min: number; max: number; values: number[] };
  const series: Series[] = availableMetrics.map((key) => {
    const values = sortedSessions.map(METRIC_CONFIG[key].accessor);
    const positive = values.filter((v) => v > 0);
    const min = positive.length > 0 ? Math.min(...positive) : 0;
    const max = positive.length > 0 ? Math.max(...positive) : 1;
    return { key, min, max, values };
  });

  const singleSeries = view !== "all" ? series.find((s) => s.key === view) ?? null : null;

  function yAll(key: MetricKey, val: number): number {
    const s = series.find((sr) => sr.key === key);
    if (!s) return PAD_TOP + plotH;
    if (s.max === s.min) return PAD_TOP + plotH * 0.5;
    if (val <= 0) return PAD_TOP + plotH; // pin zero/missing to baseline
    const norm = (val - s.min) / (s.max - s.min);
    return PAD_TOP + plotH - norm * plotH;
  }
  function ySingle(s: Series, val: number): number {
    if (s.max === 0) return PAD_TOP + plotH;
    const yMaxAxis = niceAxisMax(s.max);
    const norm = val / yMaxAxis;
    return PAD_TOP + plotH - norm * plotH;
  }

  // Build the polylines per metric.
  function makePath(s: Series, view: ViewKey): string {
    return s.values
      .map((v, i) => {
        const x = xOf(i);
        const y = view === "all" ? yAll(s.key, v) : ySingle(s, v);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  // Y-axis ticks for single-metric view.
  const yTicks: Array<{ value: number; y: number }> = [];
  if (singleSeries) {
    const yMax = niceAxisMax(singleSeries.max);
    [0, yMax / 2, yMax].forEach((v) => {
      yTicks.push({ value: v, y: PAD_TOP + plotH - (v / Math.max(1, yMax)) * plotH });
    });
  }

  // X labels: show first, middle, last session date when there's > 4
  // sessions; otherwise label each.
  const xLabels: Array<{ i: number; label: string }> = [];
  if (sortedSessions.length <= 4) {
    sortedSessions.forEach((s, i) => xLabels.push({ i, label: shortDate(s.performedAt) }));
  } else {
    const mid = Math.floor(lastIdx / 2);
    xLabels.push(
      { i: 0, label: shortDate(sortedSessions[0].performedAt) },
      { i: mid, label: shortDate(sortedSessions[mid].performedAt) },
      { i: lastIdx, label: shortDate(sortedSessions[lastIdx].performedAt) }
    );
  }

  const activePoint = activeIdx !== null ? sortedSessions[activeIdx] : null;

  return (
    <div style={shellStyle}>
      {/* Filter pills */}
      <div style={pillRowStyle}>
        <FilterPill label="All" active={view === "all"} onClick={() => setView("all")} />
        {availableMetrics.map((key) => (
          <FilterPill
            key={key}
            label={METRIC_CONFIG[key].label}
            color={METRIC_CONFIG[key].color}
            active={view === key}
            onClick={() => setView(key)}
          />
        ))}
        {view === "all" ? (
          <span style={hintTextStyle}>Trend overlay · units hidden</span>
        ) : (
          <span style={hintTextStyle}>{METRIC_CONFIG[view as MetricKey].unit}</span>
        )}
      </div>

      {/* Chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 200, display: "block" }}
        onPointerLeave={() => setHoverIdx(null)}
        onClick={() => setPinnedIdx(null)}
      >
        {/* Baseline */}
        <line x1={PAD_LEFT} y1={PAD_TOP + plotH} x2={W - PAD_RIGHT} y2={PAD_TOP + plotH} stroke="rgba(255,255,255,0.14)" />

        {/* Y axis ticks (single mode only) */}
        {singleSeries
          ? yTicks.map((t, i) => (
              <g key={i}>
                <line
                  x1={PAD_LEFT}
                  y1={t.y}
                  x2={W - PAD_RIGHT}
                  y2={t.y}
                  stroke="rgba(255,255,255,0.04)"
                  strokeDasharray="2 6"
                />
                <text
                  x={PAD_LEFT - 6}
                  y={t.y + 3}
                  fontSize="9"
                  textAnchor="end"
                  fill="rgba(255,255,255,0.45)"
                  fontWeight="800"
                >
                  {Math.round(t.value)}
                </text>
              </g>
            ))
          : null}

        {/* Series lines */}
        {view === "all"
          ? series.map((s) => {
              const path = makePath(s, "all");
              return (
                <path
                  key={s.key}
                  d={path}
                  stroke={METRIC_CONFIG[s.key].color}
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.85}
                />
              );
            })
          : singleSeries
          ? (() => {
              const c = METRIC_CONFIG[singleSeries.key].color;
              const path = makePath(singleSeries, view);
              const areaPath = `${path} L ${xOf(lastIdx).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} L ${xOf(0).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`;
              return (
                <g>
                  <path d={areaPath} fill={c.replace("0.95)", "0.10)")} stroke="none" />
                  <path
                    d={path}
                    stroke={c}
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* Points dots */}
                  {singleSeries.values.map((v, i) => {
                    if (v <= 0) return null;
                    return (
                      <circle
                        key={i}
                        cx={xOf(i)}
                        cy={ySingle(singleSeries, v)}
                        r={activeIdx === i ? 4 : 2.5}
                        fill={c}
                      />
                    );
                  })}
                </g>
              );
            })()
          : null}

        {/* Crosshair on active index */}
        {activeIdx !== null ? (
          <line
            x1={xOf(activeIdx)}
            y1={PAD_TOP}
            x2={xOf(activeIdx)}
            y2={PAD_TOP + plotH}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />
        ) : null}

        {/* Active-point dots in 'all' mode */}
        {view === "all" && activeIdx !== null
          ? series.map((s) => {
              const v = s.values[activeIdx];
              if (v <= 0) return null;
              return (
                <circle
                  key={s.key}
                  cx={xOf(activeIdx)}
                  cy={yAll(s.key, v)}
                  r="3.5"
                  fill={METRIC_CONFIG[s.key].color}
                />
              );
            })
          : null}

        {/* X labels */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xOf(i)}
            y={H - 10}
            fontSize="9"
            textAnchor="middle"
            fill="rgba(255,255,255,0.45)"
            fontWeight="700"
          >
            {label}
          </text>
        ))}

        {/* Invisible hit areas per session */}
        {sortedSessions.map((s, i) => {
          const x = xOf(i);
          const slabW = lastIdx === 0 ? plotW : plotW / Math.max(1, lastIdx);
          return (
            <rect
              key={s.logId}
              x={x - slabW / 2}
              y={PAD_TOP}
              width={slabW}
              height={plotH + 6}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onPointerEnter={() => setHoverIdx(i)}
              onClick={(e) => {
                e.stopPropagation();
                setPinnedIdx((p) => (p === i ? null : i));
              }}
            />
          );
        })}
      </svg>

      {/* Tooltip / detail row beneath the chart */}
      <div style={tooltipRowStyle}>
        {activePoint ? (
          <ActiveSessionDetail point={activePoint} availableMetrics={availableMetrics} pinned={pinnedIdx === activeIdx} />
        ) : (
          <span style={hintTextStyle}>
            {sortedSessions.length} session{sortedSessions.length === 1 ? "" : "s"} · hover a point to see detail
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Filter pill ─────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 11px",
        borderRadius: 999,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: active && color ? color.replace("0.95)", "0.5)") : active ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.12)",
        background: active && color ? color.replace("0.95)", "0.12)") : active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
        color: active && color ? color : "inherit",
        fontSize: 11,
        fontWeight: 800,
        cursor: "pointer",
        minHeight: 30,
      }}
    >
      {label}
    </button>
  );
}

// ─── Active session detail line (below chart) ────────────────────────────────

function ActiveSessionDetail({
  point,
  availableMetrics,
  pinned,
}: {
  point: ExerciseSessionPoint;
  availableMetrics: MetricKey[];
  pinned: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 2, fontSize: 12 }}>
      <div style={{ fontWeight: 800, opacity: 0.85 }}>
        {shortDate(point.performedAt)} · {point.routineName}
        {pinned ? <span style={{ fontSize: 9, marginLeft: 6, opacity: 0.55, fontWeight: 800 }}>PINNED · tap chart to unpin</span> : null}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", opacity: 0.88 }}>
        {availableMetrics.map((key) => {
          const value = METRIC_CONFIG[key].accessor(point);
          if (value <= 0) return null;
          return (
            <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: METRIC_CONFIG[key].color, display: "inline-block" }} />
              <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {METRIC_CONFIG[key].label}
              </span>
              <span style={{ fontWeight: 800 }}>{METRIC_CONFIG[key].format(value)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Formatters / helpers ────────────────────────────────────────────────────

function shortDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
}

function niceAxisMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  if (normalized <= 7.5) return 7.5 * magnitude;
  return 10 * magnitude;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const shellStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px 12px 10px",
  borderRadius: 14,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const hintTextStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.5,
  marginLeft: "auto",
};

const tooltipRowStyle: React.CSSProperties = {
  minHeight: 38,
  paddingTop: 4,
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "rgba(255,255,255,0.06)",
};

const emptyStyle: React.CSSProperties = {
  padding: "20px 14px",
  fontSize: 13,
  opacity: 0.6,
  textAlign: "center",
  borderRadius: 12,
  borderWidth: 1,
  borderStyle: "dashed",
  borderColor: "rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.02)",
};
