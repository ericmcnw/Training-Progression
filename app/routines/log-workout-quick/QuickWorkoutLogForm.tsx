"use client";

import { useCallback, useMemo, useState } from "react";
import { logAdHocWorkout, createWorkoutLogExerciseOption } from "../actions";
import WorkoutExerciseEditor, {
  type ExerciseOption,
  type WorkoutBlock,
} from "../[id]/log/WorkoutExerciseEditor";
import {
  suggestQuickWorkoutPlacement,
  type QuickLogDomain,
} from "@/lib/quick-log";

type DomainOption = { value: QuickLogDomain; label: string; description: string };
type SubtypeOption = { value: string; label: string };

export default function QuickWorkoutLogForm({
  availableExercises,
  initialBlocks,
  initialDomain,
  initialSubtype,
  domainOptions,
  subtypeOptions,
  onComplete,
  onBack,
  backHref = "/routines",
}: {
  availableExercises: ExerciseOption[];
  initialBlocks: WorkoutBlock[];
  initialDomain: QuickLogDomain;
  initialSubtype: string;
  domainOptions: ReadonlyArray<DomainOption>;
  subtypeOptions: ReadonlyArray<SubtypeOption>;
  /** Drawer mode: invoked after a successful save so the host can close. */
  onComplete?: () => void;
  /** Drawer mode: invoked when the editor's back button is tapped. */
  onBack?: () => void;
  /** Page mode (or fallback): location to navigate to after save / on back. */
  backHref?: string;
}) {
  // Manual overrides — null means "let the suggestion win." Once the user
  // picks a value the manual choice sticks until they tap "Reset to auto."
  // The displayed value is derived from (manual ?? suggested) on every
  // render — no setState-in-effect plumbing required.
  const [manualDomain, setManualDomain] = useState<QuickLogDomain | null>(null);
  const [manualSubtype, setManualSubtype] = useState<string | null>(null);

  // Mirror of the editor's current exercise ids. The editor owns blocks
  // state internally; we read it via onBlocksChange to drive auto-suggest.
  const [activeExerciseIds, setActiveExerciseIds] = useState<string[]>(
    () => initialBlocks.map((b) => b.exerciseId)
  );

  // Stable callback + content-equality dedupe. Without this the editor's
  // `useEffect(..., [blocks, onBlocksChange])` re-fires on every parent
  // render (new inline closure each time) → setState → re-render → loop.
  const handleBlocksChange = useCallback((blocks: WorkoutBlock[]) => {
    const next = blocks.map((b) => b.exerciseId);
    setActiveExerciseIds((prev) => {
      if (prev.length === next.length && prev.every((id, i) => id === next[i])) {
        return prev;
      }
      return next;
    });
  }, []);

  const exerciseLibraryById = useMemo(() => {
    const map = new Map<string, ExerciseOption>();
    for (const e of availableExercises) map.set(e.id, e);
    return map;
  }, [availableExercises]);

  // Compute the suggestion fresh each render. Cheap (one pass over a small
  // array) and means the picker reacts instantly when an exercise is added
  // or removed without any synchronizing effect.
  const suggestion = useMemo(() => {
    if (activeExerciseIds.length === 0) {
      return { domain: initialDomain, subtype: initialSubtype };
    }
    const hints = activeExerciseIds
      .map((id) => exerciseLibraryById.get(id))
      .filter((e): e is ExerciseOption => Boolean(e))
      .map((e) => ({ exerciseId: e.id, libraryKind: e.libraryKind }));
    return suggestQuickWorkoutPlacement(hints);
  }, [activeExerciseIds, exerciseLibraryById, initialDomain, initialSubtype]);

  const domain: QuickLogDomain = manualDomain ?? suggestion.domain;
  const subtype: string = manualSubtype ?? suggestion.subtype;
  const domainTouched = manualDomain !== null;
  const subtypeTouched = manualSubtype !== null;

  function resetToAuto() {
    setManualDomain(null);
    setManualSubtype(null);
  }

  const anyManual = domainTouched || subtypeTouched;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={cardStyle}>
        <div style={cardHeaderRowStyle}>
          <div>
            <div style={cardTitleStyle}>Where does this count?</div>
            <div style={cardSubtitleStyle}>
              {anyManual
                ? "Your picks override the auto-suggestion. Reset to let the form re-derive from your exercises."
                : "Auto-suggested from your exercises. Drives Training Balance and frequency-goal triggers."}
            </div>
          </div>
          {anyManual ? (
            <button
              type="button"
              onClick={resetToAuto}
              style={resetBtnStyle}
              title="Clear manual overrides and re-suggest from current exercises"
            >
              Reset to auto
            </button>
          ) : null}
        </div>

        <div style={pickerRowStyle}>
          <label style={pickerCellStyle}>
            <span style={pickerLabelStyle}>
              Training category
              {!domainTouched ? <AutoTag /> : null}
            </span>
            <select
              value={domain}
              onChange={(e) => setManualDomain(e.target.value as QuickLogDomain)}
              style={pickerInputStyle}
            >
              {domainOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span style={pickerHintStyle}>
              {domainOptions.find((o) => o.value === domain)?.description}
            </span>
          </label>
          <label style={pickerCellStyle}>
            <span style={pickerLabelStyle}>
              Activity type
              {!subtypeTouched ? <AutoTag /> : null}
            </span>
            <select
              value={subtype}
              onChange={(e) => setManualSubtype(e.target.value)}
              style={pickerInputStyle}
            >
              {subtypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span style={pickerHintStyle}>
              Matches the same field on saved routines — used by frequency-goal &ldquo;activity type&rdquo; triggers.
            </span>
          </label>
        </div>
      </section>

      <WorkoutExerciseEditor
        routineId={null}
        initialNotes=""
        initialPerformedAt=""
        initialBlocks={initialBlocks}
        availableExercises={availableExercises}
        saveLabel="Save Quick Workout"
        savingLabel="Saving..."
        backHref={backHref}
        onBack={onBack}
        addExerciseTitle="Add Exercise To This Log"
        addExerciseHelp="This quick log doesn't change any saved template. Add only what you want to record today."
        createExerciseHelp="Creating here saves the exercise in your library and adds it to this log only."
        emptyStateHelp="Add one or more exercises above to build a one-off workout log."
        createExerciseOption={(params) => createWorkoutLogExerciseOption({ ...params, routineId: undefined })}
        onBlocksChange={handleBlocksChange}
        onSave={async (payload) => {
          await logAdHocWorkout({
            domain,
            subtype,
            notes: payload.notes,
            performedAtLocal: payload.performedAtLocal || undefined,
            exercises: payload.exercises,
          });
          if (onComplete) {
            onComplete();
          } else {
            window.location.href = backHref;
          }
        }}
      />
    </div>
  );
}

// Tiny "auto" tag rendered next to a picker label while it hasn't been
// manually overridden — same visual idiom as the routine-form's `(auto)`
// suffix on the Training Category dropdown.
function AutoTag() {
  return (
    <span style={autoTagStyle} aria-label="Auto-suggested from your exercises">
      auto
    </span>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 14,
  padding: "14px 16px",
  background: "rgba(128,128,128,0.04)",
  display: "grid",
  gap: 12,
};

const cardHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const cardSubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.65,
  marginTop: 3,
  lineHeight: 1.4,
};

const resetBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  border: "1px solid rgba(129,140,248,0.5)",
  borderRadius: 10,
  background: "rgba(129,140,248,0.1)",
  color: "rgb(199,210,254)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const pickerRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
};

const pickerCellStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const pickerLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  opacity: 0.65,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const pickerInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid rgba(128,128,128,0.55)",
  borderRadius: 10,
  background: "#111827",
  color: "#ffffff",
  fontSize: 16,
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const pickerHintStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  lineHeight: 1.4,
};

const autoTagStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.4,
  padding: "2px 6px",
  borderRadius: 999,
  border: "1px solid rgba(129,140,248,0.42)",
  background: "rgba(129,140,248,0.13)",
  color: "rgb(199,210,254)",
  textTransform: "uppercase",
};
