// Shared chrome for the /progressions surface. One module so restyling the
// ladder is a single edit — the Program builder's 247 scattered CSSProperties
// are the counterexample this exists to avoid. Form fields still come from
// form-ui (CLAUDE.md rule 3); this covers only page shell and ladder rows.

import type { CSSProperties } from "react";

export const ACCENT = "#33ff7a";
export const ACCENT_SOFT = "#7ce8aa";

export const page: CSSProperties = {
  width: "100%",
  minWidth: 0,
  maxWidth: "var(--app-width-content)",
  margin: "0 auto",
  padding: "16px var(--edge) 80px",
  boxSizing: "border-box",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 18,
};

export const topBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

export const backLink: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.6)",
  textDecoration: "none",
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
};

export const ctaLink: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: ACCENT_SOFT,
  textDecoration: "none",
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.1)",
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
};

export const title: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  margin: 0,
  color: "rgba(255,255,255,0.95)",
  lineHeight: 1.15,
};

export const subtitle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "rgba(255,255,255,0.6)",
  margin: 0,
};

export const card: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.022)",
  padding: "14px 16px",
  display: "grid",
  gap: 8,
  textDecoration: "none",
  color: "inherit",
};

export const cardGrid: CSSProperties = { display: "grid", gap: 12 };

export const cardTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "rgba(255,255,255,0.93)",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const nowLine: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.72)",
  lineHeight: 1.4,
};

export const nowTag: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: ACCENT,
  marginRight: 7,
};

export const countTag: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.4)",
  flexShrink: 0,
};

export const emptyCard: CSSProperties = {
  padding: "22px 18px",
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.02)",
  display: "grid",
  gap: 10,
  justifyItems: "start",
};

// Progress at a glance: one dot per rung, filled for done, ringed for the one
// you're on. Caps at 12 so a long ladder doesn't wrap the card header.
export function RungDots({ total, done }: { total: number; done: number }) {
  const shown = Math.min(total, 12);
  return (
    <span style={dotRow} aria-label={`${done} of ${total} done`}>
      {Array.from({ length: shown }, (_, i) => {
        const isDone = i < done;
        const isCurrent = i === done;
        return (
          <span
            key={i}
            style={{
              ...dot,
              background: isDone ? ACCENT : "transparent",
              borderColor: isDone || isCurrent ? ACCENT : "rgba(255,255,255,0.22)",
            }}
          />
        );
      })}
      {total > shown ? <span style={countTag}>+{total - shown}</span> : null}
    </span>
  );
}

const dotRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
};

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  border: "1.5px solid",
  boxSizing: "border-box",
};

// "Pull-up · with light band · 3x5" — the rung's full identity on one line.
export function rungText(label: string, modifier: string | null, targetText: string | null) {
  return [label, modifier, targetText].filter(Boolean).join(" · ");
}

// ── Ladder rows ───────────────────────────────────────────────────────────
// The rail column stretches the full row so the connector between nodes is
// continuous regardless of how tall the text wraps.

export function rungRow(isCurrent: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "28px minmax(0, 1fr)",
    gap: 10,
    alignItems: "stretch",
    padding: "2px 6px 2px 0",
    borderRadius: 10,
    background: isCurrent ? "rgba(51,255,122,0.055)" : "transparent",
  };
}

export const railCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  alignSelf: "stretch",
  minHeight: 44,
};

export const node: CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  border: "2px solid",
  boxSizing: "border-box",
  flexShrink: 0,
  marginTop: 11,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 120ms ease, border-color 120ms ease",
};

export const nodeCheck: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#04150a",
  lineHeight: 1,
};

export const rail: CSSProperties = {
  width: 2,
  flex: 1,
  minHeight: 6,
  marginTop: 4,
  borderRadius: 1,
};

export const rungTextCol: CSSProperties = {
  display: "grid",
  gap: 2,
  alignContent: "center",
  padding: "9px 0",
  minWidth: 0,
};

export function rungLabel(done: boolean, skipped: boolean, isCurrent: boolean): CSSProperties {
  return {
    fontSize: 14,
    fontWeight: isCurrent ? 900 : 700,
    lineHeight: 1.35,
    color: skipped
      ? "rgba(255,255,255,0.34)"
      : done
        ? "rgba(255,255,255,0.5)"
        : isCurrent
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.78)",
    textDecoration: skipped ? "line-through" : "none",
    display: "inline-flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    minWidth: 0,
  };
}

export const rungMeta: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.45)",
};

export const modifierChip: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  padding: "2px 8px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.62)",
  whiteSpace: "nowrap",
};

export const nowPill: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  padding: "2px 7px",
  borderRadius: 8,
  border: `1px solid ${ACCENT}`,
  color: ACCENT,
  whiteSpace: "nowrap",
};

export const rungError: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "#ff8f8f",
};

// ── Preset picker ─────────────────────────────────────────────────────────

export const presetGroupHeading: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.42)",
  margin: 0,
};

export const presetChain: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6,
};

export const presetChip: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 9px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.035)",
  color: "rgba(255,255,255,0.65)",
};

export const presetFoot: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginTop: 2,
};
