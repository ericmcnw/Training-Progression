"use client";

import { useMemo, useState, useTransition } from "react";
import BodyMap from "@/app/components/body-map/BodyMap";
import { logPain } from "@/app/body/actions";
import type { PainContext } from "@/generated/prisma";
import type { ZoneState } from "@/app/components/body-map/types";

type ZoneOption = { slug: string; label: string };
type Draft = { level: number; context: PainContext; notes: string };

const contextOptions: Array<{ value: PainContext; label: string }> = [
  { value: "AT_REST", label: "At rest" },
  { value: "DURING_ACTIVITY", label: "During activity" },
  { value: "AFTER_ACTIVITY", label: "After activity" },
  { value: "MORNING", label: "Morning" },
  { value: "GENERAL", label: "General" },
];

export default function PainLogForm({ zones, initialSelected = [] }: { zones: ZoneOption[]; initialSelected?: string[] }) {
  const zoneBySlug = useMemo(() => new Map(zones.map((zone) => [zone.slug, zone])), [zones]);
  const [selected, setSelected] = useState<string[]>(initialSelected.filter((slug) => zoneBySlug.has(slug)));
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initialSelected.map((slug) => [slug, { level: 0, context: "GENERAL" as PainContext, notes: "" }]))
  );
  const [status, setStatus] = useState<string | null>(null);
  const [logAnother, setLogAnother] = useState(true);
  const [pending, startTransition] = useTransition();

  const mapState: ZoneState[] = zones.map((zone) => ({
    slug: zone.slug,
    freshness: selected.includes(zone.slug) ? "RECOVERING" : "FRESH",
    painLevel: drafts[zone.slug]?.level,
  }));
  const canSubmit = selected.some((slug) => (drafts[slug]?.level ?? 0) > 0);

  function toggle(slug: string) {
    setSelected((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]));
    setDrafts((current) => ({
      ...current,
      [slug]: current[slug] ?? { level: 0, context: "GENERAL", notes: "" },
    }));
    setStatus(null);
  }

  function updateDraft(slug: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [slug]: { ...(current[slug] ?? { level: 0, context: "GENERAL", notes: "" }), ...patch },
    }));
  }

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        await logPain(
          selected.map((slug) => ({
            zoneSlug: slug,
            level: drafts[slug]?.level ?? 0,
            context: drafts[slug]?.context ?? "GENERAL",
            notes: drafts[slug]?.notes,
          }))
        );
        setStatus("Pain logged.");
        if (logAnother) {
          setSelected([]);
          setDrafts({});
        } else {
          window.location.href = "/";
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to log pain.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={card}>
        <BodyMap zones={mapState} selectable selectedSlugs={selected} onZoneClick={toggle} size="lg" />
      </section>

      {selected.length > 0 ? (
        <section style={{ display: "grid", gap: 12 }}>
          {selected.map((slug) => {
            const zone = zoneBySlug.get(slug);
            const draft = drafts[slug] ?? { level: 0, context: "GENERAL", notes: "" };
            if (!zone) return null;
            return (
              <div key={slug} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>{zone.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900 }}>{draft.level}/10</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={draft.level}
                  onChange={(event) => updateDraft(slug, { level: Number(event.target.value) })}
                  style={{ width: "100%", accentColor: "#F87171", minHeight: 44 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)", gap: 10 }}>
                  <select value={draft.context} onChange={(event) => updateDraft(slug, { context: event.target.value as PainContext })}>
                    {contextOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input value={draft.notes} onChange={(event) => updateDraft(slug, { notes: event.target.value })} placeholder="Notes optional" />
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <div style={empty}>Select one or more zones on the map.</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, color: "rgba(255,255,255,0.74)" }}>
          <input type="checkbox" checked={logAnother} onChange={(event) => setLogAnother(event.target.checked)} />
          Log another after submit
        </label>
        <button type="button" disabled={!canSubmit || pending} onClick={submit}>
          {pending ? "Logging..." : "Log pain"}
        </button>
      </div>
      {status ? <div style={empty}>{status}</div> : null}
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 18,
  background: "rgba(255,255,255,0.04)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const empty: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  background: "rgba(255,255,255,0.03)",
  padding: 12,
  color: "rgba(255,255,255,0.68)",
  fontSize: 13,
};
