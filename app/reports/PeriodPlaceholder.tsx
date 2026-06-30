import type { CSSProperties } from "react";
import type { Period } from "@/lib/reports/period";

// Phase 1 stand-in for the month/year reports. The shell (tabs + stepper)
// already works for every kind; this fills the body until Phase 2 ships the
// real month/year content.
export default function PeriodPlaceholder({ period }: { period: Period }) {
  return (
    <section style={panel}>
      <div style={panelHeader}>{period.label.toUpperCase()}</div>
      <div style={emptyBody}>
        The {period.kind} report is coming next. The week report is live — switch to the Week tab above.
      </div>
    </section>
  );
}

const panel: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const panelHeader: CSSProperties = {
  padding: "8px 16px",
  background: "rgba(128,128,128,0.11)",
  borderBottom: "1px solid rgba(128,128,128,0.2)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
};

const emptyBody: CSSProperties = {
  padding: 18,
  fontSize: 13,
  color: "rgba(255,255,255,0.6)",
  fontStyle: "italic",
};
