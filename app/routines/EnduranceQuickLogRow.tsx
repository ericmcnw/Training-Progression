"use client";

// Endurance entry tile in the ENDURANCE section on /log. Mirrors a
// SportQuickLogRow visually, but there's one endurance entry (not per-type
// tiles): tapping opens the LogDrawer against the synthetic Endurance routine,
// where the activity type (Run / Walk / Bike / …) is picked via dropdown in
// the form. Kept available even with zero cardio-domain routines, since the
// legacy per-type routines were retired.

import type { CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { SYNTHETIC_ENDURANCE_ROUTINE_ID } from "@/lib/activity-types";
import { domainColor } from "@/lib/routines";

export default function EnduranceQuickLogRow() {
  const { openDrawer } = useLogDrawer();
  const accent = domainColor("cardio");
  return (
    <button
      type="button"
      onClick={() => openDrawer(SYNTHETIC_ENDURANCE_ROUTINE_ID)}
      style={{ ...rowStyle, borderLeft: `3px solid ${accent}` }}
    >
      <span style={textCol}>
        <span style={rowLabel}>Endurance</span>
        <span style={rowEyebrow}>Run · Walk · Bike · Swim · Row · Hike</span>
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
