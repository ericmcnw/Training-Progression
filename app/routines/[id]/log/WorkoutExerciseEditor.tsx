"use client";

import { compareExerciseNames, condensedExerciseName, exerciseMatchesQuery, exerciseUnitFieldLabel, exerciseUnitLabel, normalizeExerciseName } from "@/lib/exercises";
import {
  type WorkoutDraft,
  clearDraftFromStorage,
  draftAgeLabel,
  draftIsRecent,
  loadDraftFromStorage,
  saveDraftToStorage,
} from "@/lib/log-draft";
import { formatPrescription, prescriptionHints, type PrescriptionShape } from "@/lib/prescription";
import { useLogDraft } from "@/app/contexts/LogDraftContext";
import { useOptionalLogDrawer } from "@/app/contexts/LogDrawerContext";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { DateTimeField, Field, FormSection, inputStyle, localDateTimeNow, textareaStyle } from "./form-ui";

export type ExerciseOption = {
  id: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  libraryKind?: "STRENGTH" | "CONDITIONING" | "MOBILITY" | "STRETCH" | "BREATHWORK" | "SKILL";
  injuryWarning?: string;
};

export type SetRow = {
  setNumber: number;
  reps?: string;
  seconds?: string;
  weightLb?: string;
  /** Client-only "confirmed" flag — drives the green done state and the
   *  per-exercise progress count. Persisted in the draft so it survives a
   *  reload, but never sent to the server (a set is saved iff it has values). */
  done?: boolean;
};

export type WorkoutBlock = {
  exerciseId: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  rows: SetRow[];
  lastRows?: SetRow[];
  lastDate?: string;
  prescription?: PrescriptionShape;
};

type SavePayload = {
  notes: string;
  performedAtLocal: string;
  effort: number | null;
  exercises: {
    exerciseId: string;
    sets: {
      setNumber: number;
      reps?: number | null;
      seconds?: number | null;
      weightLb?: number | null;
    }[];
  }[];
};

type CreateExerciseOptionFn = (params: {
  /** Empty string when this editor is hosting a quick-log flow that has
   *  no caller-side routine id — callers that wrap this in the quick-log
   *  flow ignore the value and pass `routineId: undefined` to the server
   *  action so the kind-guard is skipped. */
  routineId: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight?: boolean;
}) => Promise<ExerciseOption>;

function defaultRows(count = 3) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    setNumber: index + 1,
  }));
}

function setGridColumns(block: WorkoutBlock): string {
  return block.supportsWeight ? "32px 1fr 1fr 68px" : "32px 1fr 68px";
}

function hasCellValue(value?: string | null) {
  return value != null && String(value).trim() !== "";
}

// A row only counts as a set when it carries the exercise's primary metric
// (reps for REPS, seconds for TIME). Weight alone is not a loggable set — it's
// the difference between "confirmed & saved" and a green check that stores
// nothing. Confirm, the progress count, and save all gate on this one rule.
function rowIsLoggable(block: WorkoutBlock, row: SetRow) {
  return hasCellValue(block.unit === "REPS" ? row.reps : row.seconds);
}

// Reps/time hint: the prescribed target wins, because that's what you're meant
// to hit today. Without one, fall back to last session's same-numbered set, then
// to the set directly above in this session (carry-forward for sets added beyond
// what last time had). The history fallback does NOT chase this session's edits,
// so reps/time stay a memory of last time.
function metricSuggestionFor(block: WorkoutBlock, rowIdx: number): SetRow | undefined {
  const setNumber = block.rows[rowIdx]?.setNumber;
  const target = prescriptionHints(block.prescription);
  const targetMetric = block.unit === "REPS" ? target?.reps : target?.seconds;
  if (hasCellValue(targetMetric)) {
    return { setNumber: setNumber ?? rowIdx + 1, reps: target?.reps, seconds: target?.seconds };
  }
  const fromLast = (block.lastRows ?? []).find((r) => r.setNumber === setNumber);
  if (fromLast && (hasCellValue(fromLast.reps) || hasCellValue(fromLast.seconds))) return fromLast;
  return rowIdx > 0 ? block.rows[rowIdx - 1] : undefined;
}

// Weight hint: the nearest weight entered *this session* above this row still
// wins over the target — dropping set 1 to 75 should carry to sets 2-3 rather
// than keep insisting on the prescribed 85. Below that, target beats history.
function weightSuggestionFor(block: WorkoutBlock, rowIdx: number): string | undefined {
  for (let i = rowIdx - 1; i >= 0; i -= 1) {
    const w = block.rows[i]?.weightLb;
    if (hasCellValue(w)) return w ?? undefined;
  }
  const target = prescriptionHints(block.prescription);
  if (hasCellValue(target?.weightLb)) return target?.weightLb;
  const setNumber = block.rows[rowIdx]?.setNumber;
  const fromLast = (block.lastRows ?? []).find((r) => r.setNumber === setNumber);
  return hasCellValue(fromLast?.weightLb) ? fromLast?.weightLb : undefined;
}

