"use client";

import { useState, type CSSProperties } from "react";
import {
  climbOutcomeColor,
  climbOutcomeLabel,
  PYRAMID_OUTCOMES,
  type ClimbGradeSystem,
  type ClimbOutcome,
} from "@/lib/climb-types";

// Interactive grade pyramid. Tapping a bar segment opens a bubble under
// that row listing the actual climbs behind the number — name, location,
// date — because "12 climbs at V4" is only useful if you can ask which.
//
// Selection lives here rather than per-column so opening a bar in Outdoor
// closes whatever was open in Indoor; two bubbles at once reads as a bug.

export type PyramidClimb = {
  id: string;
  outcome: ClimbOutcome;
  name: string | null;
  locationName: string | null;
  dateLabel: string;
};

export type PyramidColumnRow = {
  grade: string;
  system: ClimbGradeSystem;
  counts: Partial<Record<ClimbOutcome, number>>;
  total: number;
  climbs: PyramidClimb[];
};

export type PyramidColumn = {
  key: string;
  title: string;
  stat: string;
  boulderRows: PyramidColumnRow[];
  yosemiteRows: PyramidColumnRow[];
};

type Selection = {
  columnKey: string;
  system: ClimbGradeSystem;
  grade: string;
  outcome: ClimbOutcome | "ALL";
  caretPct: number;
};

export default function GradePyramid({ columns }: { columns: PyramidColumn[] }) {
  const [selected, setSelected] = useState<Selection | null>(null);

  function toggle(next: Selection) {
    setSelected((prev) =>
      prev &&
      prev.columnKey === next.columnKey &&
      prev.system === next.system &&
      prev.grade === next.grade &&
      prev.outcome === next.outcome
        ? null
        : next
    );
  }

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {columns.map((col) => (
        <div key={col.key} style={columnStyle}>
          <div style={columnHeaderStyle}>
            <span style={pyramidSubtitleStyle}>{col.title}</span>
            <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>{col.stat}</span>
          </div>
          <ColumnBars
            column={col}
            selected={selected}
            onToggle={toggle}
            onClose={() => setSelected(null)}
          />
        </div>
      ))}
    </div>
  );
}

