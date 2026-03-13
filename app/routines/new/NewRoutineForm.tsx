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
}: {
  categories: string[];
  metadataGroups: MetadataGroupOption[];
}) {
  const [kind, setKind] = useState<RoutineKind>("COMPLETION");
  const [selectedCategory, setSelectedCategory] = useState(categories[0] ?? "General");
  const [customCategory, setCustomCategory] = useState("");
  const subtypeOptions = useMemo(() => ROUTINE_SUBTYPE_OPTIONS[kind], [kind]);
  const [subtype, setSubtype] = useState(subtypeOptions[0] ?? "OTHER");
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
        <label style={styles.label}>Name</label>
        <input name="name" style={styles.input} placeholder="Morning mobility, Lift A, Trail run, Climbing..." />
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
        <label style={styles.label}>Type</label>
        <select
          name="kind"
          style={styles.input as React.CSSProperties}
          value={kind}
          onChange={(event) => {
            const nextKind = event.target.value as RoutineKind;
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
          onChange={(event) => setSubtype(event.target.value)}
        >
          {subtypeOptions.map((option) => (
            <option key={option} value={option}>
              {formatRoutineSubtype(option)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={styles.label}>Times per week (optional)</label>
        <input name="timesPerWeek" style={styles.input} inputMode="numeric" placeholder="e.g. 4" />
      </div>

      <MetadataGroupPicker
        title="Analysis Groups"
        help="Subtype defaults are preselected here. You can add more or uncheck any of them before saving."
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
        <div style={styles.help}>Tags are optional and personal. System rollups should use the structured groups above.</div>
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
  help: { marginTop: 6, opacity: 0.7, fontSize: 12 },
};
