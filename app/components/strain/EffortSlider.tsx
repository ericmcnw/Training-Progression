"use client";

import { useId } from "react";
import {
  EFFORT_MAX,
  EFFORT_MIN,
  EFFORT_ZONES,
  EFFORT_GRADIENT,
  clampEffort,
  effortAnchor,
  effortColor,
  effortLabel,
} from "@/lib/strain";

// The 1-10 perceived-effort slider. Controlled: the parent owns `value`, which
// is `null` until the user actually rates the session. We still render the thumb
// at `predicted` while untouched (so it's pre-positioned at a smart guess), but
// the caller keeps storing null until onChange fires — that's what lets the
// learning distinguish a real rating from a placeholder.
//
// Interaction: drag the native range OR tap any number tick. Both write an
// integer 1-10. Big live readout + zone word + Borg anchor so the meaning is
// obvious without a legend.

export function EffortSlider({
  value,
  predicted,
  onChange,
  hint,
  label = "How hard did that feel?",
}: {
  value: number | null;
  predicted: number;
  onChange: (effort: number) => void;
  hint?: string;
  label?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const cls = `effortSlider-${uid}`;
  const touched = value != null;
  const display = clampEffort(touched ? (value as number) : predicted);
  const color = effortColor(display);

  return (
    <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 460, margin: "0 auto" }}>
      <style>{`
        .${cls} {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 44px;
          background: transparent;
          cursor: pointer;
          margin: 0;
          touch-action: pan-y;
        }
        .${cls}:focus { outline: none; }
        .${cls}::-webkit-slider-runnable-track {
          height: 14px;
          border-radius: 999px;
          background: ${EFFORT_GRADIENT};
          border: 1px solid rgba(255,255,255,0.14);
        }
        .${cls}::-moz-range-track {
          height: 14px;
          border-radius: 999px;
          background: ${EFFORT_GRADIENT};
          border: 1px solid rgba(255,255,255,0.14);
        }
        .${cls}::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 30px;
          width: 30px;
          margin-top: -9px;
          border-radius: 999px;
          background: #ffffff;
          border: 4px solid ${color};
          box-shadow: 0 2px 8px rgba(0,0,0,0.45);
          transition: border-color 120ms ease;
        }
        .${cls}::-moz-range-thumb {
          height: 30px;
          width: 30px;
          border-radius: 999px;
          background: #ffffff;
          border: 4px solid ${color};
          box-shadow: 0 2px 8px rgba(0,0,0,0.45);
        }
        .${cls}[data-untouched="true"]::-webkit-slider-thumb { opacity: 0.55; }
        .${cls}[data-untouched="true"]::-moz-range-thumb { opacity: 0.55; }
      `}</style>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <label style={{ fontWeight: 900, fontSize: 15, flex: 1, minWidth: 0 }}>{label}</label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color, opacity: touched ? 1 : 0.6 }}>
            {display}
          </span>
          <span style={{ fontSize: 13, fontWeight: 900, color, opacity: touched ? 1 : 0.6, letterSpacing: 0.3 }}>
            {effortLabel(display).toUpperCase()}
          </span>
        </div>
      </div>

      <input
        type="range"
        className={cls}
        data-untouched={touched ? "false" : "true"}
        min={EFFORT_MIN}
        max={EFFORT_MAX}
        step={1}
        value={display}
        onChange={(e) => onChange(clampEffort(Number(e.target.value)))}
        aria-label={label}
        aria-valuetext={`${display} of 10 — ${effortLabel(display)}`}
      />

      {/* Tappable ticks — drag is nice, but a direct tap on the number is the
          fastest path on mobile. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
        {Array.from({ length: EFFORT_MAX }, (_, i) => i + 1).map((n) => {
          const active = touched && n === display;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-label={`Rate ${n}`}
              style={{
                minHeight: 40,
                borderRadius: 9,
                border: active ? `2px solid ${effortColor(n)}` : "1px solid rgba(128,128,128,0.4)",
                background: active ? `${effortColor(n)}22` : "rgba(128,128,128,0.08)",
                color: "inherit",
                fontWeight: 900,
                fontSize: 16,
                cursor: "pointer",
                padding: 0,
                touchAction: "manipulation",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Zone band labels under the track, proportional to each zone's width. */}
      <div style={{ display: "flex", gap: 4 }}>
        {EFFORT_ZONES.map((z) => (
          <div
            key={z.label}
            style={{
              flex: z.max - z.min + 1,
              textAlign: "center",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 0.2,
              color: z.color,
              opacity: 0.85,
            }}
          >
            {z.label}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        <div style={{ fontSize: 13, opacity: 0.9 }}>{effortAnchor(display)}</div>
        {!touched ? (
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {hint ?? "Estimate — tap or drag to set your rating. Left unrated, this stays a guess."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
