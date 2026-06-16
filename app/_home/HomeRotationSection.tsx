"use client";

// Home rotation card. Follows the injuries-section pattern: a persistent
// summary (next-up slot + a dot-per-slot progress strip) always visible,
// with a "Details" toggle that reveals the full slot list + recent history.
// The whole section is omitted upstream when there's no active rotation.

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type { HomeRotation } from "@/lib/home-rotation";

export default function HomeRotationSection({ rotation }: { rotation: HomeRotation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section style={card}>
      <button type="button" onClick={() => setExpanded((v) => !v)} style={headerBtn} aria-expanded={expanded}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={title}>Rotation</span>
          <span style={namePill}>{rotation.name}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={progressText}>
            {rotation.satisfiedCount}/{rotation.totalCount}
          </span>
          <span style={{ ...chevron, transform: expanded ? "rotate(180deg)" : "none" }} aria-hidden>▾</span>
        </span>
      </button>

      {/* Persistent summary: next-up line + dot-per-slot progress. */}
      <div style={summaryRow}>
        <div style={dotStrip} aria-hidden>
          {rotation.slots.map((s) => (
            <span
              key={s.id}
              style={{
                ...slotDot,
                background: s.satisfied ? "rgba(51,255,122,0.85)" : "rgba(255,255,255,0.10)",
                border: s.isNext ? "1.5px solid rgba(255,255,255,0.7)" : "1px solid rgba(255,255,255,0.12)",
              }}
              title={`${s.name}${s.satisfied ? " · done" : s.isNext ? " · next" : ""}`}
            />
          ))}
        </div>
        <div style={nextLine}>
          {rotation.roundComplete ? (
            <span style={{ color: "rgba(120,235,170,0.95)" }}>Round complete 🎉</span>
          ) : rotation.nextSlotName ? (
            <>
              <span style={nextLabel}>Next</span>
              <span style={nextName}>{rotation.nextSlotName}</span>
              {rotation.nextSlotDetail && rotation.nextSlotDetail !== rotation.nextSlotName ? (
                <span style={nextDetail}>· {rotation.nextSlotDetail}</span>
              ) : null}
            </>
          ) : (
            <span style={{ opacity: 0.6 }}>No next slot</span>
          )}
        </div>
      </div>

      {expanded ? (
        <div style={{ display: "grid", gap: 12 }}>
          {/* Full slot list */}
          <ul style={slotList}>
            {rotation.slots.map((s) => (
              <li key={s.id} style={{ ...slotRow, ...(s.isNext ? slotRowNext : null) }}>
                <span style={{ ...slotMark, color: s.satisfied ? "rgba(51,255,122,0.9)" : "rgba(255,255,255,0.3)" }}>
                  {s.satisfied ? "✓" : "○"}
                </span>
                <div style={{ display: "grid", gap: 1, minWidth: 0, flex: 1 }}>
                  <div style={slotName}>
                    {s.name}
                    {s.isNext ? <span style={nextTag}>next</span> : null}
                  </div>
                  {s.detail ? <div style={slotDetailText}>{s.detail}</div> : null}
                </div>
                {s.lastDoneLabel ? <span style={slotDate}>{s.lastDoneLabel}</span> : null}
              </li>
            ))}
          </ul>

          {/* Recent history */}
          {rotation.recent.length > 0 ? (
            <div style={{ display: "grid", gap: 5 }}>
              <div style={miniLabel}>Recent</div>
              <ul style={recentList}>
                {rotation.recent.map((r, i) => (
                  <li key={i} style={recentRow}>
                    <span style={recentDate}>{r.dateLabel}</span>
                    <span style={recentSlot}>{r.slotName}</span>
                    <span style={recentLabel}>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Link href="/plan" style={manageLink}>
            Manage rotation →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

// ── styles (card chrome matches HomeInjuriesSection / CollapsibleSection) ─────
const card: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 16,
  background: "rgba(255,255,255,0.028)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const headerBtn: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  background: "transparent",
  border: "none",
  margin: 0,
  padding: 0,
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  cursor: "pointer",
  color: "inherit",
  minHeight: 32,
};

const title: CSSProperties = { fontSize: 15, fontWeight: 900, letterSpacing: 0.2 };

const namePill: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "rgba(255,255,255,0.7)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 160,
};

const progressText: CSSProperties = { fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.7)" };

const chevron: CSSProperties = { fontSize: 11, color: "rgba(255,255,255,0.6)", transition: "transform 160ms ease" };

const summaryRow: CSSProperties = {
  display: "grid",
  gap: 8,
};

const dotStrip: CSSProperties = {
  display: "flex",
  gap: 5,
  flexWrap: "wrap",
};

const slotDot: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 5,
  flexShrink: 0,
};

const nextLine: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 800,
  minWidth: 0,
  flexWrap: "wrap",
};

const nextLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
};

const nextName: CSSProperties = { color: "rgba(255,255,255,0.92)" };
const nextDetail: CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.55 };

const slotList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 4,
};

const slotRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.015)",
};

const slotRowNext: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.04)",
};

const slotMark: CSSProperties = { fontSize: 14, fontWeight: 900, flexShrink: 0, width: 16, textAlign: "center" };

const slotName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  display: "flex",
  alignItems: "center",
  gap: 6,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const nextTag: CSSProperties = {
  fontSize: 8.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "1px 6px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.7)",
};

const slotDetailText: CSSProperties = { fontSize: 11, opacity: 0.55, fontWeight: 700 };
const slotDate: CSSProperties = { fontSize: 10.5, fontWeight: 800, opacity: 0.5, flexShrink: 0 };

const miniLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
};

const recentList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 3,
};

const recentRow: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  fontSize: 11.5,
};

const recentDate: CSSProperties = { fontWeight: 800, opacity: 0.5, flexShrink: 0, minWidth: 42 };
const recentSlot: CSSProperties = { fontWeight: 800, opacity: 0.85, flexShrink: 0 };
const recentLabel: CSSProperties = {
  opacity: 0.6,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const manageLink: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(132,204,255,0.9)",
  textDecoration: "none",
  justifySelf: "start",
};
