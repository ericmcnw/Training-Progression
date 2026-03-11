"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { updateRoutine } from "../../actions";
import {
  ROUTINE_KIND_OPTIONS,
  ROUTINE_SUBTYPE_OPTIONS,
  formatRoutineSubtype,
  isGuidedKind,
  isWorkoutKind,
} from "@/lib/routines";
import type { RoutineKind } from "@prisma/client";

export default function EditRoutineForm({
  routine,
  categories,
}: {
  routine: {
    id: string;
    name: string;
    category: string;
    subtype: string | null;
    kind: RoutineKind;
    timesPerWeek: number | null;
  };
  categories: string[];
}) {
  const hasCategory = categories.includes(routine.category);
  const [selectedCategory, setSelectedCategory] = useState(hasCategory ? routine.category : "__custom__");
  const [customCategory, setCustomCategory] = useState(hasCategory ? "" : routine.category);
  const [kind, setKind] = useState<RoutineKind>(routine.kind);
  const subtypeOptions = useMemo(() => ROUTINE_SUBTYPE_OPTIONS[kind], [kind]);
  const [subtype, setSubtype] = useState(routine.subtype && subtypeOptions.includes(routine.subtype) ? routine.subtype : subtypeOptions[0]);
  const isCustomCategory = selectedCategory === "__custom__";

  return (
    <form action={updateRoutine} style={{ padding: 14, display: "grid", gap: 12, maxWidth: 520 }}>
      <input type="hidden" name="id" value={routine.id} />

      <div>
        <label style={styles.label}>Name</label>
        <input name="name" style={styles.input} defaultValue={routine.name} />
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
        <input
          name="timesPerWeek"
          style={styles.input}
          inputMode="numeric"
          defaultValue={routine.timesPerWeek ?? ""}
          placeholder="e.g. 4"
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" style={styles.btn}>
          Save
        </button>
        <Link href="/routines" style={styles.linkBtn}>
          Back
        </Link>
        {isWorkoutKind(kind) && (
          <Link href={`/routines/${routine.id}/template`} style={styles.linkBtn}>
            Template
          </Link>
        )}
        {isGuidedKind(kind) && (
          <Link href={`/routines/${routine.id}/guided`} style={styles.linkBtn}>
            Steps
          </Link>
        )}
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
