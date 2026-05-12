// Shared visual tokens for the v2 home page. Centralized so a designer change
// touches one place. All values match the dark navy palette in globals.css
// (--bg #0b1220 / --panel #111b2e) and the domain colors in lib/routines.ts.

import type { CSSProperties } from "react";

export const RADIUS = {
  card: 16,
  pill: 999,
  control: 12,
  cell: 6,
  inner: 10,
} as const;

export const COLOR = {
  bg: "#0b1220",
  panel: "#111b2e",
  panelRaised: "#162439",
  panelSoft: "rgba(255,255,255,0.025)",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "rgba(255,255,255,0.92)",
  textDim: "rgba(255,255,255,0.66)",
  textFaint: "rgba(255,255,255,0.42)",
  success: "#33ff7a",
  successSoft: "rgba(51,255,122,0.14)",
  amber: "rgba(251,191,36,0.95)",
  amberSoft: "rgba(251,191,36,0.16)",
  red: "rgba(248,113,113,0.95)",
  redSoft: "rgba(248,113,113,0.14)",
  blue: "rgba(96,165,250,0.95)",
  blueSoft: "rgba(96,165,250,0.14)",
} as const;

export const SHADOW = {
  card: "0 6px 18px rgba(0,0,0,0.22)",
  raised: "0 12px 32px rgba(0,0,0,0.32)",
  fab: "0 14px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(51,255,122,0.18)",
  popover: "0 22px 48px rgba(0,0,0,0.55)",
} as const;

export const SECTION_GAP = 18;

// Standard card surface — used by every panel on the home page. Sized so the
// border and shadow land just visible against the navy background without
// dominating the content.
export const cardSurface: CSSProperties = {
  background: COLOR.panel,
  border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.card,
  padding: 14,
  display: "grid",
  gap: 10,
};

export const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  minHeight: 18,
};

export const cardTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: COLOR.textDim,
};

export const cardHint: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textFaint,
};

// Generic "open detail" mini-link, used in popovers.
export const detailLink: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 11,
  fontWeight: 800,
  color: COLOR.success,
  textDecoration: "none",
  letterSpacing: 0.3,
};

// Domain → label used in row headers, sparkline labels.
export const DOMAIN_LABEL: Record<string, string> = {
  strength: "Strength",
  cardio: "Endurance",
  mobility: "Mobility",
  sport: "Sport",
  habit: "Habits",
  recovery: "Recovery",
};
