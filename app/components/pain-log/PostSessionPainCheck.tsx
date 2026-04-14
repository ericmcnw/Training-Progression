"use client";

import { useState, useTransition } from "react";
import { logPain } from "@/app/body/actions";
import type { PainContext } from "@/generated/prisma";

export type PainCheckZone = {
  slug: string;
  label: string;
};

export default function PostSessionPainCheck({
  zones,
  routineLogId,
  onDone,
}: {
  zones: PainCheckZone[];
  routineLogId: string;
  onDone: () => void;
}) {
  const [levels, setLevels] = useState<Record<string, number>>(() => Object.fromEntries(zones.map((zone) => [zone.slug, 0])));
  const [context, setContext] = useState<PainContext>("AFTER_ACTIVITY");
  const [pending, startTransition] = useTransition();

  if (zones.length === 0) return null;

  function submit() {
    startTransition(async () => {
      const rows = zones
        .filter((zone) => (levels[zone.slug] ?? 0) > 0)
        .map((zone) => ({
          zoneSlug: zone.slug,
          level: levels[zone.slug] ?? 0,
          context,
          routineLogId,
        }));
      if (rows.length > 0) await logPain(rows);
      onDone();
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Quick pain check</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.68)" }}>Log anything that changed after this session.</div>
      </div>
      <select value={context} onChange={(event) => setContext(event.target.value as PainContext)} style={{ maxWidth: 240 }}>
        <option value="AFTER_ACTIVITY">After activity</option>
        <option value="DURING_ACTIVITY">During activity</option>
        <option value="AT_REST">At rest</option>
        <option value="GENERAL">General</option>
      </select>
      <div style={{ display: "grid", gap: 10 }}>
        {zones.map((zone) => (
          <label key={zone.slug} style={{ display: "grid", gap: 6 }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 800 }}>
              {zone.label}
              <span>{levels[zone.slug] ?? 0}/10</span>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              value={levels[zone.slug] ?? 0}
              onChange={(event) => setLevels((current) => ({ ...current, [zone.slug]: Number(event.target.value) }))}
              style={{ width: "100%", accentColor: "#F87171", minHeight: 44 }}
            />
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={onDone} disabled={pending} style={buttonStyle}>
          Skip
        </button>
        <button type="button" onClick={submit} disabled={pending} style={buttonStyle}>
          {pending ? "Saving..." : "Log"}
        </button>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid rgba(248,113,113,0.28)",
  borderRadius: 16,
  background: "rgba(248,113,113,0.08)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 8,
};
