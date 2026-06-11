"use client";

// Revamped activity-coverage graphic for the climbing hub. Replaces the
// two-row 52-week micro-cell heatmap with a single row of bigger weekly
// cells over the last 26 weeks:
//   - Cell fill = climbing-session count that week (blue intensity)
//   - Violet underline stripe = supporting training happened that week
//   - Tap a week → combined panel listing that week's climbing sessions
//     AND training logs together, each row linking to its log detail
// One row instead of two halves the vertical footprint and doubles the
// cell width so counts stay readable on mobile without pinch-zooming.

import Link from "next/link";
import { useState } from "react";
import type { HeatmapWeek } from "@/app/progress/details/activity-coverage";

const SESSION_RGB = "78,148,255";   // cardio blue — matches the old heatmap
const TRAINING_RGB = "168,85,247";  // violet — matches the old training row

const WEEKS_SHOWN = 26;

function cellBg(count: number): string {
  if (count === 0) return "rgba(255,255,255,0.04)";
  const alpha = Math.min(0.30 + count * 0.22, 0.95);
  return `rgba(${SESSION_RGB},${alpha})`;
}

function weekLabel(weekStart: Date) {
  const end = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

export default function ClimbingCoverageStrip({ weeks }: { weeks: HeatmapWeek[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const visible = weeks.slice(-WEEKS_SHOWN);
  if (visible.length === 0) return null;

  const activeWeek = activeIndex !== null ? visible[activeIndex] : null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: visible.length * 16, display: "grid", gap: 4 }}>
          {/* Month labels */}
          <div style={gridRowStyle(visible.length)}>
            {visible.map((w, i) => (
              <div key={i} style={monthLabelStyle}>
                {w.monthLabel ?? ""}
              </div>
            ))}
          </div>
          {/* Week cells */}
          <div style={gridRowStyle(visible.length)}>
            {visible.map((w, i) => {
              const sessions = w.sessions.length;
              const hasTraining = w.training.length > 0;
              const interactive = sessions > 0 || hasTraining;
              const isActive = activeIndex === i;
              const intensity = Math.min(0.30 + sessions * 0.22, 0.95);
              const textColor = sessions === 0 ? "transparent" : intensity > 0.65 ? "#0b1220" : "rgba(255,255,255,0.95)";
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    if (!interactive) { setActiveIndex(null); return; }
                    setActiveIndex((curr) => (curr === i ? null : i));
                  }}
                  disabled={!interactive}
                  title={`${weekLabel(w.weekStart)} — ${sessions} session${sessions !== 1 ? "s" : ""}${hasTraining ? ` · ${w.training.length} training` : ""}`}
                  aria-label={`${weekLabel(w.weekStart)} — ${sessions} climbing session${sessions !== 1 ? "s" : ""}${hasTraining ? ` and ${w.training.length} training log${w.training.length !== 1 ? "s" : ""}` : ""}`}
                  aria-pressed={isActive}
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 34,
                    minHeight: 0,
                    borderRadius: 6,
                    background: cellBg(sessions),
                    border: isActive
                      ? `1.5px solid rgba(${SESSION_RGB},0.95)`
                      : interactive
                        ? "1px solid rgba(255,255,255,0.07)"
                        : "1px solid transparent",
                    boxShadow: isActive ? `0 0 0 2px rgba(${SESSION_RGB},0.22)` : "none",
                    padding: 0,
                    cursor: interactive ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: textColor,
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: "inherit",
                    lineHeight: 1,
                    transition: "background 0.1s, border-color 0.1s, box-shadow 0.1s",
                  }}
                >
                  {sessions > 0 ? sessions : ""}
                  {hasTraining ? <span style={trainingStripeStyle} aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, fontSize: 11, opacity: 0.7, flexWrap: "wrap", alignItems: "center" }}>
        <span style={legendItemStyle}>
          <span style={{ ...swatchStyle, background: cellBg(2) }} />
          Climb sessions
        </span>
        <span style={legendItemStyle}>
          <span style={{ ...swatchStyle, height: 4, borderRadius: 2, background: `rgba(${TRAINING_RGB},0.9)` }} />
          Training that week
        </span>
        <span style={{ opacity: 0.55, fontWeight: 700 }}>Tap a week for details</span>
      </div>

      {/* Combined week panel — climbing sessions + training in one list */}
      {activeWeek ? (
        <div style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.3 }}>Week of {weekLabel(activeWeek.weekStart)}</span>
              <span style={countChipStyle}>
                {activeWeek.sessions.length} session{activeWeek.sessions.length !== 1 ? "s" : ""}
                {activeWeek.training.length > 0 ? ` · ${activeWeek.training.length} training` : ""}
              </span>
            </div>
            <button type="button" onClick={() => setActiveIndex(null)} aria-label="Close detail" style={closeBtnStyle}>
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            {[...activeWeek.sessions.map((e) => ({ ...e, kind: "session" as const })),
              ...activeWeek.training.map((e) => ({ ...e, kind: "training" as const }))]
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map((event, idx) => {
                const dateLabel = event.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                const stripeColor = event.kind === "session" ? `rgba(${SESSION_RGB},0.9)` : `rgba(${TRAINING_RGB},0.9)`;
                const inner = (
                  <div style={eventRowStyle}>
                    <span style={{ width: 3, alignSelf: "stretch", flexShrink: 0, borderRadius: 2, background: stripeColor }} aria-hidden />
                    <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>{event.label}</span>
                      {event.sublabel ? (
                        <span style={{ fontSize: 11, opacity: 0.6, lineHeight: 1.3 }}>{event.sublabel}</span>
                      ) : null}
                    </div>
                    <span style={{ fontSize: 11, opacity: 0.62, fontWeight: 700, flexShrink: 0 }}>{dateLabel}</span>
                  </div>
                );
                return event.href ? (
                  <Link key={idx} href={event.href} style={{ textDecoration: "none", color: "inherit" }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={idx}>{inner}</div>
                );
              })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function gridRowStyle(count: number): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${count}, minmax(14px, 1fr))`,
    gap: 3,
  };
}

const monthLabelStyle: React.CSSProperties = {
  fontSize: 9,
  opacity: 0.55,
  fontWeight: 800,
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
  overflow: "visible",
};

const trainingStripeStyle: React.CSSProperties = {
  position: "absolute",
  left: 3,
  right: 3,
  bottom: 3,
  height: 3,
  borderRadius: 2,
  background: `rgba(${TRAINING_RGB},0.9)`,
};

const legendItemStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontWeight: 700,
};

const swatchStyle: React.CSSProperties = {
  display: "inline-block",
  width: 12,
  height: 12,
  borderRadius: 3,
  border: "1px solid rgba(255,255,255,0.08)",
};

const panelStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid rgba(${SESSION_RGB},0.28)`,
  background: `rgba(${SESSION_RGB},0.06)`,
  display: "grid",
  gap: 10,
};

const countChipStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.65,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
};

const closeBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  cursor: "pointer",
  fontSize: 12,
  padding: 0,
  color: "inherit",
};

const eventRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 11px",
  borderRadius: 9,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.05)",
};
