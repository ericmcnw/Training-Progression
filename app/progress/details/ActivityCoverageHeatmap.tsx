"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HeatmapWeek } from "./activity-coverage";

type RowKind = "sessions" | "training";

type RowColor = { r: number; g: number; b: number };

const SESSION_COLOR: RowColor = { r: 78, g: 148, b: 255 };
const TRAINING_COLOR: RowColor = { r: 168, g: 85, b: 247 };

const CELL_W = 16;
const CELL_H = 22;
const GAP = 3;
const LABEL_W = 64;

function cellBg({ r, g, b }: RowColor, count: number) {
  if (count === 0) return "rgba(255,255,255,0.04)";
  const alpha = Math.min(0.28 + count * 0.22, 0.95);
  return `rgba(${r},${g},${b},${alpha})`;
}

function weekLabel(weekStart: Date) {
  const end = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

export default function ActivityCoverageHeatmap({
  weeks,
  sessionLabel = "Session",
  trainingLabel = "Training",
  sessionRowLabel = "Sessions",
  trainingRowLabel = "Training",
}: {
  weeks: HeatmapWeek[];
  sessionLabel?: string;
  trainingLabel?: string;
  sessionRowLabel?: string;
  trainingRowLabel?: string;
}) {
  const [active, setActive] = useState<{ weekIndex: number; row: RowKind } | null>(null);

  const activeWeek = active ? weeks[active.weekIndex] : null;
  const activeEvents = useMemo(() => {
    if (!active || !activeWeek) return [];
    return active.row === "sessions" ? activeWeek.sessions : activeWeek.training;
  }, [active, activeWeek]);

  if (weeks.length === 0) return null;

  function renderRow(row: RowKind, label: string, color: RowColor, getCount: (w: HeatmapWeek) => number, suffix: string) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={rowLabelStyle}>{label}</span>
        <div style={{ display: "flex", gap: GAP }}>
          {weeks.map((w, i) => {
            const count = getCount(w);
            const isActive = active?.weekIndex === i && active.row === row;
            const interactive = count > 0;
            return (
              <button
                type="button"
                key={i}
                onClick={() => {
                  if (!interactive) {
                    setActive(null);
                    return;
                  }
                  setActive((curr) =>
                    curr?.weekIndex === i && curr.row === row ? null : { weekIndex: i, row }
                  );
                }}
                title={count > 0 ? `${weekLabel(w.weekStart)} — ${count} ${suffix}${count !== 1 ? "s" : ""}` : weekLabel(w.weekStart)}
                aria-label={`${weekLabel(w.weekStart)} — ${count} ${suffix}${count !== 1 ? "s" : ""}`}
                aria-pressed={isActive}
                disabled={!interactive}
                style={{
                  width: CELL_W,
                  height: CELL_H,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: cellBg(color, count),
                  border: isActive
                    ? `1.5px solid rgba(${color.r},${color.g},${color.b},0.95)`
                    : interactive
                    ? "1px solid rgba(255,255,255,0.06)"
                    : "1px solid transparent",
                  padding: 0,
                  cursor: interactive ? "pointer" : "default",
                  boxShadow: isActive
                    ? `0 0 0 2px rgba(${color.r},${color.g},${color.b},0.22)`
                    : "none",
                  transition: "background 0.1s, border-color 0.1s, box-shadow 0.1s",
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const activeColor = active?.row === "sessions" ? SESSION_COLOR : TRAINING_COLOR;
  const activeRowLabel = active?.row === "sessions" ? sessionLabel : trainingLabel;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 6, paddingBottom: 4 }}>
          {/* Month labels row */}
          <div style={{ display: "flex", gap: GAP, marginLeft: LABEL_W + 10 }}>
            {weeks.map((w, i) => (
              <div
                key={i}
                style={{
                  width: CELL_W,
                  flexShrink: 0,
                  fontSize: 9,
                  opacity: 0.55,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  whiteSpace: "nowrap",
                  overflow: "visible",
                }}
              >
                {w.monthLabel ?? ""}
              </div>
            ))}
          </div>

          {renderRow("sessions", sessionRowLabel, SESSION_COLOR, (w) => w.sessions.length, sessionLabel.toLowerCase())}
          {renderRow("training", trainingRowLabel, TRAINING_COLOR, (w) => w.training.length, trainingLabel.toLowerCase())}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, fontSize: 11, opacity: 0.7, flexWrap: "wrap" }}>
        <span style={legendItemStyle}>
          <span style={{ ...swatchStyle, background: cellBg(SESSION_COLOR, 2) }} />
          {sessionLabel}
        </span>
        <span style={legendItemStyle}>
          <span style={{ ...swatchStyle, background: cellBg(TRAINING_COLOR, 2) }} />
          {trainingLabel}
        </span>
        <span style={{ opacity: 0.55, fontWeight: 700 }}>Tap a cell to see details</span>
      </div>

      {/* Detail panel */}
      {active && activeWeek ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid rgba(${activeColor.r},${activeColor.g},${activeColor.b},0.28)`,
            background: `rgba(${activeColor.r},${activeColor.g},${activeColor.b},0.06)`,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
              <span style={{ ...swatchStyle, background: `rgba(${activeColor.r},${activeColor.g},${activeColor.b},0.85)` }} />
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.3 }}>{activeRowLabel}</span>
              <span style={{ fontSize: 12, opacity: 0.4 }}>·</span>
              <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>{weekLabel(activeWeek.weekStart)}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  opacity: 0.65,
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                {activeEvents.length} {activeEvents.length === 1 ? "log" : "logs"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Close detail"
              style={closeBtnStyle}
            >
              ✕
            </button>
          </div>

          {activeEvents.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.6 }}>Nothing logged in this row that week.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {activeEvents.map((event, idx) => {
                const dateLabel = event.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                const inner = (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 10,
                      padding: "9px 11px",
                      borderRadius: 9,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
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
          )}
        </div>
      ) : null}
    </div>
  );
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  opacity: 0.6,
  width: LABEL_W,
  flexShrink: 0,
  textAlign: "right",
  textTransform: "uppercase",
  letterSpacing: 0.7,
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

const closeBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
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
