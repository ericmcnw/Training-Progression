"use client";

import { useMemo } from "react";
import BodyMap from "@/app/components/body-map/BodyMap";
import type { ZoneState } from "@/app/components/body-map/types";

export type LoggableZone = { slug: string; label: string };

export default function InlineMusclesWorked({
  availableZones,
  defaultSlugs,
  selectedSlugs,
  onSelectedSlugsChange,
  intensity,
  onIntensityChange,
}: {
  availableZones: LoggableZone[];
  defaultSlugs: string[];
  selectedSlugs: string[];
  onSelectedSlugsChange: (slugs: string[]) => void;
  intensity: string;
  onIntensityChange: (value: string) => void;
}) {
  const defaultSet = useMemo(() => new Set(defaultSlugs), [defaultSlugs]);
  const labelBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const zone of availableZones) map.set(zone.slug, zone.label);
    return map;
  }, [availableZones]);

  const summary = useMemo(() => {
    if (defaultSlugs.length === 0) return "Tap to tag muscles worked";
    const labels = defaultSlugs
      .map((slug) => labelBySlug.get(slug))
      .filter((value): value is string => Boolean(value));
    // Deduplicate by region so "Left Bicep" + "Right Bicep" collapses to "Biceps".
    const seen = new Set<string>();
    const collapsed: string[] = [];
    for (const raw of labels) {
      const stripped = raw.replace(/^(Left|Right)\s+/i, "").trim();
      if (!seen.has(stripped)) {
        seen.add(stripped);
        collapsed.push(stripped);
      }
    }
    return collapsed.join(", ");
  }, [defaultSlugs, labelBySlug]);

  const mapZones: ZoneState[] = availableZones.map((zone) => ({
    slug: zone.slug,
    freshness: selectedSlugs.includes(zone.slug) ? "WORKED_TODAY" : "FRESH",
  }));

  function toggle(slug: string) {
    if (selectedSlugs.includes(slug)) onSelectedSlugsChange(selectedSlugs.filter((s) => s !== slug));
    else onSelectedSlugsChange([...selectedSlugs, slug]);
  }

  function resetToDefaults() {
    onSelectedSlugsChange(Array.from(defaultSet));
  }

  function clearAll() {
    onSelectedSlugsChange([]);
  }

  return (
    <details style={cardStyle}>
      <summary data-collapsible-summary style={summaryStyle}>
        <span style={{ fontSize: 13, fontWeight: 900 }}>Adjust Muscles Worked</span>
        <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 700 }}>
          Default: {summary}
        </span>
      </summary>
      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        <BodyMap
          zones={mapZones}
          selectable
          selectedSlugs={selectedSlugs}
          onZoneClick={toggle}
          size="md"
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={resetToDefaults} style={pillBtnStyle}>Reset to default</button>
          <button type="button" onClick={clearAll} style={pillBtnStyle}>Clear all</button>
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.75 }}>Intensity (optional)</span>
          <select
            value={intensity}
            onChange={(event) => onIntensityChange(event.target.value)}
            style={{ maxWidth: 220, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(128,128,128,0.45)", background: "rgba(128,128,128,0.08)", color: "inherit" }}
          >
            <option value="">—</option>
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="hard">Hard</option>
          </select>
        </label>
      </div>
    </details>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(96,165,250,0.28)",
  borderRadius: 14,
  background: "rgba(96,165,250,0.06)",
  padding: 12,
};

const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const pillBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(128,128,128,0.45)",
  background: "rgba(128,128,128,0.1)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};
