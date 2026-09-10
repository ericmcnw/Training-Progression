// Preset picker. Applying one writes real, fully editable rows — a preset is a
// starting point, not a template the progression stays bound to.

import Link from "next/link";
import { PROGRESSION_PRESETS, PRESET_GROUPS } from "@/lib/progression-presets";
import { applyPreset } from "../actions";
import { page, topBar, backLink, title, subtitle, card, cardGrid, cardTitle, ctaLink, countTag } from "../ui";
import { presetChain, presetGroupHeading, presetChip, presetFoot } from "../ui";

export const dynamic = "force-dynamic";

const PREVIEW = 4;

export default function NewProgressionPage() {
  return (
    <main style={page}>
      <div style={topBar}>
        <Link href="/progressions" style={backLink}>← Progressions</Link>
      </div>

      <header style={{ display: "grid", gap: 6 }}>
        <h1 style={title}>Start a progression</h1>
        <p style={subtitle}>
          Pick a ladder to start from. Every step is editable afterward — rename them,
          reorder them, or throw them out.
        </p>
      </header>

      {PRESET_GROUPS.map((group) => {
        const presets = PROGRESSION_PRESETS.filter((p) => p.group === group.key);
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
      })}
    </main>
  );
}