function ColumnBars({
  column,
  selected,
  onToggle,
  onClose,
}: {
  column: PyramidColumn;
  selected: Selection | null;
  onToggle: (s: Selection) => void;
  onClose: () => void;
}) {
  const showBoth = column.boulderRows.length > 0 && column.yosemiteRows.length > 0;
  const maxTotal = Math.max(
    1,
    ...column.boulderRows.map((r) => r.total),
    ...column.yosemiteRows.map((r) => r.total)
  );

  const groups: Array<{ label: string; rows: PyramidColumnRow[] }> = [];
  if (column.boulderRows.length > 0) groups.push({ label: "Boulder", rows: column.boulderRows });
  if (column.yosemiteRows.length > 0)
    groups.push({ label: "Sport / Top rope", rows: column.yosemiteRows });

  return (
    <>
      {groups.map((g) => (
        <div key={g.label} style={{ display: "grid", gap: 4 }}>
          {showBoth ? <div style={pyramidSystemLabelStyle}>{g.label}</div> : null}
          {[...g.rows].reverse().map((row) => {
            const isOpen =
              selected !== null &&
              selected.columnKey === column.key &&
              selected.system === row.system &&
              selected.grade === row.grade;
            return (
              <div key={`${row.system}::${row.grade}`}>
                <PyramidBar
                  row={row}
                  maxTotal={maxTotal}
                  columnKey={column.key}
                  activeOutcome={isOpen ? selected.outcome : null}
                  onToggle={onToggle}
                />
                {isOpen ? (
                  <ClimbBubble
                    row={row}
                    outcome={selected.outcome}
                    caretPct={selected.caretPct}
                    onPickOutcome={(o) =>
                      onToggle({
                        columnKey: column.key,
                        system: row.system,
                        grade: row.grade,
                        outcome: o,
                        caretPct: selected.caretPct,
                      })
                    }
                    onClose={onClose}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function PyramidBar({
  row,
  maxTotal,
  columnKey,
  activeOutcome,
  onToggle,
}: {
  row: PyramidColumnRow;
  maxTotal: number;
  columnKey: string;
  activeOutcome: ClimbOutcome | "ALL" | null;
  onToggle: (s: Selection) => void;
}) {
  const barPct = (row.total / maxTotal) * 100;
  const segments = PYRAMID_OUTCOMES.map((o) => ({
    outcome: o as ClimbOutcome,
    count: row.counts[o as ClimbOutcome] ?? 0,
  })).filter((s) => s.count > 0);

  // Cumulative offsets so the bubble's caret points at the tapped segment.
  const widthOf = (count: number) => (count / row.total) * barPct;
  const placed = segments.map((s, i) => {
    const width = widthOf(s.count);
    const before = segments.slice(0, i).reduce((sum, p) => sum + widthOf(p.count), 0);
    return { ...s, width, centerPct: before + width / 2 };
  });

  function select(outcome: ClimbOutcome | "ALL", caretPct: number) {
    onToggle({ columnKey, system: row.system, grade: row.grade, outcome, caretPct });
  }

  return (
    <div style={pyramidRowStyle}>
      <button
        type="button"
        onClick={() => select("ALL", Math.min(barPct / 2, 50))}
        style={gradeButtonStyle}
        aria-label={`All ${row.total} climbs at ${row.grade}`}
      >
        {row.grade}
      </button>
      <div style={pyramidBarTrackStyle}>
        {placed.map(({ outcome, count, width, centerPct }) => (
          <button
            key={outcome}
            type="button"
            onClick={() => select(outcome, centerPct)}
            title={`${climbOutcomeLabel(outcome, row.system)} × ${count}`}
            aria-label={`${count} ${climbOutcomeLabel(outcome, row.system)} at ${row.grade}`}
            style={{
              width: `${width}%`,
              background: climbOutcomeColor(outcome),
              minWidth: 6,
              flexShrink: 0,
              border: "none",
              padding: 0,
              cursor: "pointer",
              touchAction: "manipulation",
              opacity: activeOutcome && activeOutcome !== outcome ? 0.45 : 1,
              transition: "opacity 0.12s",
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => select("ALL", Math.min(barPct / 2, 50))}
        style={totalButtonStyle}
        aria-label={`All ${row.total} climbs at ${row.grade}`}
      >
        {row.total}
      </button>
    </div>
  );
}

function ClimbBubble({
  row,
  outcome,
  caretPct,
  onPickOutcome,
  onClose,
}: {
  row: PyramidColumnRow;
  outcome: ClimbOutcome | "ALL";
  caretPct: number;
  onPickOutcome: (o: ClimbOutcome | "ALL") => void;
  onClose: () => void;
}) {
  const climbs = outcome === "ALL" ? row.climbs : row.climbs.filter((c) => c.outcome === outcome);
  const present = PYRAMID_OUTCOMES.map((o) => o as ClimbOutcome).filter(
    (o) => (row.counts[o] ?? 0) > 0
  );

  return (
    <div style={bubbleWrapStyle}>
      <span aria-hidden style={{ ...caretStyle, marginLeft: `calc(${caretPct}% - 5px)` }} />
      <div style={bubbleStyle}>
        <div style={bubbleHeadStyle}>
          <span style={{ fontSize: 12, fontWeight: 900 }}>
            {row.grade}
            <span style={{ opacity: 0.55, fontWeight: 700, marginLeft: 6 }}>
              {climbs.length} climb{climbs.length === 1 ? "" : "s"}
            </span>
          </span>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
            ✕
          </button>
        </div>

        {present.length > 1 ? (
          <div style={bubbleChipRowStyle}>
            <button
              type="button"
              onClick={() => onPickOutcome("ALL")}
              style={outcome === "ALL" ? bubbleChipOnStyle : bubbleChipStyle}
            >
              All
            </button>
            {present.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => onPickOutcome(o)}
                style={
                  outcome === o
                    ? { ...bubbleChipOnStyle, borderColor: climbOutcomeColor(o) }
                    : bubbleChipStyle
                }
              >
                <span style={{ ...dotStyle, background: climbOutcomeColor(o) }} />
                {climbOutcomeLabel(o, row.system)}
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 4 }}>
          {climbs.map((c) => (
            <div key={c.id} style={climbRowStyle}>
              <span style={{ ...dotStyle, background: climbOutcomeColor(c.outcome), marginTop: 5 }} />
              <div style={{ minWidth: 0, display: "grid", gap: 1 }}>
                <span style={climbNameStyle}>{c.name ?? "Unnamed climb"}</span>
                <span style={climbMetaStyle}>
                  {climbOutcomeLabel(c.outcome, row.system)}
                  {c.locationName ? ` · ${c.locationName}` : ""} · {c.dateLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const columnStyle: CSSProperties = {
  flex: "1 1 260px",
  minWidth: 0,
  display: "grid",
  gap: 8,
  alignContent: "start",
};
const columnHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  flexWrap: "wrap",
};
const pyramidSubtitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.6,
  textTransform: "uppercase",
};
const pyramidSystemLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.45,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
const pyramidRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr 28px",
  gap: 8,
  alignItems: "center",
};
// gap:1 puts a hairline seam between outcome segments so adjacent solid
// colors stay distinguishable.
const pyramidBarTrackStyle: CSSProperties = {
  display: "flex",
  gap: 1,
  height: 20,
  borderRadius: 5,
  background: "rgba(255,255,255,0.05)",
  overflow: "hidden",
};
const gradeButtonStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  textAlign: "right",
  opacity: 0.85,
  background: "none",
  border: "none",
  color: "inherit",
  padding: "6px 0",
  cursor: "pointer",
  touchAction: "manipulation",
};
const totalButtonStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.55,
  textAlign: "left",
  background: "none",
  border: "none",
  color: "inherit",
  padding: "6px 0",
  cursor: "pointer",
  touchAction: "manipulation",
};

const bubbleWrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr 28px",
  gap: 8,
  marginTop: 2,
  marginBottom: 6,
};
const caretStyle: CSSProperties = {
  gridColumn: 2,
  width: 10,
  height: 10,
  transform: "rotate(45deg)",
  background: "rgba(28,28,32,0.98)",
  borderLeft: "1px solid rgba(251,146,60,0.35)",
  borderTop: "1px solid rgba(251,146,60,0.35)",
  marginBottom: -6,
  position: "relative",
  zIndex: 1,
};
const bubbleStyle: CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(251,146,60,0.35)",
  background: "rgba(28,28,32,0.98)",
};
const bubbleHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};
const closeButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "inherit",
  opacity: 0.55,
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  padding: "2px 4px",
  touchAction: "manipulation",
};
const bubbleChipRowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const bubbleChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "4px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  cursor: "pointer",
  touchAction: "manipulation",
};
const bubbleChipOnStyle: CSSProperties = {
  ...bubbleChipStyle,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.15)",
  color: "rgba(191,219,254,0.98)",
};
const dotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  flexShrink: 0,
  display: "inline-block",
};
const climbRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  padding: "5px 0",
  borderTop: "1px solid rgba(255,255,255,0.06)",
};
const climbNameStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  lineHeight: 1.25,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const climbMetaStyle: CSSProperties = { fontSize: 10.5, fontWeight: 700, opacity: 0.6 };
