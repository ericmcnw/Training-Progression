"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import MetadataGroupPicker from "@/app/components/MetadataGroupPicker";
import { inferExerciseMetadataSlugs } from "@/lib/metadata";
import type { MetadataGroupKind } from "@/generated/prisma";

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
    selectedMetadataGroupIds: string[];
  };
}) {
  const [name, setName] = useState(exercise?.name ?? "");
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
    <form action={action} style={{ padding: 14, display: "grid", gap: 12, maxWidth: 720 }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={styles.label}>Unit</label>
          <select name="unit" style={styles.input as React.CSSProperties} defaultValue={exercise?.unit ?? "REPS"}>
            <option value="REPS">REPS</option>
            <option value="TIME">TIME (seconds)</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
          <input
            id="supportsWeight"
            name="supportsWeight"
            type="checkbox"
            defaultChecked={exercise?.supportsWeight ?? false}
          />
          <label htmlFor="supportsWeight" style={{ fontWeight: 800 }}>
            Supports Weight (lbs)
          </label>
        </div>
      </div>

      <MetadataGroupPicker
        title="Exercise Metadata"
        help="Name-based defaults are preselected here. You can add more or uncheck any of them before saving."
        groups={metadataGroups}
        selectedIds={selectedMetadataGroupIds}
        onSelectionChange={setSelectedMetadataGroupIds}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  input: {
    width: "100%",
    padding: 8,
    border: "1px solid rgba(128,128,128,0.6)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
  },
  btn: {
    padding: "10px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 900 as const,
  },
  linkBtn: {
    padding: "8px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800 as const,
    background: "rgba(128,128,128,0.12)",
  },
};
