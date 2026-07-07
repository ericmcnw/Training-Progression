"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

// Inline finder for the strength page — search ANY exercise or routine
// (not just the top-8 cards) without leaving for /exercises. Typing
// filters both lists; a result links to the exercise detail page
// (per-lift progression charts) or the routine page.

export type SearchItem = {
  id: string;
  name: string;
  href: string;
  /** Small right-aligned context ("29 sessions · top 45 lb"). */
  meta: string;
};

export default function StrengthSearch({
  exercises,
  routines,
  accentRgb,
}: {
  exercises: SearchItem[];
  routines: SearchItem[];
  accentRgb: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (q === "") return null;
    const filter = (items: SearchItem[]) =>
      items.filter((item) => item.name.toLowerCase().includes(q)).slice(0, 8);
    return { exercises: filter(exercises), routines: filter(routines) };
  }, [q, exercises, routines]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        type="search"
        placeholder="Search your exercises & routines…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={inputStyle}
        aria-label="Search exercises and routines"
      />
      {matches ? (
        matches.exercises.length === 0 && matches.routines.length === 0 ? (
          <div style={emptyStyle}>No matches. Try a shorter fragment — “curl”, “RDL”, “press”.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {matches.exercises.length > 0 ? (
              <ResultGroup label="Exercises" items={matches.exercises} accentRgb={accentRgb} />
            ) : null}
            {matches.routines.length > 0 ? (
              <ResultGroup label="Routines" items={matches.routines} accentRgb={accentRgb} />
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

function ResultGroup({ label, items, accentRgb }: { label: string; items: SearchItem[]; accentRgb: string }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={groupLabelStyle}>{label}</div>
      {items.map((item) => (
        <Link key={item.id} href={item.href} style={{ ...rowStyle, borderColor: `rgba(${accentRgb},0.22)` }}>
          <span style={rowNameStyle}>{item.name}</span>
          <span style={rowMetaStyle}>{item.meta}</span>
          <span style={rowCaretStyle}>›</span>
        </Link>
      ))}
    </div>
  );
}

// 16px font — iOS Safari focus-zoom guard.
const inputStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid rgba(128,128,128,0.6)",
  borderRadius: 12,
  background: "#111827",
  color: "#ffffff",
  fontSize: 16,
};

const emptyStyle: CSSProperties = { fontSize: 12.5, opacity: 0.6, fontWeight: 600, fontStyle: "italic" };

const groupLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  textDecoration: "none",
  minHeight: 44,
};

const rowNameStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: 13.5,
  fontWeight: 800,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowMetaStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.6,
  whiteSpace: "nowrap",
};

const rowCaretStyle: CSSProperties = { fontSize: 14, opacity: 0.4, fontWeight: 700, flexShrink: 0 };
