"use client";

import { useMemo, useState } from "react";

export type ExerciseSessionPoint = {
  logId: string;
  routineId: string;
  routineName: string;
  performedAt: Date;
  /** Heaviest weight × any reps in the session. 0 if none recorded. */
  topWeightLb: number;
  /** Reps for the top-weight set. */
  topWeightReps: number;
  /** Highest single-set rep count regardless of weight. */
  topReps: number;
  totalSets: number;
  /** Longest single-set seconds (for timed exercises). 0 if none. */
  maxTimeSec: number;
  totalReps: number;
};

type MetricKey = "weight" | "estMax" | "reps" | "sets" | "time";

// Epley. A single is its own max; past ~12 reps the estimate drifts, but the
// trend is still comparable session to session.
function estimatedMax(p: ExerciseSessionPoint): number {
  if (p.topWeightLb <= 0 || p.topWeightReps <= 0) return 0;
  if (p.topWeightReps === 1) return p.topWeightLb;
  return p.topWeightLb * (1 + p.topWeightReps / 30);
}

const METRIC_CONFIG: Record<MetricKey, {
  label: string;
  color: string;
  hint: string;
  accessor: (p: ExerciseSessionPoint) => number;
  format: (v: number) => string;
}> = {
  weight: {
    label: "Top weight",
    color: "rgba(251,191,36,0.95)",
    hint: "Heaviest set each session",
    accessor: (p) => p.topWeightLb,
    format: (v) => `${Math.round(v)} lb`,
  },
  estMax: {
    label: "Est. max",
    color: "rgba(248,113,113,0.95)",
    hint: "Estimated one-rep max from the heaviest set, so 5 heavy reps and 8 lighter reps compare",
    accessor: estimatedMax,
    format: (v) => `${Math.round(v)} lb`,
  },
  reps: {
    label: "Reps",
    color: "rgba(132,204,255,0.95)",
    hint: "Most reps in one set each session",
    accessor: (p) => p.topReps,
    format: (v) => `${Math.round(v)} reps`,
  },
  sets: {
    label: "Sets",
    color: "rgba(84,203,130,0.95)",
    hint: "Sets done each session",
    accessor: (p) => p.totalSets,
    format: (v) => `${Math.round(v)} sets`,
  },
  time: {
    label: "Time",
    color: "rgba(192,132,252,0.95)",
    hint: "Longest hold each session",
    accessor: (p) => p.maxTimeSec,
    format: (v) => `${Math.round(v)}s`,
  },
};

const W = 360;
const H = 210;
const PAD_LEFT = 40;
const PAD_RIGHT = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;
const PLOT_W = W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

