"use client";

import { useState, type CSSProperties } from "react";

// Multi-select chip picker for "this routine supports these sports."
// Maintains its own state, emits hidden inputs so the values get
// submitted along with the rest of the form via the parent's
// FormData-based server action.
//
// Distinct from "this routine IS [sport]" — that's the synthetic
// sports-{slug}-synthetic routine path (for which this picker isn't
// shown — those routines never use this field).
//
// Used by both NewRoutineForm and EditRoutineForm. The /activities/
// {sport} world pages read Routine.supportsSports to populate a
// "Training" section alongside actual sport sessions.

export type SportOption = {
  slug: string;
  label: string;
  /** Tiny color hint shown as a dot on the chip — matches the
   *  sports-chart palette so a routine tagged "supports climbing"
   *  reads as the same orange wherever it appears. */
  accent: string;
};

export default function SupportsSportsField({
  options,
  initialSelected = [],
}: {
  options: SportOption[];
  initialSelected?: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <fieldset style={fieldset}>
      <legend style={legend}>Supports which sports?</legend>
      <div style={help}>
        Optional. Tag this routine if it’s training that supports a sport (e.g. hangboard → climbing,
        rotator-cuff work → surfing). Doesn’t mean the routine IS that sport — just that it shows up
        as related training on the sport’s page.
      </div>

      <div style={chipRow}>
        {options.map((opt) => {
          const isOn = selected.has(opt.slug);
          return (
            <button
              key={opt.slug}
              type="button"
              onClick={() => toggle(opt.slug)}
              aria-pressed={isOn}
              style={isOn ? chipActive(opt.accent) : chipInactive}
            >
              <span style={chipDot(opt.accent)} />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* One hidden input per selected slug — FormData.getAll("supportsSports") on
          the server returns the full list. */}
      {[...selected].map((slug) => (
        <input key={slug} type="hidden" name="supportsSports" value={slug} />
      ))}
    </fieldset>
  );
}

const fieldset: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.02)",
};

const legend: CSSProperties = {
  padding: "0 6px",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.75,
};

const help: CSSProperties = {
  fontSize: 11.5,
  opacity: 0.6,
  lineHeight: 1.45,
};

const chipRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 2,
};

const chipInactive: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

function chipActive(accent: string): CSSProperties {
  return {
    ...chipInactive,
    borderColor: accent.replace("0.9", "0.5"),
    background: accent.replace("0.9", "0.12"),
    color: "rgba(255,255,255,0.95)",
  };
}

function chipDot(bg: string): CSSProperties {
  return { width: 7, height: 7, borderRadius: 999, background: bg, flexShrink: 0 };
}
