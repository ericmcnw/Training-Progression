"use client";

import type { PainContext } from "@/generated/prisma";

export type PainCheckZone = { slug: string; label: string };

export default function InlinePainCheck({
  zones,
  levels,
  onLevelsChange,
  context,
  onContextChange,
}: {
  zones: PainCheckZone[];
  levels: Record<string, number>;
  onLevelsChange: (next: Record<string, number>) => void;
  context: PainContext;
  onContextChange: (next: PainContext) => void;
}) {
  if (zones.length === 0) return null;
  const labelSummary = zones.map((zone) => zone.label).join(", ");

  return (
    <details style={cardStyle}>
      <summary data-collapsible-summary style={summaryStyle}>
        <span style={{ fontSize: 13, fontWeight: 900 }}>Pain check</span>
        <span style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>
          Log a level if any of these flared: {labelSummary} — otherwise leave blank.
        </span>
      </summary>
      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>When did it hurt?</span>
          <select
            value={context}
            onChange={(event) => onContextChange(event.target.value as PainContext)}
            style={{ maxWidth: 240, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(128,128,128,0.45)", background: "rgba(128,128,128,0.08)", color: "inherit" }}
          >
            <option value="AFTER_ACTIVITY">After activity</option>
            <option value="DURING_ACTIVITY">During activity</option>
            <option value="AT_REST">At rest</option>
            <option value="GENERAL">General</option>
          </select>
        </label>
        <div style={{ display: "grid", gap: 10 }}>
          {zones.map((zone) => {
            const level = levels[zone.slug] ?? 0;
            return (
              <label key={zone.slug} style={{ display: "grid", gap: 6 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 800, fontSize: 13 }}>
                  {zone.label}
                  <span style={{ opacity: level > 0 ? 1 : 0.5 }}>{level}/10</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={level}
                  onChange={(event) => onLevelsChange({ ...levels, [zone.slug]: Number(event.target.value) })}
                  style={{ width: "100%", accentColor: "#F87171", minHeight: 36 }}
                />
              </label>
            );
          })}
        </div>
      </div>
    </details>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(248,113,113,0.28)",
  borderRadius: 14,
  background: "rgba(248,113,113,0.06)",
  padding: 12,
};

const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