export default function ExerciseMetricChart({
  sessions,
  supportsWeight,
  isTimeBased,
}: {
  sessions: ExerciseSessionPoint[];
  supportsWeight: boolean;
  isTimeBased: boolean;
}) {
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime()),
    [sessions]
  );

  const hasWeight = supportsWeight && sortedSessions.some((s) => s.topWeightLb > 0);

  // Ordered by what "progress" means for this exercise; the first is the default.
  const availableMetrics = useMemo<MetricKey[]>(() => {
    if (isTimeBased) return hasWeight ? ["time", "weight", "sets"] : ["time", "sets"];
    if (hasWeight) return ["weight", "estMax", "reps", "sets"];
    return ["reps", "sets"];
  }, [hasWeight, isTimeBased]);

  const [picked, setPicked] = useState<MetricKey | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);
  const activeIdx = hoverIdx ?? pinnedIdx;
  const metric = picked && availableMetrics.includes(picked) ? picked : availableMetrics[0];
  const config = METRIC_CONFIG[metric];

  if (sortedSessions.length === 0) {
    return <div style={emptyStyle}>No logged sessions for this exercise yet.</div>;
  }

  const values = sortedSessions.map(config.accessor);
  const positive = values.filter((v) => v > 0);
  const lastIdx = sortedSessions.length - 1;
  const xOf = (i: number) => PAD_LEFT + (lastIdx === 0 ? PLOT_W / 2 : (i / lastIdx) * PLOT_W);

  // The axis hugs the data (it does not start at zero) so a 100 → 115 lb
  // climb reads as a climb instead of a flat line near the top.
  const dataMin = positive.length > 0 ? Math.min(...positive) : 0;
  const dataMax = positive.length > 0 ? Math.max(...positive) : 1;
  const step = niceStep(Math.max(dataMax - dataMin, dataMax * 0.1, 1) / 3);
  const axisMin = Math.max(0, Math.floor((dataMin - step * 0.5) / step) * step);
  const axisMax = Math.max(axisMin + step, Math.ceil((dataMax + step * 0.25) / step) * step);
  const yOf = (v: number) => PAD_TOP + PLOT_H - ((v - axisMin) / (axisMax - axisMin)) * PLOT_H;
  const ticks: number[] = [];
  for (let v = axisMin; v <= axisMax + step * 0.01; v += step) ticks.push(v);

  const points = values
    .map((v, i) => ({ v, i }))
    .filter((p) => p.v > 0);
  const path = points.map((p, n) => `${n === 0 ? "M" : "L"} ${xOf(p.i).toFixed(1)} ${yOf(p.v).toFixed(1)}`).join(" ");

  // A point is a best when it beats everything before it.
  const bestIdx = new Set<number>();
  let running = 0;
  for (const p of points) {
    if (p.v > running) {
      if (running > 0) bestIdx.add(p.i);
      running = p.v;
    }
  }

  const first = points[0];
  const latest = points[points.length - 1];
  const change = first && latest && first.i !== latest.i ? latest.v - first.v : null;

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
      <div style={pillRowStyle}>
        {availableMetrics.map((key) => (
          <FilterPill
            key={key}
            label={METRIC_CONFIG[key].label}
            color={METRIC_CONFIG[key].color}
            active={metric === key}
            onClick={() => {
              setPicked(key);
              setPinnedIdx(null);
            }}
          />
        ))}
      </div>

      <div style={takeawayStyle}>
        {latest ? (
          <>
            <span style={{ fontSize: 20, fontWeight: 900, color: config.color }}>{config.format(latest.v)}</span>
            <span style={takeawayMeta}>
              latest · best {config.format(dataMax)}
              {change !== null && first
                ? ` · ${change > 0 ? "+" : change < 0 ? "−" : "±"}${config.format(Math.abs(change))} since ${shortDate(sortedSessions[first.i].performedAt)}`
                : ""}
            </span>
          </>
        ) : (
          <span style={takeawayMeta}>Nothing logged for this measure yet.</span>
        )}
      </div>

      {points.length === 1 ? (
        <div style={{ fontSize: 12, opacity: 0.6 }}>One session so far. Log it again to see a trend.</div>
      ) : null}

      {/* SVG is the visual layer only; the HTML buttons over it take taps so
          iOS doesn't double-tap-zoom. */}
      <div style={{ position: "relative", aspectRatio: `${W} / ${H}`, touchAction: "manipulation" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          style={{ display: "block", overflow: "visible", touchAction: "manipulation", userSelect: "none", WebkitUserSelect: "none" }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD_LEFT} y1={yOf(t)} x2={W - PAD_RIGHT} y2={yOf(t)} stroke="rgba(255,255,255,0.07)" />
              <text x={PAD_LEFT - 6} y={yOf(t) + 4} fontSize="11" textAnchor="end" fill="rgba(255,255,255,0.55)" fontWeight="700">
                {formatTick(t)}
              </text>
            </g>
          ))}

          {path ? (
            <path d={path} stroke={config.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ) : null}
          {points.map((p) => (
            <g key={p.i}>
              {bestIdx.has(p.i) ? (
                <circle cx={xOf(p.i)} cy={yOf(p.v)} r="6.5" fill="none" stroke={config.color} strokeWidth="1.2" opacity="0.6" />
              ) : null}
              <circle cx={xOf(p.i)} cy={yOf(p.v)} r={activeIdx === p.i ? 4.5 : 3} fill={config.color} />
            </g>
          ))}

          {activeIdx !== null ? (
            <line x1={xOf(activeIdx)} y1={PAD_TOP} x2={xOf(activeIdx)} y2={PAD_TOP + PLOT_H} stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 5" />
          ) : null}

          {xLabels.map(({ i, label }) => (
            <text
              key={i}
              x={xOf(i)}
              y={H - 9}
              fontSize="11"
              textAnchor={i === 0 && lastIdx > 0 ? "start" : i === lastIdx && lastIdx > 0 ? "end" : "middle"}
              fill="rgba(255,255,255,0.55)"
              fontWeight="700"
            >
              {label}
            </text>
          ))}
        </svg>

        <div
          style={{
            position: "absolute",
            top: `${(PAD_TOP / H) * 100}%`,
            bottom: `${(PAD_BOTTOM / H) * 100}%`,
            left: `${(PAD_LEFT / W) * 100}%`,
            right: `${(PAD_RIGHT / W) * 100}%`,
            display: "flex",
          }}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {sortedSessions.map((s, i) => (
            <button
              key={s.logId}
              type="button"
              className="pyramidCell"
              aria-label={`${shortDate(s.performedAt)}: ${config.format(values[i])}`}
              aria-pressed={pinnedIdx === i}
              onPointerEnter={() => setHoverIdx(i)}
              onClick={(e) => {
                e.stopPropagation();
                setPinnedIdx((p) => (p === i ? null : i));
              }}
              style={hitBtnStyle}
            />
          ))}
        </div>
      </div>

      <div style={tooltipRowStyle}>
        {activePoint ? (
          <ActiveSessionDetail point={activePoint} availableMetrics={availableMetrics} isBest={activeIdx !== null && bestIdx.has(activeIdx)} />
        ) : (
          <span style={hintTextStyle}>
            {config.hint}. Tap a point for that session{bestIdx.size > 0 ? "; ringed points were a new best" : ""}.
          </span>
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "7px 13px",
        borderRadius: 999,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: active ? color.replace("0.95)", "0.5)") : "rgba(255,255,255,0.12)",
        background: active ? color.replace("0.95)", "0.12)") : "rgba(255,255,255,0.03)",
        color: active ? color : "inherit",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        minHeight: 36,
      }}
    >
      {label}
    </button>
  );
}

