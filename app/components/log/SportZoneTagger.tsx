"use client";

import { useState, useTransition } from "react";
import BodyMap from "@/app/components/body-map/BodyMap";
import { addSportZoneActivities } from "@/app/body/actions";
import type { ZoneState } from "@/app/components/body-map/types";

type ZoneOption = { slug: string; label: string };

export default function SportZoneTagger({
  zones,
  routineLogId,
  label,
  onDone,
}: {
  zones: ZoneOption[];
  routineLogId: string;
  label: string;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [intensity, setIntensity] = useState("");
  const [pending, startTransition] = useTransition();
  const mapZones: ZoneState[] = zones.map((zone) => ({
    slug: zone.slug,
    freshness: selected.includes(zone.slug) ? "WORKED_TODAY" : "FRESH",
  }));

  function submit() {
    startTransition(async () => {
      if (selected.length > 0) {
        await addSportZoneActivities({ routineLogId, zoneSlugs: selected, label, intensity: intensity || null });
      }
      onDone();
    });
  }

  return (
    <div style={card}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 900 }}>What got worked?</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.68)", marginTop: 4 }}>Tag the zones this session loaded, or skip.</div>
      </div>
      <BodyMap
        zones={mapZones}
        selectable
        selectedSlugs={selected}
        onZoneClick={(slug) => setSelected((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]))}
        size="md"
      />
      <select value={intensity} onChange={(event) => setIntensity(event.target.value)} style={{ maxWidth: 220 }}>
        <option value="">Intensity optional</option>
        <option value="easy">Easy</option>
        <option value="moderate">Moderate</option>
        <option value="hard">Hard</option>
      </select>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={pending} onClick={onDone} style={{ borderRadius: 8 }}>
          Skip
        </button>
        <button type="button" disabled={pending} onClick={submit} style={{ borderRadius: 8 }}>
          {pending ? "Saving..." : "Save zones"}
        </button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid rgba(96,165,250,0.28)",
  borderRadius: 16,
  background: "rgba(96,165,250,0.08)",
  padding: 14,
  display: "grid",
  gap: 12,
};
