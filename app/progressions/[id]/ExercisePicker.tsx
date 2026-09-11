"use client";

// A real picker, not an autocomplete. A datalist looks similar but resolves by
// exact string match, so a near-miss ("pull up" for "Pull-Up") silently linked
// nothing and the step quietly lost its ability to tick itself. Here the
// exercise is only ever set by choosing a row, and an unresolved search says so.

import { useMemo, useState } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import type { ExerciseOption } from "@/app/progressions/data";
import {
  pickerWrap, pickerResults, pickerRow, pickerChip, pickerChipName,
  pickerClear, pickerHint,
} from "@/app/progressions/ui";

const MAX_RESULTS = 8;

export default function ExercisePicker({
  options,
  value,
  onChange,
}: {
  options: ExerciseOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
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

  return (
    <div style={pickerWrap}>
      <input
        style={inputStyle}
        value={query}
        placeholder="Search your exercises — pull, hang, squat…"
        aria-label="Search exercises"
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() ? (
        results.length ? (
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
        ) : (
          <span style={pickerHint}>
            No exercise matches that. This step still works — you will just tick it
            yourself.
          </span>
        )
      ) : null}
    </div>
  );
}