function ActiveSessionDetail({
  point,
  availableMetrics,
  isBest,
}: {
  point: ExerciseSessionPoint;
  availableMetrics: MetricKey[];
  isBest: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 3, fontSize: 12 }}>
      <div style={{ fontWeight: 800, opacity: 0.85 }}>
        {shortDate(point.performedAt)} · {point.routineName}
        {isBest ? <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 900, color: "rgba(134,239,172,0.95)" }}>New best</span> : null}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", opacity: 0.9 }}>
        {availableMetrics.map((key) => {
          const value = METRIC_CONFIG[key].accessor(point);
          if (value <= 0) return null;
          return (
            <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: METRIC_CONFIG[key].color, display: "inline-block" }} />
              <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 800 }}>{METRIC_CONFIG[key].label}</span>
              <span style={{ fontWeight: 800 }}>
                {METRIC_CONFIG[key].format(value)}
                {key === "weight" && point.topWeightReps > 0 ? ` × ${point.topWeightReps}` : ""}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function shortDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
}

function formatTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function niceStep(raw: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 0.0001))));
  const n = raw / magnitude;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return Math.max(nice * magnitude, 1);
}

const hitBtnStyle: React.CSSProperties = {
  flex: 1,
  appearance: "none",
  WebkitAppearance: "none",
  padding: 0,
  margin: 0,
  minHeight: 0,
  background: "transparent",
  border: "none",
  borderRadius: 0,
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  touchAction: "manipulation",
};

const shellStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: "12px 12px 10px",
  borderRadius: 14,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.08)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
  touchAction: "manipulation",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const pillRowStyle: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };

const takeawayStyle: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" };

const takeawayMeta: React.CSSProperties = { fontSize: 12, fontWeight: 700, opacity: 0.65 };

const hintTextStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, opacity: 0.55, lineHeight: 1.4 };

const tooltipRowStyle: React.CSSProperties = {
  minHeight: 40,
  paddingTop: 6,
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
