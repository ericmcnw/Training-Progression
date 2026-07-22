"use client";

// Mark time away — a multi-day span (vacation / travel / sick / rest) that
// draws a band across the Plan calendar and the Home Week-at-a-Glance,
// explaining a dip in activity. Lives on the Plan page's Schedule section.
// The form itself is the shared TripEditorPopover (also used for editing an
// existing trip from the calendar band + WaG).

import { useState, type CSSProperties } from "react";
import TripEditorPopover from "@/app/_home/TripEditorPopover";

export default function MarkTimeAwayButton({ today, style }: { today: string; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ ...triggerBtn, ...style }}>
        🏖️ Mark time away
      </button>
      {open ? <TripEditorPopover open onClose={() => setOpen(false)} today={today} /> : null}
    </>
  );
}

const triggerBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(251,191,36,0.40)",
  background: "rgba(251,191,36,0.10)",
  color: "rgba(253,224,140,0.95)",
  fontSize: 12.5,
  fontWeight: 800,
  letterSpacing: 0.2,
  cursor: "pointer",
  minHeight: 36,
  lineHeight: 1,
  whiteSpace: "nowrap",
};
