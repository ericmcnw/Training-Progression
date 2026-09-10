"use client";

// Search matches the ladder's name, its blurb, AND its step labels — so
// "band" finds the ladders that use one and "lever" finds the front lever
// without knowing which group it lives under.

import { useMemo, useState } from "react";
import { PROGRESSION_PRESETS, PRESET_GROUPS } from "@/lib/progression-presets";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import { applyPreset, createBlankProgression } from "../actions";
import {
  subtitle, card, cardGrid, cardTitle, ctaLink, countTag,
  presetChain, presetGroupHeading, presetChip, presetFoot,
  searchWrap, buildOwnBtn, noMatch,
} from "../ui";

const PREVIEW = 4;

function haystack(preset: (typeof PROGRESSION_PRESETS)[number]) {
  return [
    preset.name,
    preset.blurb,
    ...preset.rungs.map((r) => [r.label, r.modifier, r.targetText].filter(Boolean).join(" ")),
  ]
    .join(" ")
    .toLowerCase();
}

export default function PresetPicker() {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PROGRESSION_PRESETS;
    const terms = q.split(/\s+/);
    return PROGRESSION_PRESETS.filter((p) => {
      const hay = haystack(p);
      return terms.every((t) => hay.includes(t));
    });
  }, [query]);

  return (
    <>
      <form action={createBlankProgression}>
        <button type="submit" style={buildOwnBtn}>
          + Build your own
        </button>
      </form>

      <div style={searchWrap}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search steps — lever, band, jump, finger…"
          aria-label="Search presets"
          style={inputStyle}
        />
      </div>

      {matches.length === 0 ? (
        <p style={noMatch}>
          Nothing matches &ldquo;{query.trim()}&rdquo;. Build your own instead — it takes about
          as long as reading this.
        </p>
      ) : (
        PRESET_GROUPS.map((group) => {
          const presets = matches.filter((p) => p.group === group.key);
          if (presets.length === 0) return null;
          return (
            <section key={group.key} style={{ display: "grid", gap: 10 }}>
              <h2 style={presetGroupHeading}>{group.label}</h2>
              <div style={cardGrid}>
                {presets.map((preset) => (
                  <form key={preset.key} action={applyPreset} style={card}>
                    <input type="hidden" name="presetKey" value={preset.key} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                      <span style={cardTitle}>{preset.name}</span>
                      <span style={countTag}>{preset.rungs.length} steps</span>
                    </div>
                    <p style={{ ...subtitle, margin: 0 }}>{preset.blurb}</p>
                    <div style={presetChain}>
                      {preset.rungs.slice(0, PREVIEW).map((rung, i) => (
                        <span key={i} style={presetChip}>
                          {[rung.label, rung.modifier].filter(Boolean).join(" · ")}
                        </span>
                      ))}
                      {preset.rungs.length > PREVIEW ? (
                        <span style={countTag}>+{preset.rungs.length - PREVIEW} more</span>
                      ) : null}
                    </div>
                    <div style={presetFoot}>
                      <button type="submit" style={ctaLink}>Use this</button>
                    </div>
                  </form>
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