// Fill a row's blank cells from the hints — weight from weightSuggestionFor, the
// primary metric from metricSuggestionFor. Never overwrites what the user typed.
function fillRowFromSuggestions(block: WorkoutBlock, rowIdx: number, row: SetRow): SetRow {
  const next: SetRow = { ...row };
  if (block.supportsWeight && !hasCellValue(next.weightLb)) {
    const w = weightSuggestionFor(block, rowIdx);
    if (w !== undefined) next.weightLb = w;
  }
  if (block.unit === "REPS" && !hasCellValue(next.reps)) {
    const hint = metricSuggestionFor(block, rowIdx);
    if (hasCellValue(hint?.reps)) next.reps = hint?.reps;
  }
  if (block.unit === "TIME" && !hasCellValue(next.seconds)) {
    const hint = metricSuggestionFor(block, rowIdx);
    if (hasCellValue(hint?.seconds)) next.seconds = hint?.seconds;
  }
  return next;
}

export default function WorkoutExerciseEditor({
  routineId,
  routineName,
  initialNotes,
  initialPerformedAt,
  initialEffort = null,
  initialBlocks,
  availableExercises,
  initialExpandedId,
  onExpandedIdChange,
  saveLabel,
  savingLabel,
  backHref,
  onBack,
  draftEnabled = false,
  addExerciseTitle = "Add Exercise To This Routine",
  addExerciseHelp = "Saving here updates the routine template too. Remove a block to remove it from the routine.",
  createExerciseHelp = "Creating here saves the exercise for future workouts and adds it to this routine now.",
  emptyStateHelp = "",
  createExerciseOption,
  onSave,
  onBlocksChange,
  bottomSlot,
}: {
  /** Null in quick-log mode — drafts are disabled and the placeholder
   *  routine is created by the save action. */
  routineId: string | null;
  routineName?: string;
  initialNotes: string;
  initialPerformedAt: string;
  initialEffort?: number | null;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  initialExpandedId?: string | null;
  onExpandedIdChange?: (expandedId: string | null) => void;
  saveLabel: string;
  savingLabel: string;
  backHref: string;
  onBack?: () => void;
  draftEnabled?: boolean;
  addExerciseTitle?: string;
  addExerciseHelp?: string;
  createExerciseHelp?: string;
  emptyStateHelp?: string;
  createExerciseOption: CreateExerciseOptionFn;
  onSave: (payload: SavePayload) => Promise<void>;
  /** Fired whenever the blocks array changes — host can read live exercise
   *  ids for things like the quick-log auto-suggest button. */
  onBlocksChange?: (blocks: WorkoutBlock[]) => void;
  bottomSlot?: ReactNode;
}) {
  const { saveDraft: contextSaveDraft, clearDraft: contextClearDraft } = useLogDraft();
  const drawer = useOptionalLogDrawer();

  const [notes, setNotes] = useState(initialNotes);
  // Effort is no longer captured on strength forms (sets/volume are the native
  // metric), but we preserve any existing stored value through edits rather
  // than wiping it. SavePayload still carries it.
  const [effort] = useState<number | null>(initialEffort);
  const [performedAtLocal, setPerformedAtLocal] = useState(initialPerformedAt || localDateTimeNow);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creatingExercise, startCreateExercise] = useTransition();
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [customUnit, setCustomUnit] = useState<"REPS" | "TIME">("REPS");
  const [customSupportsWeight, setCustomSupportsWeight] = useState(false);
  const [exerciseError, setExerciseError] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState(availableExercises);
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(initialBlocks);
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId ?? initialBlocks[0]?.exerciseId ?? null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(initialBlocks.length === 0);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Reorder long-press state — drag only engages after a deliberate hold, so
  // scrolling past the grip never starts a reorder.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gripStartY = useRef(0);
  const pendingGripId = useRef<string | null>(null);

  // Draft state
  const [draftBanner, setDraftBanner] = useState<"recent" | "older" | null>(null);
  const isDirtyRef = useRef(false);
  const draftStartedAtRef = useRef(new Date().toISOString());

  // Restore draft on mount
  useEffect(() => {
    if (!draftEnabled || !routineId) return;
    const draft = loadDraftFromStorage(routineId);
    if (!draft || draft.kind !== "WORKOUT") return;

    draftStartedAtRef.current = draft.startedAt;
    const restored = draft.blocks.map((draftBlock) => {
      const initial = initialBlocks.find((b) => b.exerciseId === draftBlock.exerciseId);
      // History and targets are server-owned — always take the fresh copy, or a
      // restored draft shows a stale (or missing) target.
      return initial
        ? {
            ...draftBlock,
            lastRows: initial.lastRows,
            lastDate: initial.lastDate,
            prescription: initial.prescription,
          }
        : draftBlock;
    });
    setBlocks(restored);
    setExpandedId((current) => current ?? restored[0]?.exerciseId ?? null);
    setNotes(draft.notes);
    setPerformedAtLocal(draft.performedAtLocal || localDateTimeNow());
    isDirtyRef.current = true;
    setDraftBanner(draftIsRecent(draft) ? "recent" : "older");
    contextSaveDraft(draft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft whenever form state changes
  useEffect(() => {
    if (!draftEnabled || !isDirtyRef.current || !routineId) return;
    const draft: WorkoutDraft = {
      kind: "WORKOUT",
      routineId,
      routineName: routineName ?? "",
      startedAt: draftStartedAtRef.current,
      notes,
      performedAtLocal,
      blocks,
      effort,
    };
    const timer = setTimeout(() => {
      saveDraftToStorage(draft);
      contextSaveDraft(draft);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, notes, performedAtLocal, effort]);

  // Bubble live blocks up to the host (used by the quick-log auto-suggest
  // button so it can read what's currently selected without owning the state).
  useEffect(() => {
    onBlocksChange?.(blocks);
  }, [blocks, onBlocksChange]);

  useEffect(() => {
    onExpandedIdChange?.(expandedId);
  }, [expandedId, onExpandedIdChange]);

  useEffect(() => {
    if (!expandedId) return;
    const target = blockRefs.current.get(expandedId);
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedId]);

  useEffect(() => () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }, []);

  const availableToAdd = useMemo(() => {
    const activeIds = new Set(blocks.map((block) => block.exerciseId));
    return exerciseOptions.filter((exercise) => {
      if (activeIds.has(exercise.id)) return false;
      return exerciseMatchesQuery(exercise.name, exerciseQuery);
    });
  }, [exerciseOptions, blocks, exerciseQuery]);

  const hasExactMatch = useMemo(() => {
    const normalizedQuery = condensedExerciseName(exerciseQuery);
    if (!normalizedQuery) return false;
    return exerciseOptions.some((exercise) => condensedExerciseName(exercise.name) === normalizedQuery);
  }, [exerciseOptions, exerciseQuery]);

  function markDirty() {
    isDirtyRef.current = true;
    drawer?.markDirty();
  }

  function advanceFocus(block: WorkoutBlock, rowIdx: number, field: "weightLb" | "reps" | "seconds") {
    const nextKey =
      field === "weightLb"
        ? `${block.exerciseId}-${rowIdx}-${block.unit === "REPS" ? "reps" : "seconds"}`
        : `${block.exerciseId}-${rowIdx + 1}-${block.supportsWeight ? "weightLb" : block.unit === "REPS" ? "reps" : "seconds"}`;
    inputRefs.current.get(nextKey)?.focus();
  }

  // Mark any typed-but-unconfirmed set in `exerciseId` as done. Fired when
  // leaving an exercise so "typed a set, moved on" still counts it — but only
  // for rows that actually carry a savable value, so a stray weight with no
  // reps never turns green (and then silently drops on save).
  function commitTypedSets(source: WorkoutBlock[], exerciseId: string | null): WorkoutBlock[] {
    if (!exerciseId) return source;
    return source.map((block) => {
      if (block.exerciseId !== exerciseId) return block;
      if (!block.rows.some((r) => rowIsLoggable(block, r) && !r.done)) return block;
      return {
        ...block,
        rows: block.rows.map((r) => (rowIsLoggable(block, r) && !r.done ? { ...r, done: true } : r)),
      };
    });
  }

  // Switch the open exercise, committing typed sets in the one being left.
  function changeExpanded(nextId: string | null, source: WorkoutBlock[] = blocks) {
    if (expandedId && expandedId !== nextId) {
      const committed = commitTypedSets(source, expandedId);
      if (committed !== source) {
        markDirty();
        setBlocks(committed);
      }
    }
    setExpandedId(nextId);
  }

  // Confirm (or un-confirm) a set. Confirming fills blank cells from the hints
  // first (weight from what you've entered this session, reps/time from the last
  // log); confirming the last set auto-advances to the next exercise. A row that
  // still has no savable value after filling is left un-confirmed — no green
  // check that saves nothing. Pure client state — no network, so it's instant.
  function confirmSet(exerciseId: string, rowIdx: number) {
    const block = blocks.find((b) => b.exerciseId === exerciseId);
    const row = block?.rows[rowIdx];
    if (!block || !row) return;

    if (row.done) {
      markDirty();
      setBlocks((prev) =>
        prev.map((b) =>
          b.exerciseId !== exerciseId
            ? b
            : { ...b, rows: b.rows.map((r, i) => (i === rowIdx ? { ...r, done: false } : r)) }
        )
      );
      return;
    }

    const filled = fillRowFromSuggestions(block, rowIdx, row);
    if (!rowIsLoggable(block, filled)) return;

    markDirty();
    const newBlocks = blocks.map((b) =>
      b.exerciseId !== exerciseId
        ? b
        : { ...b, rows: b.rows.map((r, i) => (i === rowIdx ? { ...filled, done: true } : r)) }
    );
    setBlocks(newBlocks);

    // Auto-advance only once EVERY set here is confirmed — so checking the
    // last set while a middle set is still open keeps you put instead of
    // skipping it. The exercise being "done" is the trigger, not the row.
    const updated = newBlocks.find((b) => b.exerciseId === exerciseId);
    if (updated && updated.rows.every((r) => r.done)) {
      const bi = newBlocks.findIndex((b) => b.exerciseId === exerciseId);
      changeExpanded(newBlocks[bi + 1]?.exerciseId ?? null, newBlocks);
    }
  }

  function addExercise(exerciseId: string) {
    markDirty();
    const exercise = exerciseOptions.find((item) => item.id === exerciseId);
    if (!exercise) return;
    setExpandedId(exercise.id);
    setBlocks((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        name: exercise.name,
        unit: exercise.unit,
        supportsWeight: exercise.supportsWeight,
        rows: defaultRows(),
      },
    ]);
    setExerciseQuery("");
    setExerciseError("");
    setShowAddPanel(false);
  }

  // Exercise reorder via the header grip. Pointer-based (works on touch +
  // mouse). Order is persisted to the routine template on save — logWorkout
  // writes RoutineExercise.sortOrder from the payload's exercise order, so
  // nothing server-side changes here.
  function moveBlock(fromIdx: number, toIdx: number) {
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    markDirty();
    setBlocks((prev) => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  // Drag engages only after a ~250ms hold. A quick touch or a scroll that
  // grazes the grip moves the finger, which cancels the pending hold before
  // it fires — so scrolling never starts a reorder.
  function onGripPointerDown(e: React.PointerEvent, exerciseId: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    gripStartY.current = e.clientY;
    pendingGripId.current = exerciseId;
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      if (pendingGripId.current !== exerciseId) return;
      // Don't collapse on engage — reflowing the list shifts cards out from
      // under the finger. Drag the card as-is, expanded or not.
      setDraggingId(exerciseId);
      markDirty();
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
    }, 250);
  }

  function onGripPointerMove(e: React.PointerEvent) {
    if (!draggingId) {
      // Movement before the hold fires = a scroll, not a drag → abort.
      if (Math.abs(e.clientY - gripStartY.current) > 8) cancelLongPress();
      return;
    }
    const fromIdx = blocks.findIndex((b) => b.exerciseId === draggingId);
    if (fromIdx < 0) return;
    const y = e.clientY;
    let toIdx = blocks.length - 1;
    for (let i = 0; i < blocks.length; i += 1) {
      const rect = blockRefs.current.get(blocks[i].exerciseId)?.getBoundingClientRect();
      if (!rect) continue;
      if (y < rect.top + rect.height / 2) {
        toIdx = i;
        break;
      }
    }
    if (toIdx !== fromIdx) moveBlock(fromIdx, toIdx);
  }

  function onGripPointerUp(e: React.PointerEvent) {
    cancelLongPress();
    pendingGripId.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be released
    }
    if (draggingId) setDraggingId(null);
  }

  function removeExercise(exerciseId: string) {
    markDirty();
    setBlocks((prev) => {
      const next = prev.filter((block) => block.exerciseId !== exerciseId);
      if (expandedId === exerciseId) setExpandedId(next[0]?.exerciseId ?? null);
      return next;
    });
  }

  function addRow(exerciseId: string) {
    markDirty();
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        return { ...block, rows: [...block.rows, { setNumber: block.rows.length + 1 }] };
      })
    );
  }

  function removeRow(exerciseId: string, setNumber: number) {
    markDirty();
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        const rows = block.rows
          .filter((row) => row.setNumber !== setNumber)
          .map((row, index) => ({ ...row, setNumber: index + 1 }));
        return { ...block, rows: rows.length > 0 ? rows : [{ setNumber: 1 }] };
      })
    );
  }

  function clearRow(exerciseId: string, setNumber: number) {
    markDirty();
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        return {
          ...block,
          rows: block.rows.map((row) =>
            row.setNumber === setNumber ? { setNumber: row.setNumber } : row
          ),
        };
      })
    );
  }

  // Editing a value un-confirms the set — re-tap the check to lock it back in.
  function updateCell(exerciseId: string, setNumber: number, key: keyof SetRow, value: string) {
    markDirty();
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        return {
          ...block,
          rows: block.rows.map((row) =>
            row.setNumber === setNumber ? { ...row, [key]: value, done: false } : row
          ),
        };
      })
    );
  }

  function handleStartFresh() {
    if (routineId) {
      clearDraftFromStorage(routineId);
      contextClearDraft(routineId);
    }
    setBlocks(initialBlocks);
    setNotes(initialNotes);
    setPerformedAtLocal(initialPerformedAt || localDateTimeNow());
    setExpandedId(initialExpandedId ?? initialBlocks[0]?.exerciseId ?? null);
    isDirtyRef.current = false;
    draftStartedAtRef.current = new Date().toISOString();
    setDraftBanner(null);
  }

  function handleCancel() {
    const hasData = blocks.some((b) =>
      b.rows.some((r) => r.reps || r.seconds || r.weightLb)
    );
    if (hasData && !window.confirm("Discard this session? All entered sets will be lost.")) return;
    if (routineId) {
      clearDraftFromStorage(routineId);
      contextClearDraft(routineId);
    }
    if (onBack) onBack();
    else window.location.href = backHref;
  }

  function toNumOrNull(value?: string) {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({
        notes,
        performedAtLocal,
        effort,
        exercises: blocks.map((block) => ({
          exerciseId: block.exerciseId,
          // Only send rows with the primary metric — a weight-only row is not a
          // set. Keeps volume/PR math clean and matches what the green check
          // (and the "X/Y done" count) already gate on.
          sets: block.rows
            .filter((row) => rowIsLoggable(block, row))
            .map((row) => ({
              setNumber: row.setNumber,
              reps: toNumOrNull(row.reps),
              seconds: toNumOrNull(row.seconds),
              weightLb: toNumOrNull(row.weightLb),
            })),
        })),
      });
      if (draftEnabled && routineId) {
        clearDraftFromStorage(routineId);
        contextClearDraft(routineId);
      }
    } catch (err) {
      // Surface the failure instead of silently resetting — the draft is left
      // intact so a network blip doesn't cost the user the whole session.
      setSaveError(err instanceof Error && err.message ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateExercise() {
    const name = normalizeExerciseName(exerciseQuery);
    if (!name) {
      setExerciseError("Enter an exercise name.");
      return;
    }
    setExerciseError("");
    startCreateExercise(async () => {
      try {
        const created = await createExerciseOption({
          // Quick-log mode has no routineId on the client (the action
          // creates the placeholder). Pass an empty string so the caller's
          // wrapper can map it to `undefined` for the server action.
          routineId: routineId ?? "",
          name,
          unit: customUnit,
          supportsWeight: customSupportsWeight,
        });
        setExerciseOptions((prev) => {
          if (prev.some((exercise) => exercise.id === created.id)) return prev;
          return [...prev, created].sort((a, b) => compareExerciseNames(a.name, b.name));
        });
        markDirty();
        setExpandedId(created.id);
        setBlocks((prev) => [
          ...prev,
          {
            exerciseId: created.id,
            name: created.name,
            unit: created.unit,
            supportsWeight: created.supportsWeight,
            rows: defaultRows(),
          },
        ]);
        setExerciseQuery("");
        setExerciseError("");
        setShowAddPanel(false);
      } catch (error) {
        setExerciseError(error instanceof Error ? error.message : "Could not create exercise.");
      }
    });
  }

  const sessionSummary = [
    performedAtLocal
      ? new Date(performedAtLocal).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : null,
    notes.trim() ? "has notes" : null,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="mobileListStack" style={{ display: "grid", gap: 12, width: "100%", maxWidth: 880, minWidth: 0 }}>

      {/* Draft banner */}
      {draftBanner === "recent" && (
        <div style={styles.draftBannerGreen}>
          <span>In-progress session restored · {draftAgeLabel({ startedAt: draftStartedAtRef.current } as WorkoutDraft)}</span>
          <button type="button" onClick={handleStartFresh} style={styles.draftBannerBtn}>
            Start fresh
          </button>
        </div>
      )}
      {draftBanner === "older" && (
        <div style={styles.draftBannerAmber}>
          <span>Unfinished session from {draftAgeLabel({ startedAt: draftStartedAtRef.current } as WorkoutDraft)} — continuing from draft</span>
          <button type="button" onClick={handleStartFresh} style={styles.draftBannerBtn}>
            Start fresh
          </button>
        </div>
      )}

      <DateTimeField
        value={performedAtLocal}
        onChange={(v) => { markDirty(); setPerformedAtLocal(v); }}
      />

      {/* Exercise accordion */}
      <div style={{ display: "grid", gap: 6 }}>
        {blocks.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.72, padding: "8px 4px" }}>
            {emptyStateHelp || "No exercises yet — add one below."}
          </div>
        )}

        {blocks.map((block) => {
          const isExpanded = expandedId === block.exerciseId;
          const isDragging = draggingId === block.exerciseId;
          const doneSets = block.rows.filter((r) => r.done).length;
          const targetLine = formatPrescription(block.prescription, block.unit);
          const cue = block.prescription?.cue?.trim();

          return (
            <div
              key={block.exerciseId}
              ref={(node) => {
                if (node) blockRefs.current.set(block.exerciseId, node);
                else blockRefs.current.delete(block.exerciseId);
              }}
              style={{
                ...(isExpanded ? styles.blockCardExpanded : styles.blockCard),
                ...(isDragging ? styles.blockCardDragging : null),
              }}
            >

              {/* Accordion header + reorder grip. Remove sits in the header
                  (so it works collapsed too) just left of the chevron. */}
              <div style={styles.blockHeaderRow}>
              <div
                role="button"
                aria-label="Hold and drag to reorder exercise"
                onPointerDown={(e) => onGripPointerDown(e, block.exerciseId)}
                onPointerMove={onGripPointerMove}
                onPointerUp={onGripPointerUp}
                onPointerCancel={onGripPointerUp}
                style={styles.gripHandle}
              >
                <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden>
                  <circle cx="6" cy="4" r="1.3" /><circle cx="10" cy="4" r="1.3" />
                  <circle cx="6" cy="8" r="1.3" /><circle cx="10" cy="8" r="1.3" />
                  <circle cx="6" cy="12" r="1.3" /><circle cx="10" cy="12" r="1.3" />
                </svg>
              </div>
              <button
                type="button"
                onClick={() => changeExpanded(isExpanded ? null : block.exerciseId)}
                style={{ ...styles.blockCardHeader, flex: 1 }}
              >
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{ fontWeight: 900, fontSize: 15 }}>{block.name}</div>
                  {targetLine && (
                    <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, marginTop: 3 }}>
                      {targetLine}
                    </div>
                  )}
                  <div style={{ fontSize: 11, opacity: 0.62, marginTop: 2 }}>
                    {exerciseUnitLabel(block.unit)}{block.supportsWeight ? " · Weighted" : ""}
                    {doneSets > 0
                      ? ` · ${doneSets}/${block.rows.length} done`
                      : ` · ${block.rows.length} sets`}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => removeExercise(block.exerciseId)}
                style={styles.headerRemoveBtn}
                aria-label={`Remove ${block.name}`}
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => changeExpanded(isExpanded ? null : block.exerciseId)}
                style={styles.chevronBtn}
                aria-label={isExpanded ? "Collapse exercise" : "Expand exercise"}
                aria-expanded={isExpanded}
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  width={14}
                  height={14}
                  style={{
                    opacity: 0.55,
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                >
                  <path d="M2 5l6 6 6-6" />
                </svg>
              </button>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: "4px 14px 14px" }}>

                  {cue && (
                    <details style={{ marginBottom: 10 }}>
                      <summary
                        data-collapsible-summary
                        style={{
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 700,
                          opacity: 0.75,
                          minHeight: 44,
                        }}
                      >
                        Cue
                      </summary>
                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.45, paddingBottom: 4 }}>{cue}</div>
                    </details>
                  )}

                  {/* Column headers */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: setGridColumns(block),
                      gap: 6,
                      alignItems: "center",
                      marginBottom: 6,
                      padding: "0 2px",
                    }}
                  >
                    <div style={styles.colLabel}>#</div>
                    {block.supportsWeight && <div style={styles.colLabel}>Weight lb</div>}
                    <div style={styles.colLabel}>{exerciseUnitFieldLabel(block.unit)}</div>
                    <div />
                  </div>

                  {/* Set rows */}
                  <div style={{ display: "grid", gap: 6 }}>
                    {block.rows.map((row, rowIdx) => {
                      const weightHint = weightSuggestionFor(block, rowIdx);
                      const metricHint = metricSuggestionFor(block, rowIdx);
                      const rowIsEmpty = !row.reps && !row.seconds && !row.weightLb;
                      return (
                        <SwipeableRow
                          key={row.setNumber}
                          onDelete={() => removeRow(block.exerciseId, row.setNumber)}
                        >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: setGridColumns(block),
                            gap: 6,
                            alignItems: "center",
                            borderRadius: 10,
                            padding: "2px 4px",
                            border: row.done ? "1px solid rgba(74,222,128,0.45)" : "1px solid transparent",
                            background: row.done ? "rgba(74,222,128,0.1)" : undefined,
                          }}
                        >
                          <div style={styles.setNum}>{row.setNumber}</div>

                          {block.supportsWeight && (
                            <input
                              ref={(el) => { if (el) inputRefs.current.set(`${block.exerciseId}-${rowIdx}-weightLb`, el); else inputRefs.current.delete(`${block.exerciseId}-${rowIdx}-weightLb`); }}
                              className="ghostInput"
                              style={styles.bigInput}
                              value={row.weightLb ?? ""}
                              inputMode="decimal"
                              placeholder={weightHint ?? "—"}
                              onChange={(e) => updateCell(block.exerciseId, row.setNumber, "weightLb", e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); advanceFocus(block, rowIdx, "weightLb"); } }}
                            />
                          )}

                          {block.unit === "REPS" && (
                            <input
                              ref={(el) => { if (el) inputRefs.current.set(`${block.exerciseId}-${rowIdx}-reps`, el); else inputRefs.current.delete(`${block.exerciseId}-${rowIdx}-reps`); }}
                              className="ghostInput"
                              style={styles.bigInput}
                              value={row.reps ?? ""}
                              inputMode="numeric"
                              placeholder={metricHint?.reps ?? "—"}
                              onChange={(e) => updateCell(block.exerciseId, row.setNumber, "reps", e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); advanceFocus(block, rowIdx, "reps"); } }}
                            />
                          )}

                          {block.unit === "TIME" && (
                            <input
                              ref={(el) => { if (el) inputRefs.current.set(`${block.exerciseId}-${rowIdx}-seconds`, el); else inputRefs.current.delete(`${block.exerciseId}-${rowIdx}-seconds`); }}
                              className="ghostInput"
                              style={styles.bigInput}
                              value={row.seconds ?? ""}
                              inputMode="numeric"
                              placeholder={metricHint?.seconds ?? "—"}
                              onChange={(e) => updateCell(block.exerciseId, row.setNumber, "seconds", e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); advanceFocus(block, rowIdx, "seconds"); } }}
                            />
                          )}

                          <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => confirmSet(block.exerciseId, rowIdx)}
                              style={row.done ? styles.iconBtnCheckDone : styles.iconBtnCheck}
                              title={row.done ? "Set confirmed — tap to undo" : rowIsEmpty ? "Confirm set (fills the hint)" : "Confirm set"}
                              aria-pressed={row.done}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="setRowDeleteBtn"
                              onClick={() => { if (rowIsEmpty) removeRow(block.exerciseId, row.setNumber); else clearRow(block.exerciseId, row.setNumber); }}
                              style={rowIsEmpty ? styles.iconBtnDanger : styles.iconBtn}
                              title={rowIsEmpty ? "Remove set" : "Clear this row"}
                            >
                              {rowIsEmpty ? "✕" : "⌫"}
                            </button>
                          </div>
                        </div>
                        </SwipeableRow>
                      );
                    })}
                  </div>

                  {/* Add set */}
                  <button
                    type="button"
                    onClick={() => addRow(block.exerciseId)}
                    style={styles.addSetBtn}
                  >
                    + Add Set
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add exercise panel */}
      {showAddPanel && (
        <div className="mobileCard" style={styles.addPanel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{addExerciseTitle}</div>
            <button type="button" onClick={() => setShowAddPanel(false)} style={styles.iconBtn}>✕</button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.68, marginBottom: 10 }}>{addExerciseHelp}</div>

          <input
            style={{ ...inputStyle, marginBottom: 10 }}
            value={exerciseQuery}
            onChange={(e) => setExerciseQuery(e.target.value)}
            placeholder="Search exercises…"
            autoFocus
          />

          {/* Filtered list */}
          <div style={{ display: "grid", gap: 4, maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
            {availableToAdd.slice(0, 20).map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => addExercise(exercise.id)}
                style={styles.exerciseListItem}
              >
                <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>
                    {exercise.injuryWarning ? "⚠ " : ""}{exercise.name}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 1 }}>
                    {exerciseUnitLabel(exercise.unit)}{exercise.supportsWeight ? " · Weighted" : ""}
                    {exercise.injuryWarning ? ` · loads ${exercise.injuryWarning}` : ""}
                  </div>
                </div>
                <span style={styles.addBadge}>+</span>
              </button>
            ))}
            {availableToAdd.length === 0 && exerciseQuery.trim() && (
              <div style={{ fontSize: 12, opacity: 0.65, padding: "6px 0" }}>
                No matches — create below.
              </div>
            )}
            {availableToAdd.length === 0 && !exerciseQuery.trim() && (
              <div style={{ fontSize: 12, opacity: 0.65, padding: "6px 0" }}>
                All exercises already added.
              </div>
            )}
          </div>

          {/* Create custom */}
          <div style={{ borderTop: "1px solid rgba(128,128,128,0.25)", paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82, marginBottom: 8 }}>Create Custom</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value as "REPS" | "TIME")}
                style={{ ...inputStyle, width: 130 }}
              >
                <option value="REPS">Rep-based</option>
                <option value="TIME">Timed</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={customSupportsWeight}
                  onChange={(e) => setCustomSupportsWeight(e.target.checked)}
                />
                Weighted
              </label>
              <button
                type="button"
                onClick={handleCreateExercise}
                style={styles.createBtn}
                disabled={!exerciseQuery.trim() || creatingExercise}
              >
                {creatingExercise ? "Creating…" : hasExactMatch ? "Use Match" : "Create"}
              </button>
            </div>
            <div style={{ fontSize: 11, opacity: 0.62, marginTop: 6 }}>{createExerciseHelp}</div>
            {exerciseError && (
              <div style={{ fontSize: 12, color: "#fca5a5", marginTop: 6 }}>{exerciseError}</div>
            )}
          </div>
        </div>
      )}


      <Field label={`Notes (optional)${sessionSummary ? ` - ${sessionSummary}` : ""}`}>
        <textarea
          style={{ ...textareaStyle, minHeight: 80 }}
          value={notes}
          onChange={(e) => { markDirty(); setNotes(e.target.value); }}
        />
      </Field>

      {bottomSlot}

      {saveError ? (
        <div
          role="alert"
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "rgba(252,165,165,0.98)",
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.32)",
            borderRadius: 10,
            padding: "8px 12px",
          }}
        >
          {saveError}
        </div>
      ) : null}

      {/* Action bar */}
      <div className="mobileActionRow" style={styles.stickyBar}>
        <button
          type="button"
          onClick={() => setShowAddPanel((v) => !v)}
          style={showAddPanel ? styles.addExerciseBtnActive : styles.addExerciseBtn}
        >
          {showAddPanel ? "Close Exercise Picker" : "+ Exercise"}
        </button>
        {draftEnabled && (
          <button type="button" onClick={handleCancel} style={styles.cancelBtn}>
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={styles.saveBtn}
        >
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}

// Touch swipe-to-delete for a set row. Inert on desktop (mouse fires no touch
// events). Scroll-safe: a gesture only counts as a swipe when it's decisively
// horizontal (|dx| > |dy| · 1.7 past a 14px deadzone), so a vertical scroll
// never engages it and `touch-action: pan-y` keeps the page scrolling. Swipe
// left past the threshold and release to delete; the red track shows
// "Release to delete" once you're far enough.
const SWIPE_DELETE_THRESHOLD = 96;

function SwipeableRow({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<null | "h" | "v">(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    axis.current = null;
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    const t = e.touches[0];
    const ddx = t.clientX - startX.current;
    const ddy = t.clientY - startY.current;
    if (axis.current === null) {
      if (Math.abs(ddx) < 14 && Math.abs(ddy) < 14) return;
      axis.current = Math.abs(ddx) > Math.abs(ddy) * 1.7 ? "h" : "v";
    }
    if (axis.current !== "h") return; // vertical → let the page scroll
    setDx(Math.max(-160, Math.min(0, ddx)));
  }

  function onTouchEnd() {
    const shouldDelete = axis.current === "h" && dx <= -SWIPE_DELETE_THRESHOLD;
    setDragging(false);
    axis.current = null;
    setDx(0);
    if (shouldDelete) onDelete();
  }

  const armed = dx <= -SWIPE_DELETE_THRESHOLD;
  return (
    <div
      style={{ position: "relative", overflow: "hidden", borderRadius: 10, touchAction: "pan-y" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 16,
          background: `rgba(220,38,38,${(0.3 + Math.min(1, -dx / SWIPE_DELETE_THRESHOLD) * 0.6).toFixed(2)})`,
          color: "#fff",
          fontWeight: 900,
          fontSize: 12.5,
          letterSpacing: 0.4,
          opacity: dx < 0 ? 1 : 0,
        }}
      >
        {armed ? "Release to delete" : "Delete"}
      </div>
      <div
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 160ms ease",
          position: "relative",
          background: dx !== 0 ? "var(--bg)" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const styles = {
  draftBannerGreen: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(84,203,130,0.4)",
    background: "rgba(84,203,130,0.08)",
    fontSize: 13,
    fontWeight: 700,
  } as React.CSSProperties,

  draftBannerAmber: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(251,191,36,0.4)",
    background: "rgba(251,191,36,0.07)",
    fontSize: 13,
    fontWeight: 700,
  } as React.CSSProperties,

  draftBannerBtn: {
    padding: "5px 12px",
    borderRadius: 8,
    border: "1px solid rgba(128,128,128,0.45)",
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  } as React.CSSProperties,

  utilityRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  } as React.CSSProperties,

  blockCard: {
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.28)",
    background: "rgba(128,128,128,0.05)",
    overflow: "hidden",
  } as React.CSSProperties,

  blockCardExpanded: {
    borderRadius: 12,
    border: "1px solid rgba(115,220,152,0.38)",
    background: "rgba(128,128,128,0.05)",
    overflow: "hidden",
  } as React.CSSProperties,

  blockCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "12px 14px 12px 4px",
    background: "none",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    minHeight: 0,
  } as React.CSSProperties,

  blockHeaderRow: {
    display: "flex",
    alignItems: "stretch",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
  } as React.CSSProperties,

  gripHandle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    flexShrink: 0,
    color: "rgba(255,255,255,0.4)",
    cursor: "grab",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    WebkitTapHighlightColor: "transparent",
  } as React.CSSProperties,

  blockCardDragging: {
    border: "1px solid rgba(115,220,152,0.6)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    opacity: 0.96,
  } as React.CSSProperties,

  headerRemoveBtn: {
    alignSelf: "center",
    flexShrink: 0,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(220,38,38,0.4)",
    background: "rgba(220,38,38,0.08)",
    color: "inherit",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
    whiteSpace: "nowrap",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  } as React.CSSProperties,

  chevronBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: 40,
    alignSelf: "stretch",
    padding: 0,
    background: "none",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  } as React.CSSProperties,

  colLabel: {
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.55,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  } as React.CSSProperties,

  setNum: {
    fontSize: 13,
    fontWeight: 900,
    opacity: 0.7,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  bigInput: {
    width: "100%",
    padding: "10px 6px",
    border: "1px solid rgba(128,128,128,0.5)",
    borderRadius: 10,
    background: "#111827",
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
  } as React.CSSProperties,

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid rgba(128,128,128,0.35)",
    background: "rgba(128,128,128,0.1)",
    color: "inherit",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,

  iconBtnCheck: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid rgba(128,128,128,0.4)",
    background: "rgba(128,128,128,0.08)",
    color: "rgba(255,255,255,0.45)",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  } as React.CSSProperties,

  iconBtnCheckDone: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid rgba(74,222,128,0.7)",
    background: "rgba(74,222,128,0.9)",
    color: "#07210f",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  } as React.CSSProperties,

  iconBtnDanger: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid rgba(220,38,38,0.3)",
    background: "rgba(220,38,38,0.06)",
    color: "inherit",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,

  addSetBtn: {
    marginTop: 10,
    width: "100%",
    padding: "10px",
    borderRadius: 10,
    border: "1px solid rgba(128,128,128,0.4)",
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  } as React.CSSProperties,

  addPanel: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 16,
    padding: 16,
    background: "rgba(128,128,128,0.06)",
  } as React.CSSProperties,

  exerciseListItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(128,128,128,0.22)",
    background: "rgba(128,128,128,0.06)",
    color: "inherit",
    cursor: "pointer",
    textAlign: "left",
    minHeight: 52,
  } as React.CSSProperties,

  addBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    border: "1px solid rgba(115,220,152,0.45)",
    background: "rgba(115,220,152,0.1)",
    fontWeight: 900,
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as React.CSSProperties,

  createBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid rgba(128,128,128,0.55)",
    background: "rgba(128,128,128,0.12)",
    color: "inherit",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  detailsSection: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 14,
    padding: "10px 14px",
    background: "rgba(128,128,128,0.06)",
  } as React.CSSProperties,

  detailsSummary: {
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 13,
    userSelect: "none",
  } as React.CSSProperties,

  stickyBar: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "8px 0",
  } as React.CSSProperties,

  addExerciseBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.5)",
    background: "rgba(128,128,128,0.1)",
    color: "inherit",
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,

  addExerciseBtnActive: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.5)",
    background: "rgba(128,128,128,0.22)",
    color: "inherit",
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,

  cancelBtn: {
    padding: "9px 12px",
    borderRadius: 12,
    border: "1px solid rgba(220,38,38,0.45)",
    background: "rgba(220,38,38,0.08)",
    color: "inherit",
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,

  saveBtn: {
    padding: "9px 16px",
    borderRadius: 12,
    border: "1px solid rgba(115,220,152,0.6)",
    background: "rgba(115,220,152,0.16)",
    color: "inherit",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  } as React.CSSProperties,

  backBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.5)",
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-block",
  } as React.CSSProperties,
};
