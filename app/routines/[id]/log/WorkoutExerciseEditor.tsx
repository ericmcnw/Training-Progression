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
import { useLogDraft } from "@/app/contexts/LogDraftContext";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Field, inputStyle, textareaStyle } from "./form-ui";

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
};

export type WorkoutBlock = {
  exerciseId: string;
  name: string;
  unit: "REPS" | "TIME";
  supportsWeight: boolean;
  rows: SetRow[];
};

type SavePayload = {
  notes: string;
  performedAtLocal: string;
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

export default function WorkoutExerciseEditor({
  routineId,
  routineName,
  initialNotes,
  initialPerformedAt,
  initialBlocks,
  availableExercises,
  saveLabel,
  savingLabel,
  backHref,
  onBack,
  smartDefaultLabel,
  draftEnabled = false,
  addExerciseTitle = "Add Exercise To This Routine",
  addExerciseHelp = "Saving here updates the routine template too. Remove a block to remove it from the routine.",
  createExerciseHelp = "Creating here saves the exercise for future workouts and adds it to this routine now.",
  emptyStateHelp = "",
  createExerciseOption,
  onSave,
}: {
  routineId: string;
  routineName?: string;
  initialNotes: string;
  initialPerformedAt: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  saveLabel: string;
  savingLabel: string;
  backHref: string;
  onBack?: () => void;
  smartDefaultLabel?: string | null;
  draftEnabled?: boolean;
  addExerciseTitle?: string;
  addExerciseHelp?: string;
  createExerciseHelp?: string;
  emptyStateHelp?: string;
  createExerciseOption: CreateExerciseOptionFn;
  onSave: (payload: SavePayload) => Promise<void>;
}) {
  const { saveDraft: contextSaveDraft, clearDraft: contextClearDraft } = useLogDraft();

  const [notes, setNotes] = useState(initialNotes);
  const [performedAtLocal, setPerformedAtLocal] = useState(initialPerformedAt);
  const [saving, setSaving] = useState(false);
  const [creatingExercise, startCreateExercise] = useTransition();
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [customUnit, setCustomUnit] = useState<"REPS" | "TIME">("REPS");
  const [customSupportsWeight, setCustomSupportsWeight] = useState(false);
  const [exerciseError, setExerciseError] = useState("");
  const [exerciseOptions, setExerciseOptions] = useState(availableExercises);
  const [blocks, setBlocks] = useState<WorkoutBlock[]>(initialBlocks);
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);
  const [showAddPanel, setShowAddPanel] = useState(initialBlocks.length === 0);

  // Draft state
  const [draftBanner, setDraftBanner] = useState<"recent" | "older" | null>(null);
  const isDirtyRef = useRef(false);
  const draftStartedAtRef = useRef(new Date().toISOString());

  // Restore draft on mount
  useEffect(() => {
    if (!draftEnabled) return;
    const draft = loadDraftFromStorage(routineId);
    if (!draft || draft.kind !== "WORKOUT") return;

    draftStartedAtRef.current = draft.startedAt;
    setBlocks(draft.blocks);
    setNotes(draft.notes);
    setPerformedAtLocal(draft.performedAtLocal);
    isDirtyRef.current = true;
    setDraftBanner(draftIsRecent(draft) ? "recent" : "older");

    // Sync into context (for Phase 2 tray)
    contextSaveDraft(draft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft whenever form state changes
  useEffect(() => {
    if (!draftEnabled || !isDirtyRef.current) return;
    const draft: WorkoutDraft = {
      kind: "WORKOUT",
      routineId,
      routineName: routineName ?? "",
      startedAt: draftStartedAtRef.current,
      notes,
      performedAtLocal,
      blocks,
    };
    const timer = setTimeout(() => {
      saveDraftToStorage(draft);
      contextSaveDraft(draft);
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, notes, performedAtLocal]);

  const safeActiveIdx = Math.min(activeBlockIdx, Math.max(0, blocks.length - 1));
  const activeBlock = blocks[safeActiveIdx] ?? null;

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
  }

  function addExercise(exerciseId: string) {
    markDirty();
    const exercise = exerciseOptions.find((item) => item.id === exerciseId);
    if (!exercise) return;
    setActiveBlockIdx(blocks.length);
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

  function removeExercise(exerciseId: string) {
    markDirty();
    setBlocks((prev) => prev.filter((block) => block.exerciseId !== exerciseId));
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
            row.setNumber === setNumber
              ? { setNumber: row.setNumber }
              : row
          ),
        };
      })
    );
  }

  function updateCell(exerciseId: string, setNumber: number, key: keyof SetRow, value: string) {
    markDirty();
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        return {
          ...block,
          rows: block.rows.map((row) => (row.setNumber === setNumber ? { ...row, [key]: value } : row)),
        };
      })
    );
  }

  function copyPrevSet(exerciseId: string, setNumber: number) {
    markDirty();
    setBlocks((prev) =>
      prev.map((block) => {
        if (block.exerciseId !== exerciseId) return block;
        const rowIdx = block.rows.findIndex((r) => r.setNumber === setNumber);
        if (rowIdx <= 0) return block;
        const prev_row = block.rows[rowIdx - 1];
        return {
          ...block,
          rows: block.rows.map((row, i) =>
            i === rowIdx
              ? { ...row, weightLb: prev_row.weightLb, reps: prev_row.reps, seconds: prev_row.seconds }
              : row
          ),
        };
      })
    );
  }

  function handleStartFresh() {
    clearDraftFromStorage(routineId);
    contextClearDraft(routineId);
    setBlocks(initialBlocks);
    setNotes(initialNotes);
    setPerformedAtLocal(initialPerformedAt);
    isDirtyRef.current = false;
    draftStartedAtRef.current = new Date().toISOString();
    setDraftBanner(null);
  }

  function toNumOrNull(value?: string) {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        notes,
        performedAtLocal,
        exercises: blocks.map((block) => ({
          exerciseId: block.exerciseId,
          sets: block.rows.map((row) => ({
            setNumber: row.setNumber,
            reps: toNumOrNull(row.reps),
            seconds: toNumOrNull(row.seconds),
            weightLb: toNumOrNull(row.weightLb),
          })),
        })),
      });
      // Clear draft on successful save
      if (draftEnabled) {
        clearDraftFromStorage(routineId);
        contextClearDraft(routineId);
      }
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
          routineId,
          name,
          unit: customUnit,
          supportsWeight: customSupportsWeight,
        });
        setExerciseOptions((prev) => {
          if (prev.some((exercise) => exercise.id === created.id)) return prev;
          return [...prev, created].sort((a, b) => compareExerciseNames(a.name, b.name));
        });
        markDirty();
        setActiveBlockIdx(blocks.length);
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
    .join(" · ");

  // Count logged sets per block (has at least one non-empty value)
  function countLoggedSets(block: WorkoutBlock): number {
    return block.rows.filter(
      (r) => (r.reps ?? r.seconds ?? r.weightLb ?? "").toString().trim() !== ""
    ).length;
  }

  return (
    <div className="mobileListStack" style={{ display: "grid", gap: 16, width: "100%", maxWidth: 880, minWidth: 0 }}>

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

      {/* Exercise blocks card */}
      <div className="mobileCard" style={styles.blocksCard}>

        {/* Tab bar */}
        {blocks.length > 0 && (
          <div style={styles.tabBar}>
            {blocks.map((block, idx) => {
              const loggedSets = countLoggedSets(block);
              const label = block.name.length > 18 ? block.name.slice(0, 16) + "…" : block.name;
              return (
                <button
                  key={block.exerciseId}
                  type="button"
                  onClick={() => setActiveBlockIdx(idx)}
                  style={safeActiveIdx === idx ? styles.tabActive : styles.tab}
                >
                  {label}
                  {loggedSets > 0 && (
                    <span style={safeActiveIdx === idx ? styles.tabBadgeActive : styles.tabBadge}>
                      {loggedSets}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {blocks.length === 0 && (
          <div style={{ fontSize: 13, opacity: 0.72, padding: "4px 0 8px" }}>
            {emptyStateHelp || "No exercises yet — add one below."}
          </div>
        )}

        {/* Active block */}
        {activeBlock && (
          <div style={{ marginTop: blocks.length > 0 ? 14 : 0 }}>

            {/* Block header */}
            <div style={styles.blockHeader}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{activeBlock.name}</div>
                <div style={{ fontSize: 12, opacity: 0.68, marginTop: 3 }}>
                  {exerciseUnitLabel(activeBlock.unit)}{activeBlock.supportsWeight ? " · Weighted" : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeExercise(activeBlock.exerciseId)}
                style={styles.removeBtn}
              >
                Remove
              </button>
            </div>

            {/* Prefill hint */}
            {smartDefaultLabel && !draftBanner && (
              <div style={styles.prefillHint}>{smartDefaultLabel}</div>
            )}

            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: setGridColumns(activeBlock),
                gap: 6,
                alignItems: "center",
                marginBottom: 6,
                padding: "0 2px",
              }}
            >
              <div style={styles.colLabel}>#</div>
              {activeBlock.supportsWeight && <div style={styles.colLabel}>Weight lb</div>}
              <div style={styles.colLabel}>{exerciseUnitFieldLabel(activeBlock.unit)}</div>
              <div />
            </div>

            {/* Set rows */}
            <div style={{ display: "grid", gap: 6 }}>
              {activeBlock.rows.map((row, rowIdx) => (
                <div
                  key={row.setNumber}
                  style={{
                    display: "grid",
                    gridTemplateColumns: setGridColumns(activeBlock),
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <div style={styles.setNum}>{row.setNumber}</div>

                  {activeBlock.supportsWeight && (
                    <input
                      style={styles.bigInput}
                      value={row.weightLb ?? ""}
                      inputMode="decimal"
                      placeholder="—"
                      onChange={(e) => updateCell(activeBlock.exerciseId, row.setNumber, "weightLb", e.target.value)}
                    />
                  )}

                  {activeBlock.unit === "REPS" && (
                    <input
                      style={styles.bigInput}
                      value={row.reps ?? ""}
                      inputMode="numeric"
                      placeholder="—"
                      onChange={(e) => updateCell(activeBlock.exerciseId, row.setNumber, "reps", e.target.value)}
                    />
                  )}

                  {activeBlock.unit === "TIME" && (
                    <input
                      style={styles.bigInput}
                      value={row.seconds ?? ""}
                      inputMode="numeric"
                      placeholder="—"
                      onChange={(e) => updateCell(activeBlock.exerciseId, row.setNumber, "seconds", e.target.value)}
                    />
                  )}

                  <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                    {rowIdx > 0 && (
                      <button
                        type="button"
                        onClick={() => copyPrevSet(activeBlock.exerciseId, row.setNumber)}
                        style={styles.iconBtn}
                        title="Copy set above"
                      >
                        ↑
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => clearRow(activeBlock.exerciseId, row.setNumber)}
                      style={styles.iconBtn}
                      title="Clear this row"
                    >
                      ⌫
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(activeBlock.exerciseId, row.setNumber)}
                      style={styles.iconBtnDanger}
                      title="Remove set"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add set */}
            <button
              type="button"
              onClick={() => addRow(activeBlock.exerciseId)}
              style={styles.addSetBtn}
            >
              + Add Set
            </button>
          </div>
        )}
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

      {/* Session details — collapsible */}
      <details style={styles.detailsSection}>
        <summary style={styles.detailsSummary}>
          Log details{sessionSummary ? ` · ${sessionSummary}` : ""}
        </summary>
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <Field label="Performed at (leave blank for now)">
            <input
              type="datetime-local"
              style={inputStyle}
              value={performedAtLocal}
              onChange={(e) => { markDirty(); setPerformedAtLocal(e.target.value); }}
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              style={{ ...textareaStyle, minHeight: 80 }}
              value={notes}
              onChange={(e) => { markDirty(); setNotes(e.target.value); }}
            />
          </Field>
        </div>
      </details>

      {/* Sticky action bar */}
      <div className="mobileStickyActions" style={styles.stickyBar}>
        <button
          type="button"
          onClick={() => setShowAddPanel((v) => !v)}
          style={showAddPanel ? styles.addExerciseBtnActive : styles.addExerciseBtn}
        >
          {showAddPanel ? "Close" : "+ Exercise"}
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={styles.saveBtn}
        >
          {saving ? savingLabel : saveLabel}
        </button>
        {onBack ? (
          <button type="button" onClick={onBack} style={styles.backBtn}>Back</button>
        ) : (
          <Link href={backHref} style={styles.backBtn}>Back</Link>
        )}
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

  prefillHint: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 10,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(84,203,130,0.28)",
    background: "rgba(84,203,130,0.06)",
  } as React.CSSProperties,

  blocksCard: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(128,128,128,0.06)",
    minWidth: 0,
  } as React.CSSProperties,

  tabBar: {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    overflowY: "visible",
    paddingBottom: 6,
    marginBottom: -2,
    width: "100%",
  } as React.CSSProperties,

  tab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 20,
    border: "1px solid rgba(128,128,128,0.35)",
    background: "rgba(128,128,128,0.1)",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
    color: "inherit",
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  tabActive: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 20,
    border: "1px solid rgba(115,220,152,0.55)",
    background: "rgba(115,220,152,0.18)",
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: "nowrap",
    color: "inherit",
    cursor: "pointer",
    flexShrink: 0,
  } as React.CSSProperties,

  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    background: "rgba(128,128,128,0.3)",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  } as React.CSSProperties,

  tabBadgeActive: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    background: "rgba(115,220,152,0.35)",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
  } as React.CSSProperties,

  blockHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
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

  removeBtn: {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid rgba(220,38,38,0.4)",
    background: "rgba(220,38,38,0.08)",
    color: "inherit",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
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
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "10px 0",
  } as React.CSSProperties,

  addExerciseBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.5)",
    background: "rgba(128,128,128,0.1)",
    color: "inherit",
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,

  addExerciseBtnActive: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.5)",
    background: "rgba(128,128,128,0.22)",
    color: "inherit",
    fontWeight: 800,
    cursor: "pointer",
  } as React.CSSProperties,

  saveBtn: {
    padding: "10px 22px",
    borderRadius: 12,
    border: "1px solid rgba(115,220,152,0.6)",
    background: "rgba(115,220,152,0.16)",
    color: "inherit",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  } as React.CSSProperties,

  backBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid rgba(128,128,128,0.5)",
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-block",
  } as React.CSSProperties,
};
