// Server-renderable inline-SVG chart. Each day since `startedAt` (capped at
// MAX_DAYS for legibility) is one bar showing that day's peak pain level,
// tinted by the context of the highest log of the day.

export type PainHistoryDay = {
  ymd: string;
  peak: number | null;
  context: "AT_REST" | "DURING_ACTIVITY" | "AFTER_ACTIVITY" | "MORNING" | "GENERAL" | null;
};

const MAX_DAYS = 90;

const CONTEXT_COLOR: Record<NonNullable<PainHistoryDay["context"]>, string> = {
  DURING_ACTIVITY: "#FB7185",
  AFTER_ACTIVITY: "#FBBF24",
  AT_REST: "#60A5FA",
  MORNING: "#A78BFA",
  GENERAL: "#9CA3AF",
};

const CONTEXT_LABEL: Record<NonNullable<PainHistoryDay["context"]>, string> = {
  DURING_ACTIVITY: "During activity",
  AFTER_ACTIVITY: "After activity",
  AT_REST: "At rest",
  MORNING: "Morning",
  GENERAL: "General",
};

function fmtShortDate(ymd: string) {
  const date = new Date(`${ymd}T12:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PainHistoryChart({ days }: { days: PainHistoryDay[] }) {
  // Render only the most recent MAX_DAYS so older injuries don't blow up the
  // SVG width. The full history stays available via the recent-logs table.
  const visibleDays = days.length > MAX_DAYS ? days.slice(-MAX_DAYS) : days;
  const truncatedCount = days.length - visibleDays.length;
  const hasAnyData = visibleDays.some((d) => d.peak !== null && d.peak > 0);

  const chartHeight = 140;
  const xAxisHeight = 22;
  const yAxisWidth = 28;
  const minBarWidth = 4;
  const maxBarWidth = 12;
  const gap = 2;
  // Bar width adapts to day count so a 7-day strip doesn't look squashed
  // next to a 90-day strip.
  const targetWidth = 560;
  const barWidth = Math.max(minBarWidth, Math.min(maxBarWidth, Math.floor((targetWidth - visibleDays.length * gap) / Math.max(1, visibleDays.length))));
  const plotWidth = visibleDays.length * (barWidth + gap) - gap;
  const totalWidth = yAxisWidth + plotWidth;
  const totalHeight = chartHeight + xAxisHeight;

  const yTicks = [0, 3, 7, 10];
  const tickY = (level: number) => chartHeight - (level / 10) * chartHeight;

  // Label every ~1/6th of the strip, plus the first and last days.
  const labelStride = Math.max(1, Math.floor(visibleDays.length / 6));
  const labelIndices = new Set<number>();
  if (visibleDays.length > 0) {
    labelIndices.add(0);
    labelIndices.add(visibleDays.length - 1);
    for (let i = 0; i < visibleDays.length; i += labelStride) labelIndices.add(i);
  }

  const usedContexts = new Set<NonNullable<PainHistoryDay["context"]>>();
  for (const day of visibleDays) {
    if (day.context) usedContexts.add(day.context);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ overflowX: "auto" }}>
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          role="img"
          aria-label="Pain history over time"
          style={{ display: "block" }}
        >
          {/* y-axis grid + labels */}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={yAxisWidth}
                y1={tickY(tick)}
                x2={totalWidth}
                y2={tickY(tick)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "2 4"}
              />
              <text
                x={yAxisWidth - 4}
                y={tickY(tick) + 3}
                fontSize={9}
                fontWeight={700}
                textAnchor="end"
                fill="rgba(255,255,255,0.4)"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* bars */}
          {visibleDays.map((day, i) => {
            const x = yAxisWidth + i * (barWidth + gap);
            if (day.peak === null || day.peak <= 0) {
              return (
                <rect
                  key={day.ymd}
                  x={x}
                  y={chartHeight - 1}
                  width={barWidth}
                  height={1}
                  fill="rgba(255,255,255,0.10)"
                />
              );
            }
            const level = Math.max(0, Math.min(10, day.peak));
            const barH = Math.max(2, (level / 10) * chartHeight);
            const color = day.context ? CONTEXT_COLOR[day.context] : CONTEXT_COLOR.GENERAL;
            return (
              <rect
                key={day.ymd}
                x={x}
                y={chartHeight - barH}
                width={barWidth}
                height={barH}
                fill={color}
                rx={1}
              >
                <title>{`${fmtShortDate(day.ymd)}: ${level}/10${day.context ? ` · ${CONTEXT_LABEL[day.context]}` : ""}`}</title>
              </rect>
            );
          })}

          {/* x-axis labels */}
          {visibleDays.map((day, i) => {
            if (!labelIndices.has(i)) return null;
            const x = yAxisWidth + i * (barWidth + gap) + barWidth / 2;
            return (
              <text
                key={day.ymd}
                x={x}
                y={chartHeight + 14}
                fontSize={9}
                fontWeight={700}
                textAnchor="middle"
                fill="rgba(255,255,255,0.42)"
              >
                {fmtShortDate(day.ymd)}
              </text>
            );
          })}
        </svg>
      </div>

      {!hasAnyData && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
          No pain logged yet. Use the Log pain button above to track how this is feeling.
        </div>
      )}

      {usedContexts.size > 0 && (
        <div style={legendRow}>
          {(Array.from(usedContexts) as Array<NonNullable<PainHistoryDay["context"]>>).map((ctx) => (
            <span key={ctx} style={legendItem}>
              <span style={{ ...legendDot, background: CONTEXT_COLOR[ctx] }} />
              {CONTEXT_LABEL[ctx]}
            </span>
          ))}
        </div>
      )}

      {truncatedCount > 0 && (
        <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 700 }}>
          Showing the most recent {MAX_DAYS} days · {truncatedCount} earlier days hidden
        </div>
      )}
    </div>
  );
}

const legendRow: React.CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.65)",
};

const legendItem: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const legendDot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 2,
  display: "inline-block",
};
