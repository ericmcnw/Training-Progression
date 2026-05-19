"use client";

// MovementPatternsCard — compact dashboard summary of which movement
// patterns are being trained vs lacking. Tapping the card opens a popover
// with an 8-week heatmap (patterns × weeks).

import { useState, type CSSProperties } from "react";
import type { MovementPatternData, MovementPatternRow, PatternStatus } from "./movement-patterns";
import { COLOR, RADIUS, cardSurface, cardHeader, cardTitle, cardHint } from "./tokens";
import Popover from "./Popover";

type Props = { data: MovementPatternData };

export default function MovementPatternsCard({ data }: Props) {
  const [open, setOpen] = useState(false);

  if (data.patterns.length === 0) {
    return (
      <section style={cardSurface} aria-label="Movement patterns">
        <header style={cardHeader}>
          <span style={cardTitle}>Movement patterns</span>
        </header>
        <div style={emptyState}>No pattern data yet.</div>
      </section>
    );
  }

  const flagged = data.patterns.filter((p) => p.status === "lacking" || p.status === "absent").slice(0, 4);
  const strong = data.patterns.filter((p) => p.status === "strong" || p.status === "ok").slice(0, 4);

  return (
    <section style={cardSurface} aria-label="Movement patterns">
      <header style={cardHeader}>
        <span style={cardTitle}>Movement patterns</span>
        <button type="button" onClick={() => setOpen(true)} style={expandLink}>
          view all →
        </button>
      </header>

      {/* Summary tiles */}
      <div style={statRow}>
        <StatusTile
          tone="ok"
          count={data.summary.strong + data.summary.ok}
          label="on track"
        />
        <StatusTile
          tone="lacking"
          count={data.summary.lacking}
          label="lacking"
        />
        <StatusTile
          tone="absent"
          count={data.summary.absent}
          label="absent"
        />
      </div>

      {/* Pattern preview rows — clickable to open full heatmap. */}
      <button type="button" onClick={() => setOpen(true)} style={previewButton}>
        <div style={previewSection}>
          {flagged.length > 0 ? (
            <div style={previewBlock}>
              <span style={previewBlockLabel}>Needs work</span>
              <div style={chipRow}>
                {flagged.map((p) => (
                  <PatternChip key={p.slug} row={p} />
                ))}
              </div>
            </div>
          ) : null}
          {strong.length > 0 ? (
            <div style={previewBlock}>
              <span style={previewBlockLabel}>Strong</span>
              <div style={chipRow}>
                {strong.map((p) => (
                  <PatternChip key={p.slug} row={p} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </button>

      <HeatmapPopover open={open} onClose={() => setOpen(false)} data={data} />
    </section>
  );
}

// ─────────────────────────── compact dashboard helpers

function StatusTile({ count, label, tone }: { count: number; label: string; tone: "ok" | "lacking" | "absent" }) {
  const color = tone === "ok" ? COLOR.success : tone === "lacking" ? COLOR.amber : COLOR.red;
  const bg = tone === "ok" ? COLOR.successSoft : tone === "lacking" ? COLOR.amberSoft : COLOR.redSoft;
  return (
    <div style={{ ...tile, background: bg, borderColor: `${color}` }}>
      <span style={{ ...tileValue, color }}>{count}</span>
      <span style={tileLabel}>{label}</span>
    </div>
  );
}

function PatternChip({ row }: { row: MovementPatternRow }) {
  const tone = statusColor(row.status);
  return (
    <span style={chip} title={`${row.label} — ${row.recentCount} sessions in last 4 weeks`}>
      <span style={{ ...chipDot, background: tone }} />
      <span style={chipText}>{row.label}</span>
      <span style={chipCount}>{row.recentCount}</span>
    </span>
  );
}

// ─────────────────────────── heatmap popover

function HeatmapPopover({ open, onClose, data }: { open: boolean; onClose: () => void; data: MovementPatternData }) {
  if (!open) return null;

  // Compute global peak across all patterns + weeks for consistent color scaling.
  const globalPeak = Math.max(1, ...data.patterns.flatMap((p) => p.weeks));

  return (
    <Popover
      open={open}
      onClose={onClose}
      title="Movement patterns"
      subtitle={`last 8 weeks · ${data.patterns.length} patterns`}
      desktopWidth={520}
    >
      {/* Date axis (top) */}
      <div style={heatmapShell}>
        <div style={heatmapHeaderRow}>
          <div style={heatmapPatternLabel} />
          <div style={heatmapWeeksHeader}>
            {data.weekStarts.map((ws, i) => (
              <span key={ws} style={{ ...heatmapWeekHeaderCell, ...(i === data.weekStarts.length - 1 ? heatmapWeekHeaderCurrent : null) }}>
                {weekShort(ws)}
              </span>
            ))}
          </div>
          <div style={heatmapTotalLabel}>total</div>
        </div>

        {data.patterns.map((p) => (
          <div key={p.slug} style={heatmapRow}>
            <div style={heatmapPatternLabel}>
              <span style={{ ...patternStatusDot, background: statusColor(p.status) }} />
              <span style={patternName}>{p.label}</span>
            </div>
            <div style={heatmapCells}>
              {p.weeks.map((count, i) => (
                <span
                  key={i}
                  style={heatmapCell(count, globalPeak, statusColor(p.status))}
                  title={`${p.label}: ${count} session${count === 1 ? "" : "s"} · week of ${data.weekStarts[i]}`}
                >
                  {count > 0 ? count : ""}
                </span>
              ))}
            </div>
            <div style={heatmapTotalCol}>
              <span style={heatmapTotalValue}>{p.totalCount}</span>
              <span style={heatmapTotalSub}>·{p.recentCount}/4w</span>
            </div>
          </div>
        ))}

        <div style={legendRow}>
          <span style={legendItem}>
            <span style={{ ...legendDot, background: COLOR.success }} /> strong
          </span>
          <span style={legendItem}>
            <span style={{ ...legendDot, background: "rgba(132,204,255,0.85)" }} /> on track
          </span>
          <span style={legendItem}>
            <span style={{ ...legendDot, background: COLOR.amber }} /> lacking
          </span>
          <span style={legendItem}>
            <span style={{ ...legendDot, background: COLOR.red }} /> absent
          </span>
        </div>
      </div>
    </Popover>
  );
}

// ─────────────────────────── helpers + styles

function statusColor(status: PatternStatus): string {
  switch (status) {
    case "strong": return COLOR.success;
    case "ok": return "rgba(132,204,255,0.85)";
    case "lacking": return COLOR.amber;
    case "absent": return COLOR.red;
  }
}

function weekShort(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

const statRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 6,
};

const tile: CSSProperties = {
  display: "grid",
  gap: 1,
  padding: "8px 10px",
  borderRadius: RADIUS.inner,
  border: `1px solid ${COLOR.border}`,
  textAlign: "center",
};

const tileValue: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1.05,
};

const tileLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: COLOR.textFaint,
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

const previewButton: CSSProperties = {
  appearance: "none",
  margin: 0,
  padding: 0,
  background: "transparent",
  border: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
  width: "100%",
};

const previewSection: CSSProperties = {
  display: "grid",
  gap: 8,
};

const previewBlock: CSSProperties = {
  display: "grid",
  gap: 4,
};

const previewBlockLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};

const chipRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
};

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${COLOR.border}`,
  fontSize: 11,
  fontWeight: 700,
};

const chipDot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
};

const chipText: CSSProperties = {
  color: COLOR.text,
};

const chipCount: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: COLOR.textFaint,
  letterSpacing: 0.3,
};

const expandLink: CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "none",
  color: COLOR.success,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  cursor: "pointer",
  padding: 0,
};

const emptyState: CSSProperties = {
  fontSize: 12,
  color: COLOR.textFaint,
  padding: "12px 6px",
  fontStyle: "italic",
};

// ─────────── heatmap popover styles

const heatmapShell: CSSProperties = {
  display: "grid",
  gap: 4,
};

const heatmapHeaderRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(90px, 130px) 1fr 64px",
  gap: 8,
  alignItems: "center",
  paddingBottom: 4,
};

const heatmapPatternLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
};

const heatmapWeeksHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
  gap: 3,
};

const heatmapWeekHeaderCell: CSSProperties = {
  textAlign: "center",
  fontSize: 9,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const heatmapWeekHeaderCurrent: CSSProperties = {
  color: COLOR.text,
  fontWeight: 800,
};

const heatmapTotalLabel: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.4,
  color: COLOR.textFaint,
  textTransform: "uppercase",
  textAlign: "right",
};

const heatmapRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(90px, 130px) 1fr 64px",
  gap: 8,
  alignItems: "center",
  padding: "4px 0",
};

const patternStatusDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const patternName: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const heatmapCells: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
  gap: 3,
};

function heatmapCell(count: number, peak: number, accent: string): CSSProperties {
  const intensity = peak > 0 ? Math.min(1, count / peak) : 0;
  // Map intensity to alpha so empty cells are barely visible and peak cells are vivid.
  const alpha = count === 0 ? 0.04 : 0.12 + 0.78 * intensity;
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    borderRadius: 4,
    background: count === 0 ? "rgba(255,255,255,0.04)" : tintAccent(accent, alpha),
    color: count === 0 ? "transparent" : intensity > 0.55 ? "#0b1220" : COLOR.text,
    fontSize: 10.5,
    fontWeight: 800,
    border: count === 0 ? `1px solid rgba(255,255,255,0.04)` : `1px solid ${tintAccent(accent, 0.45)}`,
  };
}

function tintAccent(rgba: string, alpha: number): string {
  // rgba inputs from lib look like "rgba(84,203,130,0.9)". Swap the alpha.
  const match = rgba.match(/rgba\(([^)]+)\)/);
  if (!match) return rgba;
  const [r, g, b] = match[1].split(",").slice(0, 3).map((s) => Number(s.trim()));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const heatmapTotalCol: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "flex-end",
  gap: 4,
};

const heatmapTotalValue: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: COLOR.text,
};

const heatmapTotalSub: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const legendRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  paddingTop: 6,
  marginTop: 6,
  borderTop: `1px solid ${COLOR.border}`,
};

const legendItem: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10,
  fontWeight: 700,
  color: COLOR.textDim,
};

const legendDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
};
