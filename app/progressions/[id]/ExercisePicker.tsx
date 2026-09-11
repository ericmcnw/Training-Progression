"use client";

// A real picker, not an autocomplete. A datalist looks similar but resolves by
// exact string match, so a near-miss ("pull up" for "Pull-Up") silently linked
// nothing and the step quietly lost its ability to tick itself. Here the
// exercise is only ever set by choosing a row.
//
// A search that matches nothing offers to create it, because the alternative
// is leaving the ladder to go make it and coming back. Shape is pre-answered
// from what the step measures — a hold wants a timed exercise, a weight target
// wants one that tracks load — so the usual case is one tap.

import { useMemo, useState } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import { createExerciseInline } from "@/app/exercises/actions";
import type { ExerciseOption } from "@/app/progressions/data";
import type { RungMetric } from "@/generated/prisma";
import {
  pickerWrap, pickerResults, pickerRow, pickerChip, pickerChipName,
  pickerClear, pickerHint, createBox, createTitle, createLine,
  toggleGroup, toggleChip, createBtn, rungError,
} from "@/app/progressions/ui";

const MAX_RESULTS = 8;

type Unit = "REPS" | "TIME";

function shapeFor(metric: RungMetric | null): { unit: Unit; weight: boolean } {
  if (metric === "SECONDS") return { unit: "TIME", weight: false };
  if (metric === "WEIGHT") return { unit: "REPS", weight: true };
  return { unit: "REPS", weight: false };
}

export default function ExercisePicker({
  options,
  value,
  metric,
  onChange,
  onCreated,
}: {
  options: ExerciseOption[];
  value: string | null;
  metric: RungMetric | null;
  onChange: (id: string | null) => void;
  onCreated: (option: ExerciseOption) => void;
}) {
  const shape = shapeFor(metric);
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState<Unit>(shape.unit);
  const [weight, setWeight] = useState(shape.weight);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = value ? options.find((o) => o.id === value) : undefined;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/);
    return options
      .filter((o) => {
        const name = o.name.toLowerCase();
        return terms.every((t) => name.includes(t));
      })
      .slice(0, MAX_RESULTS);
  }, [options, query]);

  async function create() {
    const name = query.trim();
    if (!name) return;
    setPending(true);
    setError(null);
    try {
      const made = await createExerciseInline({ name, unit, supportsWeight: weight });
      onCreated({ id: made.id, name: made.name });
      onChange(made.id);
      setQuery("");
    } catch {
      setError("Couldn't create that exercise.");
    } finally {
      setPending(false);
    }
  }

  if (selected) {
    return (
      <div style={pickerChip}>
        <span style={pickerChipName}>{selected.name}</span>
        <button
          type="button"
          style={pickerClear}
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          aria-label={`Clear ${selected.name}`}
        >
          ✕
        </button>
      </div>
    );
  }

  const typed = query.trim();

  return (
    <div style={pickerWrap}>
      <input
        style={inputStyle}
        value={query}
        placeholder="Search your exercises — pull, hang, squat…"
        aria-label="Search exercises"
        onChange={(e) => setQuery(e.target.value)}
      />

      {results.length > 0 ? (
        <div style={pickerResults}>
          {results.map((o) => (
            <button
              key={o.id}
              type="button"
              style={pickerRow}
              onClick={() => {
                onChange(o.id);
                setQuery("");
              }}
            >
              {o.name}
            </button>
          ))}
        </div>
      ) : null}

      {typed ? (
        <div style={createBox}>
          <span style={createTitle}>
            {results.length ? "Not the one you meant?" : "No exercise matches that."}
          </span>
          <span style={createLine}>
            Create <strong>{typed}</strong> as:
          </span>
          <div style={toggleGroup}>
            <button type="button" style={toggleChip(unit === "REPS")} onClick={() => setUnit("REPS")}>
              Reps
            </button>
            <button type="button" style={toggleChip(unit === "TIME")} onClick={() => setUnit("TIME")}>
              Timed
            </button>
            <button type="button" style={toggleChip(weight)} onClick={() => setWeight((w) => !w)}>
              {weight ? "✓ tracks weight" : "tracks weight"}
            </button>
          </div>
          <button type="button" style={createBtn} onClick={create} disabled={pending}>
            {pending ? "Creating…" : `+ Create and use "${typed}"`}
          </button>
          {error ? <span style={rungError}>{error}</span> : null}
          <span style={pickerHint}>
            An exercise with this name already? It links to that one instead of making a
            second.
          </span>
        </div>
      ) : null}
    </div>
  );
}
