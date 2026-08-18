"use client";

// Dashboard Focus band — the strategic layer. One card per active focus:
// name + icon, milestone progress, and the current aim(s) ("what I'm working
// on right now"). Taps through to the focus detail page. Collapsible, matching
// the other home sections. Responsive: cards stack on mobile, flow 2-up on
// wide screens via a min-width grid.

import Link from "next/link";
import type { CSSProperties } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { COLOR, withAlpha } from "./tokens";
import { seasonPhaseLabel, type FocusBandItem } from "@/app/focus/shared";

export default function HomeFocusSection({ focuses }: { focuses: FocusBandItem[] }) {
  if (focuses.length === 0) return null;

  return (
    <CollapsibleSection
      title="Programs"
      count={focuses.length}
      countTone="accent"
      hint="tap a program"
      storageKey="home:focus:open"
      defaultOpen
    >
      <div style={grid}>
        {focuses.map((f) => (
          <FocusCard key={f.id} focus={f} />
        ))}
      </div>
      <Link href="/programs" style={newLink}>All programs →</Link>
    </CollapsibleSection>
  );
}

function FocusCard({ focus }: { focus: FocusBandItem }) {
  const accent = focus.color?.trim() || COLOR.success;
  const pct =
    focus.milestonesTotal > 0
      ? Math.round((focus.milestonesDone / focus.milestonesTotal) * 100)
      : 0;

  return (
    <Link href={`/programs/${focus.id}`} style={{ ...cardShell, borderColor: withAlpha(accent, 0.28) }}>
      <div style={topRow}>
        <span style={nameWrap}>
          {focus.icon ? <span aria-hidden style={iconStyle}>{focus.icon}</span> : null}
          <span style={nameStyle}>{focus.name}</span>
        </span>
        {focus.milestonesTotal > 0 ? (
          <span style={{ ...progressPill, color: accent, borderColor: withAlpha(accent, 0.35), background: withAlpha(accent, 0.12) }}>
            {focus.milestonesDone}/{focus.milestonesTotal}
          </span>
        ) : null}
      </div>

      {seasonPhaseLabel(focus.season, focus.phase) ? (
        <span style={{ ...seasonChip, color: withAlpha(accent, 0.95), borderColor: withAlpha(accent, 0.3) }}>
          {seasonPhaseLabel(focus.season, focus.phase)}
        </span>
      ) : null}

      {focus.milestonesTotal > 0 ? (
        <div style={track} aria-hidden>
          <div style={{ ...trackFill, width: `${pct}%`, background: accent }} />
        </div>
      ) : null}

      {focus.currentAims.length > 0 ? (
        <div style={aimsWrap}>
          {focus.currentAims.slice(0, 3).map((aim, i) => (
            <span key={i} style={aimChip}>
              <span aria-hidden style={{ ...aimDot, background: accent }} />
              {aim}
            </span>
          ))}
          {focus.currentAims.length > 3 ? (
            <span style={moreAims}>+{focus.currentAims.length - 3}</span>
          ) : null}
        </div>
      ) : (
        <span style={emptyAim}>No active milestones — tap to plan</span>
      )}
    </Link>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

// Auto-fit grid: single column on phones, two columns once there's room.
const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
};

const cardShell: CSSProperties = {
  display: "grid",
  gap: 9,
  padding: "12px 13px",
  borderRadius: 13,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.022)",
  textDecoration: "none",
  color: "inherit",
};

const topRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const nameWrap: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const iconStyle: CSSProperties = { fontSize: 16, lineHeight: 1, flexShrink: 0 };

const seasonChip: CSSProperties = {
  justifySelf: "start",
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid",
  background: "rgba(255,255,255,0.03)",
};

const nameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const progressPill: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid transparent",
  flexShrink: 0,
};

const track: CSSProperties = {
  height: 5,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const trackFill: CSSProperties = {
  height: "100%",
  borderRadius: 999,
  transition: "width 220ms ease",
};

const aimsWrap: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const aimChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  maxWidth: "100%",
  fontSize: 11.5,
  fontWeight: 700,
  color: COLOR.textDim,
  padding: "3px 9px 3px 7px",
  borderRadius: 999,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const aimDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 999,
  flexShrink: 0,
};

const moreAims: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: COLOR.textFaint,
  alignSelf: "center",
};

const emptyAim: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: COLOR.textFaint,
  fontStyle: "italic",
};

const newLink: CSSProperties = {
  justifySelf: "start",
  fontSize: 12,
  fontWeight: 800,
  color: COLOR.textDim,
  textDecoration: "none",
  padding: "6px 12px",
  borderRadius: 9,
  border: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.03)",
};
