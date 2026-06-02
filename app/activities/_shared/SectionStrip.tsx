import type { ReactNode } from "react";

// Thin label divider used inside an expanded FamilySection to separate
// "Top activities" from "Top routines". Just a tiny uppercase eyebrow
// over the rows it groups.
export default function SectionStrip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 0.7,
          textTransform: "uppercase",
          opacity: 0.5,
          paddingLeft: 4,
        }}
      >
        {label}
      </div>
      <div style={{ display: "grid", gap: 4 }}>{children}</div>
    </div>
  );
}
