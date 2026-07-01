"use client";

// One pain-logging entry point, used everywhere a "Log pain" affordance shows
// (page toolbars, injury detail). Opens the shared PainLogSheet — the same
// slider + when + aggravating-factors + notes flow used by the body map and the
// home injuries card — so pain logging looks and behaves identically across the
// app instead of fragmenting into a separate page + inline forms.

import { useState, type CSSProperties } from "react";
import Popover from "@/app/_home/Popover";
import PainLogSheet from "@/app/body/PainLogSheet";

type ZoneTarget = { slug: string; label: string };
type InjuryTarget = { id: string; name: string; zones: ZoneTarget[] };

export default function LogPainButton({
  zones,
  injuries = [],
  factorSuggestions = [],
  label = "Log pain",
  style,
}: {
  zones: ZoneTarget[];
  injuries?: InjuryTarget[];
  factorSuggestions?: string[];
  label?: string;
  style?: CSSProperties;
}) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [painZone, setPainZone] = useState<ZoneTarget | null>(null);

  // When there's exactly one possible target and no injury list to pick from,
  // skip the chooser and go straight to the sheet.
  const lone =
    injuries.length === 0 && zones.length === 1 ? zones[0] : null;

  function open() {
    if (lone) setPainZone(lone);
    else setChooserOpen(true);
  }

  function logFor(zone: ZoneTarget) {
    setChooserOpen(false);
    setPainZone(zone);
  }

  return (
    <>
      <button type="button" onClick={open} style={{ ...triggerStyle, ...style }}>
        {label}
      </button>

      <Popover open={chooserOpen} onClose={() => setChooserOpen(false)} title="Log pain" desktopWidth={400}>
        <div style={{ display: "grid", gap: 14 }}>
          {injuries.length > 0 ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={miniLabel}>An active injury</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {injuries.flatMap((injury) =>
                  injury.zones.map((zone) => (
                    <button
                      key={`${injury.id}:${zone.slug}`}
                      type="button"
                      onClick={() => logFor(zone)}
                      style={chooserChip}
                    >
                      {injury.zones.length > 1 ? `${injury.name} · ${zone.label}` : injury.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 6 }}>
            <div style={miniLabel}>{injuries.length > 0 ? "A new body part" : "A body part"}</div>
            <select
              defaultValue=""
              onChange={(e) => {
                const z = zones.find((zone) => zone.slug === e.target.value);
                if (z) logFor(z);
              }}
              style={selectStyle}
            >
              <option value="">Pick a body part…</option>
              {zones.map((z) => (
                <option key={z.slug} value={z.slug}>{z.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Popover>

      <PainLogSheet zone={painZone} onClose={() => setPainZone(null)} factorSuggestions={factorSuggestions} />
    </>
  );
}

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  minHeight: 36,
  alignItems: "center",
  border: "1px solid rgba(248,113,113,0.35)",
  borderRadius: 10,
  padding: "8px 14px",
  background: "rgba(248,113,113,0.08)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const miniLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.55,
};

const chooserChip: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(248,113,113,0.4)",
  background: "rgba(248,113,113,0.10)",
  color: "#FCA5A5",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  minHeight: 38,
};

// fontSize 16 — iOS zoom guard.
const selectStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 700,
  minHeight: 46,
  cursor: "pointer",
};
