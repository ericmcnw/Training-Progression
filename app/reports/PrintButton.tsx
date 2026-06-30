"use client";

import type { CSSProperties } from "react";

// Triggers the browser print dialog → "Save as PDF" on desktop and iOS
// (share → print). The report's print CSS (ReportShell) forces drawers open,
// hides nav chrome, and keeps colors faithful.
export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} style={btn}>
      ⎙ Print / PDF
    </button>
  );
}

const btn: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.24)",
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
  minHeight: 40,
};
