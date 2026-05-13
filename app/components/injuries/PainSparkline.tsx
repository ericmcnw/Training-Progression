// Pure presentational — no client hooks needed. Inline SVG renders the
// daily-peak pain strip; the trend chip sits next to it.

export type PainSparkDay = { ymd: string; peak: number | null };

export type PainSparkTrend = {
  direction: "improving" | "steady" | "worsening" | "unknown";
  weeklyDelta: number | null;
  last7avg: number | null;
  prior21avg: number | null;
};

function painColor(level: number) {
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  if (level >= 1) return "#86EFAC";
  return "rgba(255,255,255,0.25)";
}

function trendLabel(trend: PainSparkTrend): string {
  if (trend.direction === "unknown") return "Not enough data";
  if (trend.direction === "steady") return "Steady";
  const delta = trend.weeklyDelta;
  if (delta === null) return trend.direction === "improving" ? "Improving" : "Worsening";
  const formatted = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
  return `${formatted} pts/wk`;
}

function trendChipStyle(direction: PainSparkTrend["direction"]): React.CSSProperties {
  if (direction === "improving") {
    return { border: "1px solid rgba(134,239,172,0.35)", background: "rgba(134,239,172,0.10)", color: "#BBF7D0" };
  }
  if (direction === "worsening") {
    return { border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.10)", color: "#FCA5A5" };
  }
  if (direction === "steady") {
    return { border: "1px solid rgba(251,191,36,0.32)", background: "rgba(251,191,36,0.08)", color: "#FDE68A" };
  }
  return { border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)" };
}

function arrowGlyph(direction: PainSparkTrend["direction"]): string {
  if (direction === "improving") return "↓";
  if (direction === "worsening") return "↑";
  if (direction === "steady") return "→";
  return "·";
}

export default function PainSparkline({
  days,
  trend,
  height = 28,
}: {
  days: PainSparkDay[];
  trend: PainSparkTrend;
  height?: number;
}) {
  const dayCount = days.length;
  const barWidth = 3;
  const gap = 1;
  const innerHeight = height;
  const width = dayCount * (barWidth + gap) - gap;
  const hasAnyData = days.some((d) => d.peak !== null && d.peak > 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
      <svg
        width={width}
        height={innerHeight}
        viewBox={`0 0 ${width} ${innerHeight}`}
        role="img"
        aria-label="30-day pain history"
        style={{ display: "block", flexShrink: 0 }}
      >
        {days.map((day, i) => {
          const x = i * (barWidth + gap);
          if (day.peak === null) {
            // Baseline tick so empty days are still readable as "no log".
            return (
              <rect
                key={day.ymd}
                x={x}
                y={innerHeight - 1}
                width={barWidth}
                height={1}
                fill="rgba(255,255,255,0.15)"
              />
            );
          }
          const level = Math.max(0, Math.min(10, day.peak));
          const barH = Math.max(2, Math.round((level / 10) * innerHeight));
          return (
            <rect
              key={day.ymd}
              x={x}
              y={innerHeight - barH}
              width={barWidth}
              height={barH}
              fill={painColor(level)}
              rx={1}
            >
              <title>{`${day.ymd}: ${level}/10`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ ...chipStyle, ...trendChipStyle(trend.direction) }}>
          <span style={{ fontSize: 12, fontWeight: 900 }}>{arrowGlyph(trend.direction)}</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.2 }}>{trendLabel(trend)}</span>
        </span>
        {!hasAnyData && (
          <span style={{ fontSize: 11, opacity: 0.45, fontWeight: 700 }}>no logs yet</span>
        )}
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};
