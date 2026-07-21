// Multi-lane timeline — the whole plan as bands positioned by projected date.
// Two orientations, CSS-switched at the app's 720px breakpoint:
//   • desktop: horizontal lanes (time flows right), sticky lane labels,
//     horizontal scroll in its own container (CLAUDE wide-content rule)
//   • mobile: vertical columns (time flows DOWN, tracks side by side) — no
//     sideways scrolling on a phone
// Server component — display only. The caller wraps it in a collapsible.

import { addDaysYmd, diffYmdDays, formatUtcDateLabel } from "@/lib/dates";
import type { FocusTrackView } from "@/app/focus/data";

const PX_PER_DAY_H = 5;
const PX_PER_DAY_V = 3;
const LANE_H = 30;
const BAR_MIN_PX = 26;
const LABEL_W = 92;
const V_AXIS_W = 40;

type Bar = {
  trackKey: string;
  label: string;
  start: string;
  end: string;
  startDay: number;
  endDay: number;
  gateMet: boolean | null;
};

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
  const rangeStart = todayYmd;
  const dayOf0 = (ymd: string) => Math.max(0, diffYmdDays(ymd, rangeStart));
  const bars: Bar[] = tracks.flatMap((t) =>
    t.milestones
      .filter((m) => m.status === "ACTIVE" && m.projectedStartYmd && m.projectedEndYmd)
      .map((m) => ({
        trackKey: t.key,
        label: m.label,
        start: m.projectedStartYmd!,
        end: m.projectedEndYmd!,
        startDay: dayOf0(m.projectedStartYmd!),
        endDay: dayOf0(m.projectedEndYmd!),
        gateMet: m.gate.kind === "PAIN" || m.gate.kind === "FREQUENCY" ? m.gate.met === true : null,
      }))
  );
  if (bars.length === 0) return null;

  const candidates = [...bars.map((b) => b.end), projectedEndYmd, targetYmd].filter(
    (y): y is string => Boolean(y)
  );
  const latest = candidates.reduce((a, b) => (a >= b ? a : b), rangeStart);
  const rangeEnd = addDaysYmd(latest, 4);
  const totalDays = Math.max(1, diffYmdDays(rangeEnd, rangeStart));

  // Month tick positions in DAYS from range start (orientation-agnostic).
  const monthTicks: { day: number; label: string }[] = [];
  {
    let cursor = `${rangeStart.slice(0, 7)}-01`;
    for (let i = 0; i < 18; i += 1) {
      if (cursor > rangeEnd) break;
      if (cursor >= rangeStart) {
        monthTicks.push({ day: diffYmdDays(cursor, rangeStart), label: formatUtcDateLabel(cursor, { month: "short" }) });
      }
      const [y, m] = cursor.split("-").map(Number);
      cursor = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    }
  }
  const targetDay = targetYmd ? dayOf0(targetYmd) : null;

  const activeTracks = tracks.filter((t) => bars.some((b) => b.trackKey === t.key));

  return (
    <div>
      {/* ── Horizontal (desktop ≥720px) ─────────────────────────────── */}
      <div className="focusTlH" style={{ display: "none" }}>
        <HorizontalChart
          tracks={activeTracks}
          bars={bars}
          totalDays={totalDays}
          monthTicks={monthTicks}
          targetDay={targetDay}
          targetYmd={targetYmd}
          accent={accent}
        />
      </div>

      {/* ── Vertical (mobile <720px) — time flows down ───────────────── */}
      <div className="focusTlV" style={{ display: "none" }}>
        <VerticalChart
          tracks={activeTracks}
          bars={bars}
          totalDays={totalDays}
          monthTicks={monthTicks}
          targetDay={targetDay}
          targetYmd={targetYmd}
          accent={accent}
        />
      </div>

      <style>{`
        @media (min-width: 720px) { .focusTlH { display: block !important; } }
        @media (max-width: 719.98px) { .focusTlV { display: block !important; } }
        .focusTlHScroll { overflow-x: auto; scrollbar-width: thin; }
        .focusTlHScroll::-webkit-scrollbar { height: 6px; }
        .focusTlHScroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.16); border-radius: 999px; }
      `}</style>
    </div>
  );
}

