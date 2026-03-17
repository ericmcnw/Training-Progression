"use client";

import MetadataGroupPicker from "@/app/components/MetadataGroupPicker";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoutine } from "../actions";
import {
  ROUTINE_KIND_OPTIONS,
  ROUTINE_SUBTYPE_OPTIONS,
  formatRoutineSubtype,
} from "@/lib/routines";
import { ROUTINE_SUBTYPE_GROUP_DEFAULTS } from "@/lib/metadata";
import { getRoutinePreset, ROUTINE_PRESETS, type RoutinePresetKey } from "@/lib/routine-presets";
import type { MetadataGroupKind, RoutineKind } from "@/generated/prisma";

type MetadataGroupOption = {
  id: string;
  slug: string;
  label: string;
  kind: MetadataGroupKind;
};

export default function NewRoutineForm({
  categories,
  metadataGroups,
  sessionTemplates,
}: {
  categories: string[];
  metadataGroups: MetadataGroupOption[];
  sessionTemplates: Array<{
    id: string;
    name: string;
    description: string | null;
    sessionSubtype: string | null;
  }>;
}) {
  const [presetKey, setPresetKey] = useState<RoutinePresetKey>("HABIT");
  const initialPreset = getRoutinePreset(presetKey);
  const [kind, setKind] = useState<RoutineKind>(initialPreset.kind);
  const [selectedCategory, setSelectedCategory] = useState(
    categories.includes(initialPreset.categoryHint) ? initialPreset.categoryHint : "__custom__"
  );
  const [customCategory, setCustomCategory] = useState(
    categories.includes(initialPreset.categoryHint) ? "" : initialPreset.categoryHint
  );
  const subtypeOptions = useMemo(() => ROUTINE_SUBTYPE_OPTIONS[kind], [kind]);
  const [subtype, setSubtype] = useState(initialPreset.subtype ?? subtypeOptions[0] ?? "OTHER");
  const matchingSessionTemplates = useMemo(
    () => sessionTemplates.filter((template) => !template.sessionSubtype || template.sessionSubtype === subtype),
    [sessionTemplates, subtype]
  );
  const [sessionTemplateId, setSessionTemplateId] = useState(() => matchingSessionTemplates[0]?.id ?? sessionTemplates[0]?.id ?? "");
  const effectiveSessionTemplateId =
    (matchingSessionTemplates.length > 0 ? matchingSessionTemplates : sessionTemplates).some((template) => template.id === sessionTemplateId)
      ? sessionTemplateId
      : (matchingSessionTemplates[0]?.id ?? sessionTemplates[0]?.id ?? "");
  const isCustomCategory = selectedCategory === "__custom__";
  const metadataGroupIdBySlug = useMemo(
    () => new Map(metadataGroups.map((group) => [group.slug, group.id])),
    [metadataGroups]
  );
  const suggestedMetadataGroupIds = useMemo(
    () =>
      (ROUTINE_SUBTYPE_GROUP_DEFAULTS[subtype] ?? [])
        .map((slug) => metadataGroupIdBySlug.get(slug))
        .filter((value): value is string => Boolean(value)),
    [metadataGroupIdBySlug, subtype]
  );
  const [selectedMetadataGroupIds, setSelectedMetadataGroupIds] = useState<string[]>(suggestedMetadataGroupIds);
  const previousSuggestedRef = useRef<string[]>(suggestedMetadataGroupIds);

  useEffect(() => {
    const previous = new Set(previousSuggestedRef.current);
    const next = new Set(suggestedMetadataGroupIds);
    const additions = Array.from(next).filter((id) => !previous.has(id));
    if (additions.length > 0) {
      setSelectedMetadataGroupIds((current) => Array.from(new Set([...current, ...additions])));
    }
    previousSuggestedRef.current = suggestedMetadataGroupIds;
  }, [suggestedMetadataGroupIds]);

  const activePreset = getRoutinePreset(presetKey);
  const typeHelp =
    kind === "COMPLETION"
      ? "Done/not-done routines with optional notes and count."
      : kind === "WORKOUT"
      ? "Exercise templates with sets, reps, weight, or time."
      : kind === "CARDIO"
      ? "Distance and duration based sessions like running or biking."
      : kind === "GUIDED"
      ? "Timed or step-based flows like mobility, warmup, cooldown, or rehab."
      : "Broader sessions like climbing, sports, or skill practice.";

  return (
    <form action={createRoutine} style={{ padding: 14, display: "grid", gap: 12, maxWidth: 520 }}>
      <div>
        <label style={styles.label}>Tracking preset</label>
        <div style={styles.presetGrid}>
          {ROUTINE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                setPresetKey(preset.key);
                if (preset.key !== "CUSTOM") {
                  setKind(preset.kind);
                  setSubtype(preset.subtype ?? ROUTINE_SUBTYPE_OPTIONS[preset.kind][0] ?? "OTHER");
                  setSelectedCategory(categories.includes(preset.categoryHint) ? preset.categoryHint : "__custom__");
                  setCustomCategory(categories.includes(preset.categoryHint) ? "" : preset.categoryHint);
                }
              }}
              style={{
                ...styles.presetCard,
                ...(presetKey === preset.key ? styles.presetCardActive : null),
              }}
            >
              <div style={styles.presetTitle}>{preset.label}</div>
              <div style={styles.presetDescription}>{preset.description}</div>
            </button>
          ))}
        </div>
        <div style={styles.help}>
          Start with a preset. You can still fine-tune type, subtype, organization, and tags in Advanced.
        </div>
      </div>

      <div>
        <label style={styles.label}>Name</label>
        <input name="name" style={styles.input} placeholder="Morning mobility, Lift A, Trail run, Climbing..." />
      </div>

      <div>
        <label style={styles.label}>Times per week (optional)</label>
        <input name="timesPerWeek" style={styles.input} inputMode="numeric" placeholder="e.g. 4" />
        <div style={styles.help}>If set, this creates or updates a visible weekly goal for the routine.</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" style={styles.btn}>
          Create Routine
        </button>
        {kind === "WORKOUT" && (
          <button type="submit" name="postCreate" value="template" style={styles.btn}>
            Create + Open Template
          </button>
        )}
      </div>

      <details style={styles.advancedCard}>
        <summary data-collapsible-summary style={styles.advancedSummary}>
          Advanced setup
        </summary>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div style={styles.advancedIntro}>
            <div style={{ fontWeight: 800 }}>{activePreset.label}</div>
            <div>{activePreset.description}</div>
          </div>

          <div>
            <label style={styles.label}>Category</label>
            <select
              name={isCustomCategory ? "categoryPreset" : "category"}
              style={styles.input as React.CSSProperties}
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              <option value="__custom__">+ Add new category</option>
            </select>
            {isCustomCategory && (
              <div style={{ marginTop: 8 }}>
                <input
                  name="category"
                  style={styles.input}
                  placeholder="Type new category name..."
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <label style={styles.label}>Tracking type</label>
            <select
              name="kind"
              style={styles.input as React.CSSProperties}
              value={kind}
              onChange={(event) => {
                const nextKind = event.target.value as RoutineKind;
                setPresetKey("CUSTOM");
                setKind(nextKind);
                setSubtype(ROUTINE_SUBTYPE_OPTIONS[nextKind][0] ?? "OTHER");
              }}
            >
              {ROUTINE_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div style={styles.help}>{typeHelp}</div>
          </div>

          <div>
            <label style={styles.label}>Subtype / Template</label>
            <select
              name="subtype"
              style={styles.input as React.CSSProperties}
              value={subtype}
              onChange={(event) => {
                setPresetKey("CUSTOM");
                setSubtype(event.target.value);
              }}
            >
              {subtypeOptions.map((option) => (
                <option key={option} value={option}>
                  {formatRoutineSubtype(option)}
                </option>
              ))}
            </select>
          </div>

          {kind === "SESSION" ? (
            <div>
              <label style={styles.label}>Session template</label>
              <select
                name="sessionTemplateId"
                style={styles.input as React.CSSProperties}
                value={effectiveSessionTemplateId}
                onChange={(event) => setSessionTemplateId(event.target.value)}
              >
                {(matchingSessionTemplates.length > 0 ? matchingSessionTemplates : sessionTemplates).map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              <div style={styles.help}>
                {(matchingSessionTemplates.find((template) => template.id === effectiveSessionTemplateId) ?? sessionTemplates.find((template) => template.id === effectiveSessionTemplateId))?.description ??
                  "Pick the sport/activity template that defines the structured log fields for this session routine."}
              </div>
            </div>
          ) : null}

          <MetadataGroupPicker
            title="Organization & analysis (optional)"
            help="These groups power rollups in Progress. The app preselects suggestions from the preset and subtype, so most users can leave this alone."
            groups={metadataGroups}
            selectedIds={selectedMetadataGroupIds}
            onSelectionChange={setSelectedMetadataGroupIds}
          />

          <div>
            <label style={styles.label}>Tags (optional)</label>
            <input
              name="tags"
              style={styles.input}
              placeholder="Comma separated: trail, deload, gym, outdoors"
            />
            <div style={styles.help}>Use tags for personal labels. Use the groups above only when you want stronger progress rollups.</div>
          </div>
        </div>
      </details>

      <div style={styles.help}>Week starts Sunday. Workout weight uses pounds. Cardio distance uses miles for now.</div>
    </form>
  );
}

const styles = {
  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  input: {
    width: "100%",
    padding: 8,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
  },
  btn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },
  presetGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  },
  presetCard: {
    textAlign: "left" as const,
    padding: 12,
    borderWidth: 1,
    borderStyle: "solid" as const,
    borderColor: "rgba(128,128,128,0.4)",
    borderRadius: 12,
    background: "rgba(128,128,128,0.06)",
    color: "inherit",
  },
  presetCardActive: {
    borderColor: "rgba(76,163,255,0.7)",
    background: "rgba(76,163,255,0.12)",
  },
  presetTitle: { fontWeight: 900 as const, marginBottom: 6 },
  presetDescription: { fontSize: 12, opacity: 0.8 },
  advancedCard: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.04)",
  },
  advancedSummary: { cursor: "pointer", fontWeight: 900 as const },
  advancedIntro: {
    border: "1px solid rgba(128,128,128,0.25)",
    borderRadius: 10,
    padding: 10,
    background: "rgba(128,128,128,0.06)",
    fontSize: 13,
    opacity: 0.88,
  },
  help: { marginTop: 6, opacity: 0.7, fontSize: 12 },
};
