// Multi-lane timeline — the whole plan as horizontal bands. Each track is a
// lane; active milestones are bars positioned by their projected window. A
// "today" line anchors the left; a target flag marks the deadline. Wide
// content scrolls inside its own container with sticky lane labels (per the
// CLAUDE.md wide-content rule). Server component — display only.

import { addDaysYmd, diffYmdDays, formatUtcDateLabel } from "@/lib/dates";
import type { FocusTrackView } from "@/app/focus/data";

const PX_PER_DAY = 5;
const LANE_H = 30;
const BAR_MIN_PX = 26;

export default function FocusTimeline({
  tracks,
  todayYmd,
  targetYmd,
  projectedEndYmd,
  accent,
}: {
  tracks: FocusTrackView[];
  todayYmd: string;
  targetYmd: string | null;
  projectedEndYmd: string | null;
  accent: string;
}) {
  // Collect every active milestone's projected window.
  const bars = tracks.flatMap((t) =>
    t.milestones
      .filter((m) => m.status === "ACTIVE" && m.projectedStartYmd && m.projectedEndYmd)
      .map((m) => ({
        trackKey: t.key,
        label: m.label,
        start: m.projectedStartYmd!,
        end: m.projectedEndYmd!,
        gateMet: m.gate.kind === "PAIN" ? m.gate.met === true : null,
      }))
  );
  if (bars.length === 0) return null;

  const rangeStart = todayYmd;
  const ends = bars.map((b) => b.end);
  const candidates = [...ends, projectedEndYmd, targetYmd].filter((y): y is string => Boolean(y));
  const latest = candidates.reduce((a, b) => (a >= b ? a : b), rangeStart);
  const rangeEnd = addDaysYmd(latest, 4); // small right pad
  const totalDays = Math.max(1, diffYmdDays(rangeEnd, rangeStart));
  const chartW = Math.max(360, totalDays * PX_PER_DAY);
  const xOf = (ymd: string) => Math.max(0, diffYmdDays(ymd, rangeStart)) * PX_PER_DAY;

  // Month gridlines: first of each month within the range.
  const months: { x: number; label: string }[] = [];
  {
    let cursor = `${rangeStart.slice(0, 7)}-01`;
    for (let i = 0; i < 18; i += 1) {
      if (cursor > rangeEnd) break;
      if (cursor >= rangeStart) months.push({ x: xOf(cursor), label: formatUtcDateLabel(cursor, { month: "short" }) });
      // advance one month
      const [y, m] = cursor.split("-").map(Number);
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      cursor = `${ny}-${String(nm).padStart(2, "0")}-01`;
    }
  }
  const targetX = targetYmd ? xOf(targetYmd) : null;

  return (
    <section style={wrap}>
      <div style={header}>Timeline</div>
      <div style={scrollArea} className="focusTimelineScroll">
        <div style={{ position: "relative", width: chartW + LABEL_W, minWidth: "100%" }}>
          {/* month labels row */}
          <div style={{ position: "relative", height: 16, marginLeft: LABEL_W }}>
            {months.map((mo, i) => (
              <span key={i} style={{ ...monthLabel, left: mo.x }}>{mo.label}</span>
            ))}
          </div>

          {/* lanes */}
          <div style={{ position: "relative" }}>
            {/* month gridlines + today + target, spanning all lanes */}
            <div style={{ position: "absolute", inset: 0, marginLeft: LABEL_W, pointerEvents: "none" }}>
              {months.map((mo, i) => (
                <span key={i} style={{ ...gridLine, left: mo.x }} />
              ))}
              <span style={{ ...todayLine }} title="Today" />
              {targetX != null ? <span style={{ ...targetLine, left: targetX }} title={`Target ${targetYmd}`} /> : null}
            </div>

            {tracks.map((t) => {
              const laneBars = bars.filter((b) => b.trackKey === t.key);
              return (
                <div key={t.key} style={laneRow}>
                  <div style={laneLabel} title={t.title}>{t.title}</div>
                  <div style={{ position: "relative", height: LANE_H, flex: 1 }}>
                    {laneBars.map((b, i) => {
                      const left = xOf(b.start);
                      const w = Math.max(BAR_MIN_PX, xOf(b.end) - left);
                      const filled = b.gateMet === true;
                      return (
                        <span
                          key={i}
                          style={{
                            ...bar,
                            left,
                            width: w,
                            background: filled ? accent : "rgba(255,255,255,0.05)",
                            borderColor: accent,
                            color: filled ? "#0b1220" : "rgba(255,255,255,0.85)",
                          }}
                          title={`${b.label} · ${formatUtcDateLabel(b.start, { month: "short", day: "numeric" })}–${formatUtcDateLabel(b.end, { month: "short", day: "numeric" })}`}
                        >
                          {b.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginLeft: LABEL_W, marginTop: 6, display: "flex", gap: 14, fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>
            <span>▏today</span>
            {targetYmd ? <span>▎target {formatUtcDateLabel(targetYmd, { month: "short", day: "numeric" })}</span> : null}
          </div>
        </div>
      </div>
      <style>{`
        .focusTimelineScroll { overflow-x: auto; scrollbar-width: thin; }
        .focusTimelineScroll::-webkit-scrollbar { height: 6px; }
        .focusTimelineScroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 999px; }
      `}</style>
    </section>
  );
}

const LABEL_W = 92;

const wrap = { display: "grid", gap: 8 } as const;

const header = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
} as const;

const scrollArea = { paddingBottom: 4 } as const;

const monthLabel = {
  position: "absolute",
  top: 0,
  fontSize: 10,
  fontWeight: 800,
  color: "rgba(255,255,255,0.4)",
  transform: "translateX(1px)",
} as const;

const gridLine = { position: "absolute", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)" } as const;
const todayLine = { position: "absolute", top: 0, bottom: 0, left: 0, width: 2, background: "rgba(255,255,255,0.5)" } as const;
const targetLine = { position: "absolute", top: 0, bottom: 0, width: 2, background: "rgba(248,113,113,0.7)" } as const;

const laneRow = { display: "flex", alignItems: "center", gap: 0, borderTop: "1px solid rgba(255,255,255,0.05)" } as const;

const laneLabel = {
  width: LABEL_W,
  flexShrink: 0,
  paddingRight: 8,
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.8)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

const bar = {
  position: "absolute",
  top: 5,
  height: LANE_H - 10,
  borderRadius: 6,
  border: "1px solid",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: `${LANE_H - 12}px`,
  padding: "0 7px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
} as const;