// ── Horizontal variant ─────────────────────────────────────────────────────

function HorizontalChart({
  tracks,
  bars,
  totalDays,
  monthTicks,
  targetDay,
  targetYmd,
  accent,
}: {
  tracks: FocusTrackView[];
  bars: Bar[];
  totalDays: number;
  monthTicks: { day: number; label: string }[];
  targetDay: number | null;
  targetYmd: string | null;
  accent: string;
}) {
  const chartW = Math.max(360, totalDays * PX_PER_DAY_H);
  const x = (day: number) => day * PX_PER_DAY_H;

  return (
    <div className="focusTlHScroll" style={{ paddingBottom: 4 }}>
      <div style={{ position: "relative", width: chartW + LABEL_W, minWidth: "100%" }}>
        <div style={{ position: "relative", height: 16, marginLeft: LABEL_W }}>
          {monthTicks.map((mo, i) => (
            <span key={i} style={{ ...hMonthLabel, left: x(mo.day) }}>{mo.label}</span>
          ))}
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, marginLeft: LABEL_W, pointerEvents: "none" }}>
            {monthTicks.map((mo, i) => (
              <span key={i} style={{ ...hGridLine, left: x(mo.day) }} />
            ))}
            <span style={hTodayLine} title="Today" />
            {targetDay != null ? <span style={{ ...hTargetLine, left: x(targetDay) }} title={`Target ${targetYmd}`} /> : null}
          </div>

          {tracks.map((t) => (
            <div key={t.key} style={hLaneRow}>
              <div style={hLaneLabel} title={t.title}>{t.title}</div>
              <div style={{ position: "relative", height: LANE_H, flex: 1 }}>
                {bars.filter((b) => b.trackKey === t.key).map((b, i) => (
                  <span
                    key={i}
                    style={{
                      ...hBar,
                      left: x(b.startDay),
                      width: Math.max(BAR_MIN_PX, x(b.endDay) - x(b.startDay)),
                      background: b.gateMet === true ? accent : "rgba(255,255,255,0.05)",
                      borderColor: accent,
                      color: b.gateMet === true ? "#0b1220" : "rgba(255,255,255,0.85)",
                    }}
                    title={`${b.label} · ${fmtRange(b)}`}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginLeft: LABEL_W, marginTop: 6, display: "flex", gap: 14, fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>
          <span>▏today</span>
          {targetYmd ? <span>▎target {formatUtcDateLabel(targetYmd, { month: "short", day: "numeric" })}</span> : null}
        </div>
      </div>
    </div>
  );
}

// ── Vertical variant (mobile) ──────────────────────────────────────────────

function VerticalChart({
  tracks,
  bars,
  totalDays,
  monthTicks,
  targetDay,
  targetYmd,
  accent,
}: {
  tracks: FocusTrackView[];
  bars: Bar[];
  totalDays: number;
  monthTicks: { day: number; label: string }[];
  targetDay: number | null;
  targetYmd: string | null;
  accent: string;
}) {
  const chartH = Math.max(180, totalDays * PX_PER_DAY_V);
  const y = (day: number) => day * PX_PER_DAY_V;

  return (
    <div>
      {/* column headers */}
      <div style={{ display: "flex", marginLeft: V_AXIS_W, gap: 6 }}>
        {tracks.map((t) => (
          <div key={t.key} style={vColHeader} title={t.title}>{t.title}</div>
        ))}
      </div>

      <div style={{ display: "flex", position: "relative" }}>
        {/* month axis rail */}
        <div style={{ position: "relative", width: V_AXIS_W, height: chartH, flexShrink: 0 }}>
          {monthTicks.map((mo, i) => (
            <span key={i} style={{ ...vMonthLabel, top: y(mo.day) }}>{mo.label}</span>
          ))}
        </div>

        {/* gridlines spanning the columns */}
        <div style={{ position: "absolute", left: V_AXIS_W, right: 0, top: 0, height: chartH, pointerEvents: "none" }}>
          {monthTicks.map((mo, i) => (
            <span key={i} style={{ ...vGridLine, top: y(mo.day) }} />
          ))}
          <span style={vTodayLine} title="Today" />
          {targetDay != null ? <span style={{ ...vTargetLine, top: y(targetDay) }} title={`Target ${targetYmd}`} /> : null}
        </div>

        {/* track columns */}
        <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 0 }}>
          {tracks.map((t) => (
            <div key={t.key} style={{ position: "relative", flex: 1, minWidth: 0, height: chartH }}>
              {bars.filter((b) => b.trackKey === t.key).map((b, i) => {
                const top = y(b.startDay);
                const h = Math.max(24, y(b.endDay) - top);
                return (
                  <span
                    key={i}
                    style={{
                      ...vBar,
                      top,
                      height: h,
                      background: b.gateMet === true ? accent : "rgba(255,255,255,0.05)",
                      borderColor: accent,
                      color: b.gateMet === true ? "#0b1220" : "rgba(255,255,255,0.85)",
                    }}
                    title={`${b.label} · ${fmtRange(b)}`}
                  >
                    <span style={vBarText}>{b.label}</span>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginLeft: V_AXIS_W, marginTop: 6, display: "flex", gap: 14, fontSize: 10.5, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>
        <span>▔ today</span>
        {targetYmd ? <span>▔ target {formatUtcDateLabel(targetYmd, { month: "short", day: "numeric" })}</span> : null}
      </div>
    </div>
  );
}

// ── shared helpers ─────────────────────────────────────────────────────────

function fmtRange(b: Bar): string {
  return `${formatUtcDateLabel(b.start, { month: "short", day: "numeric" })}–${formatUtcDateLabel(b.end, { month: "short", day: "numeric" })}`;
}

// ── styles ─────────────────────────────────────────────────────────────────

const hMonthLabel = { position: "absolute", top: 0, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", transform: "translateX(1px)" } as const;
const hGridLine = { position: "absolute", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)" } as const;
const hTodayLine = { position: "absolute", top: 0, bottom: 0, left: 0, width: 2, background: "rgba(255,255,255,0.5)" } as const;
const hTargetLine = { position: "absolute", top: 0, bottom: 0, width: 2, background: "rgba(248,113,113,0.7)" } as const;
const hLaneRow = { display: "flex", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.05)" } as const;
const hLaneLabel = {
  width: LABEL_W, flexShrink: 0, paddingRight: 8, fontSize: 11, fontWeight: 800,
  color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
} as const;
const hBar = {
  position: "absolute", top: 5, height: LANE_H - 10, borderRadius: 6, border: "1px solid",
  fontSize: 10, fontWeight: 800, lineHeight: `${LANE_H - 12}px`, padding: "0 7px",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", boxSizing: "border-box",
} as const;

const vColHeader = {
  flex: 1, minWidth: 0, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.75)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingBottom: 4,
} as const;
const vMonthLabel = { position: "absolute", left: 0, fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,0.4)", transform: "translateY(1px)" } as const;
const vGridLine = { position: "absolute", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)" } as const;
const vTodayLine = { position: "absolute", left: 0, right: 0, top: 0, height: 2, background: "rgba(255,255,255,0.5)" } as const;
const vTargetLine = { position: "absolute", left: 0, right: 0, height: 2, background: "rgba(248,113,113,0.7)" } as const;
const vBar = {
  position: "absolute", left: 0, right: 0, borderRadius: 7, border: "1px solid",
  padding: "3px 5px", boxSizing: "border-box", overflow: "hidden",
} as const;
const vBarText = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  fontSize: 9.5,
  fontWeight: 800,
  lineHeight: 1.25,
} as const;
