"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import MetadataGroupPicker from "@/app/components/MetadataGroupPicker";
import { EXERCISE_LIBRARY_KIND_LABELS } from "@/lib/exercise-library";
import { exerciseUnitDescription } from "@/lib/exercises";
import { inferExerciseMetadataSlugs } from "@/lib/metadata";
import type { ExerciseLibraryKind, MetadataGroupKind } from "@/generated/prisma";

type MetadataGroupOption = {
  id: string;
  slug: string;
  label: string;
  kind: MetadataGroupKind;
};

export default function ExerciseForm({
  action,
  metadataGroups,
  submitLabel,
  cancelHref,
  exercise,
}: {
  action: (formData: FormData) => void;
  metadataGroups: MetadataGroupOption[];
  submitLabel: string;
  cancelHref?: string;
  exercise?: {
    id: string;
    name: string;
    unit: "REPS" | "TIME";
    supportsWeight: boolean;
    libraryKind: ExerciseLibraryKind;
    selectedMetadataGroupIds: string[];
  };
}) {
  const [name, setName] = useState(exercise?.name ?? "");
  const [unit, setUnit] = useState<"REPS" | "TIME">(exercise?.unit ?? "REPS");
  const [supportsWeight, setSupportsWeight] = useState(exercise?.supportsWeight ?? false);
  const [libraryKind, setLibraryKind] = useState<ExerciseLibraryKind>(exercise?.libraryKind ?? "STRENGTH");
  const [selectedMetadataGroupIds, setSelectedMetadataGroupIds] = useState<string[]>(
    exercise?.selectedMetadataGroupIds ?? []
  );
  const metadataGroupIdBySlug = useMemo(
    () => new Map(metadataGroups.map((group) => [group.slug, group.id])),
    [metadataGroups]
  );
  const suggestedMetadataGroupIds = useMemo(
    () =>
      inferExerciseMetadataSlugs(name)
        .map((slug) => metadataGroupIdBySlug.get(slug))
        .filter((value): value is string => Boolean(value)),
    [metadataGroupIdBySlug, name]
  );
  const previousSuggestedRef = useRef<string[]>([]);

  useEffect(() => {
    const previous = new Set(previousSuggestedRef.current);
    const next = new Set(suggestedMetadataGroupIds);
    const additions = Array.from(next).filter((id) => !previous.has(id));
    if (additions.length > 0) {
      setSelectedMetadataGroupIds((current) => Array.from(new Set([...current, ...additions])));
    }
    previousSuggestedRef.current = suggestedMetadataGroupIds;
  }, [suggestedMetadataGroupIds]);

  return (
    <form action={action} className="mobileSectionBody mobileListStack" style={{ padding: 14, display: "grid", gap: 14, maxWidth: 720 }}>
      {exercise ? <input type="hidden" name="id" value={exercise.id} /> : null}

      <div>
        <label style={styles.label}>Name</label>
        <input
          name="name"
          style={styles.input}
          placeholder="Weighted Pull-Up, Lock-Off, Deadlift..."
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="mobileFormGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={styles.label}>Logging style</label>
          <select
            name="unit"
            style={styles.input as React.CSSProperties}
            value={unit}
            onChange={(event) => setUnit(event.target.value as "REPS" | "TIME")}
          >
            <option value="REPS">Rep-based sets</option>
            <option value="TIME">Timed sets</option>
          </select>
          <div style={styles.hint}>{exerciseUnitDescription(unit)}</div>
        </div>

        <div className="mobileExerciseFormToggleRow" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
          <input
            id="supportsWeight"
            name="supportsWeight"
            type="checkbox"
            checked={supportsWeight}
            onChange={(event) => setSupportsWeight(event.target.checked)}
          />
          <label htmlFor="supportsWeight" style={{ fontWeight: 800 }}>
            Supports added weight
          </label>
        </div>
      </div>

      <div>
        <label style={styles.label}>Library classification</label>
        <select
          name="libraryKind"
          style={styles.input as React.CSSProperties}
          value={libraryKind}
          onChange={(event) => setLibraryKind(event.target.value as ExerciseLibraryKind)}
        >
          {Object.entries(EXERCISE_LIBRARY_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <div style={styles.hint}>
          Workout template search uses this to keep stretch, mobility, and breathwork entries in the right library by default.
        </div>
      </div>

      <MetadataGroupPicker
        title="Exercise groups (optional)"
        help="Name-based suggestions are preselected here. You only need to change this when you want better rollups in Progress."
        groups={metadataGroups}
        selectedIds={selectedMetadataGroupIds}
        onSelectionChange={setSelectedMetadataGroupIds}
        collapsible
      />

      <div className="mobileStickyActions mobileActionRow" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" style={styles.btn}>
          {submitLabel}
        </button>
        {cancelHref ? (
          <Link href={cancelHref} style={styles.linkBtn}>
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}

const styles = {
  label: { display: "block", fontWeight: 900 as const, marginBottom: 6 },
  input: {
    width: "100%",
    minHeight: 46,
    padding: 10,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 12,
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
  },
  hint: { marginTop: 6, fontSize: 12, opacity: 0.72 },
  btn: {
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 12,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },
  linkBtn: {
    minHeight: 44,
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 12,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800 as const,
    background: "rgba(128,128,128,0.12)",
  },
};
