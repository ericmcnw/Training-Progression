"use client";

// Backpacking entry in the ENDURANCE section on /log. Mirrors EnduranceQuickLogRow
// visually, but opens the dedicated multi-day trip sheet directly (backpacking
// is an endurance pursuit with its own rich, per-day form rather than the
// standard cardio log).

import { useState, type CSSProperties } from "react";
import BackpackingLogSheet from "./BackpackingLogSheet";
import { domainColor } from "@/lib/routines";

export default function BackpackingQuickLogRow() {
  const [open, setOpen] = useState(false);
  const accent = domainColor("cardio");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ ...rowStyle, borderLeft: `3px solid ${accent}` }}
      >
        <span style={textCol}>
          <span style={rowLabel}>🎒 Backpacking</span>
          <span style={rowEyebrow}>Multi-day trip · per-day miles + gear</span>
        </span>
        <span style={rowAction}>Log →</span>
      </button>
      {open ? <BackpackingLogSheet onClose={() => setOpen(false)} /> : null}
    </>
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
