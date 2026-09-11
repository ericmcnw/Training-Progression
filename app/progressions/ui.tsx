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
    gridTemplateColumns: "28px minmax(0, 1fr) auto",
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
  textAlign: "left",
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

// ── Edit in place ─────────────────────────────────────────────────────────
// Only one row is ever in this state, so the rest of the ladder stays
// readable while you work on a step.

export const editGrid: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "8px 0 10px",
  minWidth: 0,
};

export const editRowInline: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 8,
};

export const editBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

export const editBarLeft: CSSProperties = { display: "flex", alignItems: "center", gap: 6 };

export const iconBtn: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  minWidth: 44,
  minHeight: 44,
  padding: 0,
  color: "rgba(255,255,255,0.62)",
};

export const doneBtn: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: ACCENT_SOFT,
  padding: "10px 18px",
  border: "1px solid rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.1)",
};

export const addStepBtn: CSSProperties = {
  justifySelf: "start",
  marginTop: 8,
  marginLeft: 38,
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.62)",
  background: "transparent",
  border: "1px dashed rgba(255,255,255,0.2)",
};

export const untitledLabel: CSSProperties = {
  color: "rgba(255,255,255,0.34)",
  fontStyle: "italic",
  fontWeight: 700,
};

export const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  justifyContent: "space-between",
  minWidth: 0,
};

export const titleButton: CSSProperties = {
  padding: 0,
  minHeight: 0,
  textAlign: "left",
  minWidth: 0,
  flex: 1,
};

export const blankCard: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.022)",
  padding: "14px 16px",
  display: "grid",
  gap: 8,
};

export const blankLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  color: "rgba(255,255,255,0.62)",
};

export const blankRow: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

export const headerActions: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

export const dangerAction: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 14px",
  minHeight: 40,
  borderRadius: 10,
  color: "#ff9b9b",
  background: "rgba(255,120,120,0.07)",
  borderColor: "rgba(255,120,120,0.3)",
};

export const searchWrap: CSSProperties = { display: "grid" };

export const buildOwnBtn: CSSProperties = {
  width: "100%",
  fontSize: 14,
  fontWeight: 900,
  color: ACCENT_SOFT,
  padding: "14px 16px",
  border: "1px solid rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.1)",
};

export const noMatch: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "rgba(255,255,255,0.55)",
  margin: 0,
  padding: "18px 4px",
};

// The name is a field, not a heading with an edit button behind it. Borderless
// until focused so it still reads as a title.
export const titleInput: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.2,
  color: "rgba(255,255,255,0.95)",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 10,
  padding: "6px 8px",
  margin: "0 -8px",
  width: "calc(100% + 16px)",
  minWidth: 0,
  boxSizing: "border-box",
};

// Shared by a Link and a button side by side, so both have to be styled
// explicitly — the global button rule would otherwise only hit one of them.
export const textAction: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 14px",
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.72)",
  textDecoration: "none",
};

export const cardFoot: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  paddingTop: 10,
  marginTop: 2,
};

export const readyPill: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  padding: "2px 7px",
  borderRadius: 8,
  border: "1px solid rgba(120,200,255,0.55)",
  color: "#8ecbff",
  whiteSpace: "nowrap",
};

export const measureRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

export const unitTag: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(255,255,255,0.55)",
};

export const bestLine: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "rgba(255,255,255,0.38)",
};

// ── Exercise picker ───────────────────────────────────────────────────────

export const pickerWrap: CSSProperties = { display: "grid", gap: 6, minWidth: 0 };

export const pickerResults: CSSProperties = {
  display: "grid",
  gap: 2,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  background: "rgba(12,14,16,0.9)",
  padding: 4,
  maxHeight: 240,
  overflowY: "auto",
};

export const pickerRow: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textAlign: "left",
  padding: "10px 10px",
  minHeight: 44,
  borderRadius: 8,
  border: "1px solid transparent",
  background: "transparent",
  color: "rgba(255,255,255,0.82)",
  width: "100%",
};

export const pickerChip: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  justifyContent: "space-between",
  padding: "9px 8px 9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.35)",
  background: "rgba(51,255,122,0.08)",
  minWidth: 0,
};

export const pickerChipName: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: ACCENT_SOFT,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const pickerClear: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  minWidth: 40,
  minHeight: 40,
  padding: 0,
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.55)",
};

export const pickerHint: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.45)",
};

// ── Inline exercise create ────────────────────────────────────────────────

export const createBox: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "12px",
  borderRadius: 10,
  border: "1px dashed rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.025)",
};

export const createTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "rgba(255,255,255,0.6)",
};

export const createLine: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "rgba(255,255,255,0.8)",
  overflowWrap: "anywhere",
};

export const toggleGroup: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

export function toggleChip(on: boolean): CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 12px",
    minHeight: 40,
    borderRadius: 9,
    border: `1px solid ${on ? "rgba(51,255,122,0.45)" : "rgba(255,255,255,0.16)"}`,
    background: on ? "rgba(51,255,122,0.1)" : "rgba(255,255,255,0.03)",
    color: on ? ACCENT_SOFT : "rgba(255,255,255,0.6)",
  };
}

export const createBtn: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.12)",
  color: ACCENT_SOFT,
  textAlign: "left",
  overflowWrap: "anywhere",
};

// Sits in the row's third column so it is a sibling of the text button, not
// nested inside it — a link inside a button is invalid and unclickable.
export const dataLink: CSSProperties = {
  alignSelf: "center",
  fontSize: 11,
  fontWeight: 800,
  padding: "8px 10px",
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 9,
  color: "rgba(255,255,255,0.45)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
