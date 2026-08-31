"use client";

import Link from "next/link";
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
  locationId: string | null;
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
              minWidth: 4,
              flexShrink: 0,
              // Buttons carry a UA border-radius; the track owns the rounding.
              appearance: "none",
              borderRadius: 0,
              border: "none",
              padding: 0,
              margin: 0,
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
  onClose,
}: {
  row: PyramidColumnRow;
  outcome: ClimbOutcome | "ALL";
  caretPct: number;
  onClose: () => void;
}) {
  const climbs = outcome === "ALL" ? row.climbs : row.climbs.filter((c) => c.outcome === outcome);

  return (
    <div style={bubbleWrapStyle}>
      <span aria-hidden style={{ ...caretStyle, marginLeft: `calc(${caretPct}% - 5px)` }} />
      <div style={bubbleStyle}>
        <div style={bubbleHeadStyle}>
          <span style={{ fontSize: 11, fontWeight: 900 }}>
            {row.grade}
            <span style={{ opacity: 0.55, fontWeight: 700, marginLeft: 5 }}>
              {outcome === "ALL" ? "all" : climbOutcomeLabel(outcome, row.system).toLowerCase()} ·{" "}
              {climbs.length}
            </span>
          </span>
          <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={{ display: "grid" }}>
          {climbs.map((c) => (
            <ClimbLink key={c.id} climb={c} system={row.system} grade={row.grade} />
          ))}
        </div>
      </div>
    </div>
  );
}

// A named climb goes to the location that holds it; an unnamed one has no
// destination of its own, so it falls back to the climb list at that grade.
function ClimbLink({
  climb,
  system,
  grade,
}: {
  climb: PyramidClimb;
  system: ClimbGradeSystem;
  grade: string;
}) {
  const href = climb.locationId
    ? `/activities/climbing/locations/${climb.locationId}`
    : `/activities/climbing/climbs?grade=${encodeURIComponent(grade)}&range=all`;
  return (
    <Link href={href} style={climbRowStyle}>
      <span style={{ ...dotStyle, background: climbOutcomeColor(climb.outcome), marginTop: 4 }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={climbNameStyle}>{climb.name ?? "Unnamed climb"}</span>
        <span style={climbMetaStyle}>
          {climbOutcomeLabel(climb.outcome, system)}
          {climb.locationName ? ` · ${climb.locationName}` : ""} · {climb.dateLabel}
        </span>
      </span>
      <span style={chevronStyle} aria-hidden>
        ›
      </span>
    </Link>
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
// Height matches the bar track so the button gives a full-height tap target
// without making the row taller than the span it replaced.
const cellButtonReset: CSSProperties = {
  appearance: "none",
  background: "none",
  border: "none",
  borderRadius: 0,
  color: "inherit",
  padding: 0,
  margin: 0,
  height: 20,
  cursor: "pointer",
  touchAction: "manipulation",
};
const gradeButtonStyle: CSSProperties = {
  ...cellButtonReset,
  fontSize: 12,
  fontWeight: 900,
  textAlign: "right",
  opacity: 0.85,
};
const totalButtonStyle: CSSProperties = {
  ...cellButtonReset,
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.55,
  textAlign: "left",
};

const bubbleWrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr 28px",
  gap: 8,
  marginTop: 2,
  marginBottom: 4,
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
  gap: 3,
  padding: "6px 9px",
  borderRadius: 8,
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
  appearance: "none",
  background: "none",
  border: "none",
  borderRadius: 0,
  color: "inherit",
  opacity: 0.55,
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  padding: 0,
  margin: 0,
  height: 16,
  touchAction: "manipulation",
};
const dotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0,
  display: "inline-block",
};
const climbRowStyle: CSSProperties = {
  display: "flex",
  gap: 7,
  alignItems: "flex-start",
  padding: "3px 0",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  color: "inherit",
  textDecoration: "none",
  touchAction: "manipulation",
};
const climbNameStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const climbMetaStyle: CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 700,
  opacity: 0.6,
  lineHeight: 1.3,
};
const chevronStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  opacity: 0.35,
  flexShrink: 0,
  lineHeight: 1,
};
