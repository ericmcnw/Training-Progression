"use client";

// "What counts as climbing training?" — collapsed management panel under
// the training chart. Makes the hybrid tagging model visible AND editable
// right next to the graphic it drives:
//   - Tagged routines (every session counts) — chips linking to the
//     routine's edit page where the supportsSports field lives.
//   - Tagged exercises (sessions containing them count) — chips with an
//     inline ✕ untag, plus a datalist input to tag more by name.

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { tagExerciseForClimbing, untagExerciseForClimbing } from "./training-tag-actions";

export default function TrainingTagsPanel({
  taggedRoutines,
  taggedExercises,
  allExerciseNames,
}: {
  taggedRoutines: Array<{ id: string; name: string }>;
  taggedExercises: Array<{ id: string; name: string }>;
  allExerciseNames: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addExercise() {
    const name = inputRef.current?.value.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      try {
        await tagExerciseForClimbing({ exerciseName: name });
        if (inputRef.current) inputRef.current.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't tag exercise");
      }
    });
  }

  function removeExercise(exerciseId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await untagExerciseForClimbing({ exerciseId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't untag exercise");
      }
    });
  }

  return (
    <details style={panelStyle}>
      <summary style={summaryStyle}>
        <span>⚙ What counts as climbing training?</span>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 700 }}>
          {taggedRoutines.length} routine{taggedRoutines.length !== 1 ? "s" : ""} · {taggedExercises.length} exercise{taggedExercises.length !== 1 ? "s" : ""}
        </span>
      </summary>
      <div style={{ display: "grid", gap: 14, paddingTop: 12 }}>
        <p style={hintStyle}>
          A session lands on the chart when its <strong>routine</strong> is tagged for climbing
          (every session counts) or it contains a <strong>tagged exercise</strong> (only those
          sessions count — a generic Upper day shows up when pull-ups or lock-offs appear in it).
        </p>

        <div>
          <div style={groupLabelStyle}>Tagged routines</div>
          {taggedRoutines.length === 0 ? (
            <div style={emptyStyle}>None yet — tag one from its edit page.</div>
          ) : (
            <div style={chipRowStyle}>
              {taggedRoutines.map((r) => (
                <Link key={r.id} href={`/routines/${r.id}/edit`} style={routineChipStyle} title="Opens the routine's edit page — the sport tag lives there">
                  {r.name} ↗
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={groupLabelStyle}>Tagged exercises</div>
          {taggedExercises.length === 0 ? (
            <div style={emptyStyle}>None yet — add one below.</div>
          ) : (
            <div style={chipRowStyle}>
              {taggedExercises.map((e) => (
                <span key={e.id} style={exerciseChipStyle}>
                  {e.name}
                  <button
                    type="button"
                    onClick={() => removeExercise(e.id)}
                    disabled={isPending}
                    style={untagBtnStyle}
                    aria-label={`Stop counting ${e.name} as climbing training`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={addRowStyle}>
            <input
              ref={inputRef}
              list="climbing-training-exercise-options"
              placeholder="Add exercise — start typing…"
              style={addInputStyle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addExercise();
                }
              }}
            />
            <datalist id="climbing-training-exercise-options">
              {allExerciseNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <button type="button" onClick={addExercise} disabled={isPending} style={addBtnStyle}>
              {isPending ? "…" : "Tag"}
            </button>
          </div>
          {error ? <div style={errorStyle}>{error}</div> : null}
        </div>
      </div>
    </details>
  );
}

const panelStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.02)",
};

const summaryStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  cursor: "pointer",
  fontSize: 12.5,
  fontWeight: 800,
  minHeight: 28,
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  opacity: 0.7,
};

const groupLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
  marginBottom: 6,
};

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.5,
  fontStyle: "italic",
};

const routineChipStyle: React.CSSProperties = {
  padding: "6px 11px",
  borderRadius: 999,
  border: "1px solid rgba(84,203,130,0.4)",
  background: "rgba(84,203,130,0.10)",
  color: "rgba(134,239,172,0.95)",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const exerciseChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 6px 4px 11px",
  borderRadius: 999,
  border: "1px solid rgba(168,85,247,0.4)",
  background: "rgba(168,85,247,0.10)",
  color: "rgba(216,180,254,0.95)",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const untagBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  minHeight: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontSize: 10,
  cursor: "pointer",
  padding: 0,
};

const addRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginTop: 8,
  flexWrap: "wrap",
};

// fontSize 16 — iOS Safari auto-zoom guard (CLAUDE.md rule 3a).
const addInputStyle: React.CSSProperties = {
  flex: "1 1 200px",
  minWidth: 0,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
};

const addBtnStyle: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,0.45)",
  background: "rgba(168,85,247,0.14)",
  color: "rgba(216,180,254,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11.5,
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};
