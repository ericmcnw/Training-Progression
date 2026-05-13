// Server-renderable chart that fills its container width on any screen.
// Bars live in an SVG with width="100%" + preserveAspectRatio="none" so the
// plot stretches horizontally; the y-axis ticks and date labels render as
// absolutely-positioned HTML so they don't distort with the SVG.

export type PainHistoryDay = {
  ymd: string;
  peak: number | null;
  context: "AT_REST" | "DURING_ACTIVITY" | "AFTER_ACTIVITY" | "MORNING" | "GENERAL" | null;
};

const MAX_DAYS = 90;
const PLOT_HEIGHT = 140;
const Y_AXIS_WIDTH = 28;
// When the injury was opened long before the first pain log, trim that
// empty prelude so the chart focuses on the actual data — keep a couple
// days of context before the first log so the user can see it ramp in.
const PADDING_BEFORE_FIRST_LOG = 2;
// Floor for the visible range — a one-day-old injury with a single log
// shouldn't render as a single tower at the right edge.
const MIN_VISIBLE_DAYS = 7;

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
  // First cap to MAX_DAYS so very old injuries stay legible.
  const cappedDays = days.length > MAX_DAYS ? days.slice(-MAX_DAYS) : days;
  const cappedFromOldest = days.length - cappedDays.length;

  // Then trim the leading run of "no log" days so the chart doesn't lead
  // with weeks of baseline before the first real entry. Keep a small pad
  // before the first log, and never trim below MIN_VISIBLE_DAYS so the
  // plot still has room to breathe.
  const firstLogIndex = cappedDays.findIndex((d) => d.peak !== null);
  let visibleDays = cappedDays;
  let trimmedFromStart = 0;
  if (firstLogIndex > 0) {
    const desiredStart = Math.max(0, firstLogIndex - PADDING_BEFORE_FIRST_LOG);
    const minVisibleStart = Math.max(0, cappedDays.length - MIN_VISIBLE_DAYS);
    const startIndex = Math.min(desiredStart, minVisibleStart);
    if (startIndex > 0) {
      visibleDays = cappedDays.slice(startIndex);
      trimmedFromStart = startIndex;
    }
  }
  const totalHidden = cappedFromOldest + trimmedFromStart;

  const hasAnyData = visibleDays.some((d) => d.peak !== null && d.peak > 0);
  const dayCount = Math.max(1, visibleDays.length);

  // viewBox uses 100 units per day so each bar slot is a clean 100-unit
  // column regardless of how many days are rendered.
  const viewBoxWidth = dayCount * 100;
  const yTicks = [0, 3, 7, 10];
  const tickY = (level: number) => PLOT_HEIGHT - (level / 10) * PLOT_HEIGHT;

  // Label up to ~6 evenly-spaced dates so they don't overlap on a 30-day or
  // 90-day strip. First and last always show.
  const labelStride = Math.max(1, Math.floor(dayCount / 6));
  const labelIndices = new Set<number>();
  if (dayCount > 0) {
    labelIndices.add(0);
    labelIndices.add(dayCount - 1);
    for (let i = 0; i < dayCount; i += labelStride) labelIndices.add(i);
  }

  const usedContexts = new Set<NonNullable<PainHistoryDay["context"]>>();
  for (const day of visibleDays) {
    if (day.context) usedContexts.add(day.context);
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={chartShell}>
        {/* Y-axis labels — rendered as HTML so they don't get squished by
            the SVG's preserveAspectRatio="none". */}
        <div style={{ position: "relative", width: Y_AXIS_WIDTH, height: PLOT_HEIGHT }}>
          {yTicks.map((tick) => (
            <div
              key={tick}
              style={{
                position: "absolute",
                right: 4,
                top: `${((PLOT_HEIGHT - (tick / 10) * PLOT_HEIGHT) / PLOT_HEIGHT) * 100}%`,
                transform: "translateY(-50%)",
                fontSize: 10,
                fontWeight: 700,
                color: "rgba(255,255,255,0.4)",
              }}
            >
              {tick}
            </div>
          ))}
        </div>

        {/* Plot column — SVG bars + grid + x-axis labels share the same
            CSS column so a bar at day index i lines up with x-axis label i. */}
        <div style={{ display: "grid", gridTemplateRows: `${PLOT_HEIGHT}px auto`, gap: 4, minWidth: 0 }}>
          <div style={{ position: "relative", width: "100%", height: PLOT_HEIGHT }}>
            <svg
              width="100%"
              height={PLOT_HEIGHT}
              viewBox={`0 0 ${viewBoxWidth} ${PLOT_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Pain history over time"
              style={{ display: "block" }}
            >
              {/* gridlines — non-scaling-stroke keeps them 1px thin even
                  when the SVG scales horizontally. */}
              {yTicks.map((tick) => (
                <line
                  key={tick}
                  x1={0}
                  y1={tickY(tick)}
                  x2={viewBoxWidth}
                  y2={tickY(tick)}
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? undefined : "4 8"}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* bars — each day owns a 100-unit slot; the bar takes 60% of
                  that slot so adjacent days stay visually separated. */}
              {visibleDays.map((day, i) => {
                const slotX = i * 100;
                const barWidth = 60;
                const barX = slotX + (100 - barWidth) / 2;
                if (day.peak === null || day.peak <= 0) {
                  return (
                    <rect
                      key={day.ymd}
                      x={barX}
                      y={PLOT_HEIGHT - 1.5}
                      width={barWidth}
                      height={1.5}
                      fill="rgba(255,255,255,0.10)"
                    />
                  );
                }
                const level = Math.max(0, Math.min(10, day.peak));
                const barH = Math.max(3, (level / 10) * PLOT_HEIGHT);
                const color = day.context ? CONTEXT_COLOR[day.context] : CONTEXT_COLOR.GENERAL;
                return (
                  <rect
                    key={day.ymd}
                    x={barX}
                    y={PLOT_HEIGHT - barH}
                    width={barWidth}
                    height={barH}
                    fill={color}
                  >
                    <title>{`${fmtShortDate(day.ymd)}: ${level}/10${day.context ? ` · ${CONTEXT_LABEL[day.context]}` : ""}`}</title>
                  </rect>
                );
              })}
            </svg>
          </div>

          {/* x-axis labels — positioned by percentage so they line up with
              the bar centers regardless of how wide the chart renders. */}
          <div style={{ position: "relative", height: 14 }}>
            {Array.from(labelIndices).map((i) => {
              const day = visibleDays[i];
              if (!day) return null;
              const leftPercent = ((i + 0.5) / dayCount) * 100;
              return (
                <div
                  key={day.ymd}
                  style={{
                    position: "absolute",
                    left: `${leftPercent}%`,
                    transform: "translateX(-50%)",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.42)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fmtShortDate(day.ymd)}
                </div>
              );
            })}
          </div>
        </div>
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

      {totalHidden > 0 && (
        <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 700 }}>
          {trimmedFromStart > 0 && (
            <>
              Skipped {trimmedFromStart} day{trimmedFromStart === 1 ? "" : "s"} with no pain logged before the first entry
              {cappedFromOldest > 0 ? " · " : ""}
            </>
          )}
          {cappedFromOldest > 0 && <>Capped to the most recent {MAX_DAYS} days</>}
        </div>
      )}
    </div>
  );
}

const chartShell: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: `${Y_AXIS_WIDTH}px minmax(0, 1fr)`,
  gap: 4,
  width: "100%",
};

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
