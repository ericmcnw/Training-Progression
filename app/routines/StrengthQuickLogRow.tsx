"use client";

// Strength's counterpart to EnduranceQuickLogRow: logs a workout without a
// saved routine. Shown when the STRENGTH section has no routines, so a new
// user isn't forced to build a template before logging their first lift.

import type { CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { QUICK_LOG_ROUTINE_ID } from "@/app/components/LogDrawer";
import { domainColor } from "@/lib/routines";

export default function StrengthQuickLogRow() {
  const { openDrawer } = useLogDrawer();
  const accent = domainColor("strength");
  return (
    <button
      type="button"
      onClick={() => openDrawer(QUICK_LOG_ROUTINE_ID)}
      style={{ ...rowStyle, borderLeft: `3px solid ${accent}` }}
    >
      <span style={textCol}>
        <span style={rowLabel}>Workout</span>
        <span style={rowEyebrow}>Pick exercises as you go · no routine needed</span>
      </span>
      <span style={rowAction}>Log →</span>
    </button>
  );
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "rgba(128,128,128,0.05)",
  color: "inherit",
  cursor: "pointer",
  textAlign: "left",
  minHeight: 52,
  width: "100%",
};
const textCol: CSSProperties = { display: "grid", gap: 2, minWidth: 0 };
const rowLabel: CSSProperties = { fontSize: 14, fontWeight: 900, lineHeight: 1.2 };
const rowEyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};
const rowAction: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.7,
  whiteSpace: "nowrap",
};
