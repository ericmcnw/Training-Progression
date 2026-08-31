"use client";

// Create/edit form for a Focus + its milestones. One client component used by
// both /focus/new and /focus/[id]/edit. Saves through the single saveFocus
// action (upsert + milestone reconcile). Uses the shared form-ui tokens so it
// matches every other log form; mobile-first with a max-width column.

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { saveFocus, deleteFocus, type MilestoneFormRow } from "@/app/focus/actions";
import { inputStyle, textareaStyle, Field, FormSection, FormStack } from "@/app/routines/[id]/log/form-ui";
import type { MilestoneScopeKind, FocusStatus } from "@/generated/prisma";
import { activitiesByFamily } from "@/lib/activity-families";

export type FocusFormInitial = {
  id?: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  status: FocusStatus;
  targetDate: string; // YYYY-MM-DD or ""
  targetKind: "SOFT" | "HARD";
  season: string;
  phase: "" | "BUILD" | "PEAK" | "OFFSEASON" | "MAINTAIN";
  handoffNote: string;
  pursuitKey: string;
  linkedInjuryId: string;
  objectiveKind: "SPORT" | "STRENGTH" | "ENDURANCE" | "BODY_COMPOSITION" | "RECOVERY" | "GENERAL";
  timelineMode: "SEASON" | "DURATION" | "TARGET_DATE" | "REVIEW_DATE";
  startYmd: string;
  endYmd: string;
  reviewYmd: string;
  milestones: MilestoneFormRow[];
};

type PickItem = { id: string; name: string };
type InjuryPick = { id: string; name: string };

const COLOR_PRESETS = [
  { label: "Green", value: "#84cc78" },
  { label: "Blue", value: "#60a5fa" },
  { label: "Amber", value: "#fbbf24" },
  { label: "Violet", value: "#c084fc" },
  { label: "Orange", value: "#fb923c" },
  { label: "Red", value: "#f87171" },
];

const STATUS_OPTS: { value: FocusStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "PLANNED", label: "Planned" },
  { value: "PAUSED", label: "Paused" },
  { value: "ACHIEVED", label: "Achieved" },
  { value: "ABANDONED", label: "Abandoned" },
];

const PURSUIT_OPTIONS = [
  { value: "strength", label: "Strength" },
  { value: "endurance", label: "Endurance" },
  { value: "body-composition", label: "Body composition" },
  { value: "recovery", label: "Recovery" },
  ...activitiesByFamily("sports").map((activity) => ({ value: activity.slug, label: activity.label })),
  ...activitiesByFamily("endurance").map((activity) => ({ value: activity.slug, label: activity.label })),
];

// Local row model — adds a stable key for React (DB id or a synthetic one).
type Row = MilestoneFormRow & { key: string };
let synthCounter = 0;
function freshRow(): Row {
  synthCounter += 1;
  return { key: `new-${synthCounter}`, scopeKind: "ROUTINE", scopeRef: "", label: "", targetText: "", gateKind: "NONE" };
}

function freshOutcomeRow(pursuitKey: string): Row {
  synthCounter += 1;
  return { key: `new-${synthCounter}`, scopeKind: "CAPACITY", scopeRef: pursuitKey || "general", label: "", targetText: "", gateKind: "NONE" };
}

function milestoneFormRow(row: Row): MilestoneFormRow {
  return {
    id: row.id,
    stageId: row.stageId,
    scopeKind: row.scopeKind,
    scopeRef: row.scopeRef,
    label: row.label,
    targetText: row.targetText,
    estDurationDays: row.estDurationDays,
    gateKind: row.gateKind,
    gateNote: row.gateNote,
    gatePainThreshold: row.gatePainThreshold,
    gatePainDays: row.gatePainDays,
    gateFreqPerWeek: row.gateFreqPerWeek,
    gateFreqWeeks: row.gateFreqWeeks,
  };
}

export default function FocusForm({
  initial,
  routines,
  exercises,
  injuries = [],
  stages = [],
  embedded = false,
  panel = "all",
  initialTraining = null,
  guidedOutcomes = false,
  onBack,
  onMilestonesChange,
  submitDisabled = false,
}: {
  initial: FocusFormInitial;
  routines: PickItem[];
  exercises: PickItem[];
  injuries?: InjuryPick[];
  stages?: PickItem[];
  embedded?: boolean;
  panel?: "all" | "foundation" | "milestones" | "submit";
  initialTraining?: {
    routineIds: string[];
    goalIds: string[];
    frequencyGoalIds: string[];
    includeClimbingTickList?: boolean;
    tickListProblemIds?: string[];
    newTickListItems?: Array<{ name: string; grade: string; gradeSystem: "BOULDER_V" | "YOSEMITE"; locationId?: string }>;
  } | null;
  guidedOutcomes?: boolean;
  onBack?: () => void;
  onMilestonesChange?: (milestones: MilestoneFormRow[]) => void;
  submitDisabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState(initial.color || COLOR_PRESETS[0].value);
  const [status, setStatus] = useState<FocusStatus>(initial.status);
  const [targetDate] = useState(initial.targetDate);
  const [targetKind, setTargetKind] = useState<"SOFT" | "HARD">(initial.targetKind);
  const [season, setSeason] = useState(initial.season);
  const [phase, setPhase] = useState<FocusFormInitial["phase"]>(initial.phase);
  const [handoffNote, setHandoffNote] = useState(initial.handoffNote);
  const [pursuitKey, setPursuitKey] = useState(initial.pursuitKey);
  const [linkedInjuryId, setLinkedInjuryId] = useState(initial.linkedInjuryId);
  const [objectiveKind, setObjectiveKind] = useState(initial.objectiveKind);
  const [timelineMode, setTimelineMode] = useState(initial.timelineMode);
  const [startYmd, setStartYmd] = useState(initial.startYmd);
  const [endYmd, setEndYmd] = useState(initial.endYmd);
  const [reviewYmd, setReviewYmd] = useState(initial.reviewYmd);
  const [rows, setRows] = useState<Row[]>(
    initial.milestones.length
      ? initial.milestones.map((m, i) => ({ ...m, key: m.id ?? `init-${i}` }))
      : [freshRow()]
  );

  const isEdit = Boolean(initial.id);

  useEffect(() => {
    onMilestonesChange?.(rows.map(milestoneFormRow));
  }, [onMilestonesChange, rows]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }
  function moveRow(key: string, dir: -1 | 1) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function submit() {
    setError(null);
    const submittedName = guidedOutcomes ? initial.name : name;
    const submittedPursuitKey = guidedOutcomes ? initial.pursuitKey : pursuitKey;
    const submittedObjectiveKind = guidedOutcomes ? initial.objectiveKind : objectiveKind;
    const submittedTimelineMode = guidedOutcomes ? initial.timelineMode : timelineMode;
    const submittedEndYmd = guidedOutcomes ? initial.endYmd : endYmd;
    const submittedReviewYmd = guidedOutcomes ? initial.reviewYmd : reviewYmd;
    if (!submittedName.trim()) {
      setError("Give your program a name.");
      return;
    }
    startTransition(async () => {
      try {
        const projectionDate = submittedTimelineMode === "REVIEW_DATE"
          ? submittedReviewYmd || submittedEndYmd || (guidedOutcomes ? initial.targetDate : targetDate)
          : submittedEndYmd || (guidedOutcomes ? initial.targetDate : targetDate) || submittedReviewYmd;
        const { id } = await saveFocus({
          id: initial.id,
          name: submittedName,
          description,
          icon,
          color,
          status,
          targetDate: projectionDate,
          targetKind,
          season,
          phase,
          handoffNote,
          pursuitKey: submittedPursuitKey,
          linkedInjuryId,
          objectiveKind: submittedObjectiveKind,
          timelineMode: submittedTimelineMode,
          startYmd,
          endYmd: submittedEndYmd,
          reviewYmd: submittedReviewYmd,
          initialTraining,
          updateFoundation: panel !== "milestones",
          reconcileMilestones: panel !== "foundation" && panel !== "submit",
          milestones: rows.map((r) => ({
            id: r.id,
            stageId: r.stageId,
            scopeKind: r.scopeKind,
            scopeRef: r.scopeRef,
            label: r.label,
            targetText: r.targetText,
            estDurationDays: r.estDurationDays,
            gateKind: r.gateKind,
            gateNote: r.gateNote,
            gatePainThreshold: r.gatePainThreshold,
            gatePainDays: r.gatePainDays,
            gateFreqPerWeek: r.gateFreqPerWeek,
            gateFreqWeeks: r.gateFreqWeeks,
          })),
        });
        router.push(embedded || !initial.id ? `/programs/${id}/edit` : `/programs/${id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      }
    });
  }

  function onDelete() {
    if (!initial.id) return;
    if (!window.confirm("Delete this program and its roadmap? Training logs will be kept.")) return;
    startTransition(async () => {
      try {
        await deleteFocus(initial.id!);
        router.push("/");
        router.refresh();
      } catch {
        setError("Couldn't delete. Try again.");
      }
    });
  }

  return (
    <FormStack maxWidth="var(--app-width-content)">
      {panel !== "milestones" && panel !== "submit" ? <FormSection title={embedded ? undefined : "Direction and timeline"} unframed={embedded}>
        <Field label="Name">
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Katahdin — Knife's Edge"
            autoFocus={!isEdit}
          />
        </Field>

        <Field label="Description" hint="What is this focus, and by when?">
          <textarea
            style={textareaStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — target date, the goal, key constraints"
          />
        </Field>

        <div className="programFormGrid" style={twoCol}>
          <Field label="Objective type">
            <select style={inputStyle} value={objectiveKind} onChange={(e) => setObjectiveKind(e.target.value as FocusFormInitial["objectiveKind"])}>
              <option value="SPORT">Improve at a sport</option>
              <option value="STRENGTH">Strength or skill</option>
              <option value="ENDURANCE">Endurance</option>
              <option value="BODY_COMPOSITION">Body composition</option>
              <option value="RECOVERY">Recovery and return</option>
              <option value="GENERAL">General fitness</option>
            </select>
          </Field>
          <Field label="Sport or pursuit" hint="Links progress to its Activity">
            <select style={inputStyle} value={pursuitKey} onChange={(e) => setPursuitKey(e.target.value)}>
              <option value="">Choose one</option>
              {pursuitKey && !PURSUIT_OPTIONS.some((option) => option.value === pursuitKey) ? <option value={pursuitKey}>{pursuitKey}</option> : null}
              {PURSUIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="programFormGrid" style={twoCol}>
          <Field label="Timeline">
            <select style={inputStyle} value={timelineMode} onChange={(e) => setTimelineMode(e.target.value as FocusFormInitial["timelineMode"])}>
              <option value="SEASON">Sport season</option>
              <option value="DURATION">Fixed duration</option>
              <option value="TARGET_DATE">Target date</option>
              <option value="REVIEW_DATE">Review date</option>
            </select>
          </Field>
          <Field label="Starts">
            <input type="date" style={inputStyle} value={startYmd} onChange={(e) => setStartYmd(e.target.value)} />
          </Field>
        </div>

        <div className="programFormGrid" style={twoCol}>
          {timelineMode === "REVIEW_DATE" ? (
            <Field label="Review" hint="Reassess and decide what comes next">
              <input type="date" style={inputStyle} value={reviewYmd} onChange={(e) => setReviewYmd(e.target.value)} />
            </Field>
          ) : (
            <Field label={timelineMode === "SEASON" ? "Season ends" : "Ends"} hint="The boundary for this campaign">
              <input type="date" style={inputStyle} value={endYmd} onChange={(e) => setEndYmd(e.target.value)} />
            </Field>
          )}
          {injuries.length ? (
            <Field label="Related injury" hint="Optional">
              <select style={inputStyle} value={linkedInjuryId} onChange={(e) => setLinkedInjuryId(e.target.value)}>
                <option value="">None</option>
                {injuries.map((injury) => <option key={injury.id} value={injury.id}>{injury.name}</option>)}
              </select>
            </Field>
          ) : null}
        </div>

        <details style={advancedDetails}>
          <summary style={advancedSummary}>Appearance and advanced settings</summary>
          <div style={advancedBody}>
            <div className="programFormGrid" style={twoCol}>
              <Field label="Icon" hint="Optional">
                <input style={{ ...inputStyle, textAlign: "center" }} value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
              </Field>
              <Field label="Color">
                <div style={swatchRow}>
                  {COLOR_PRESETS.map((c) => <button key={c.value} type="button" onClick={() => setColor(c.value)} aria-label={c.label} aria-pressed={color === c.value} style={{ ...swatch, background: c.value, outline: color === c.value ? "2px solid rgba(255,255,255,0.9)" : "2px solid transparent" }} />)}
                </div>
              </Field>
            </div>
            <div className="programFormGrid" style={twoCol}>
              {timelineMode === "SEASON" ? <Field label="Season label" hint="e.g. Fall 2026"><input style={inputStyle} value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Optional" /></Field> : <div />}
              <Field label="Program status"><select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value as FocusStatus)}>{STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
            </div>
            <div className="programFormGrid" style={twoCol}>
              <Field label="Training phase"><select style={inputStyle} value={phase} onChange={(e) => setPhase(e.target.value as FocusFormInitial["phase"])}><option value="">None</option><option value="BUILD">Build</option><option value="PEAK">In season</option><option value="OFFSEASON">Offseason</option><option value="MAINTAIN">Maintain</option></select></Field>
              <Field label="Date flexibility" hint={targetKind === "HARD" ? "Fixed by an event or deadline" : "Can move with the plan"}><select style={inputStyle} value={targetKind} onChange={(e) => setTargetKind(e.target.value as "SOFT" | "HARD")}><option value="SOFT">Flexible</option><option value="HARD">Fixed</option></select></Field>
            </div>
            <Field label="What comes next" hint="Optional note for the next cycle"><input style={inputStyle} value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} placeholder="e.g. Continue into fall outdoor season" /></Field>
          </div>
        </details>
      </FormSection> : null}

      {panel !== "foundation" && panel !== "submit" ? guidedOutcomes ? (
        <GuidedOutcomesEditor
          rows={rows}
          pursuitKey={pursuitKey}
          objectiveKind={objectiveKind}
          onChange={updateRow}
          onRemove={removeRow}
          onAdd={() => setRows((previous) => [...previous, freshOutcomeRow(pursuitKey)])}
          onUseSuggestion={(label) => setRows((previous) => {
            const blankIndex = previous.findIndex((row) => !row.label.trim());
            if (blankIndex < 0) return [...previous, { ...freshOutcomeRow(pursuitKey), label }];
            return previous.map((row, index) => index === blankIndex ? { ...row, label } : row);
          })}
        />
      ) : (
        <FormSection title={embedded ? undefined : "Outcomes and milestones"} unframed={embedded}>
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((row, i) => (
              <MilestoneEditor
                key={row.key}
                row={row}
                index={i}
                total={rows.length}
                routines={routines}
                exercises={exercises}
                stages={stages}
                onChange={(patch) => updateRow(row.key, patch)}
                onRemove={() => removeRow(row.key)}
                onMove={(dir) => moveRow(row.key, dir)}
              />
            ))}
          </div>
          <button type="button" onClick={() => setRows((p) => [...p, freshRow()])} style={addBtn}>
            + Add milestone
          </button>
        </FormSection>
      ) : null}

      {error ? <div style={errorBox}>{error}</div> : null}

      <div className={guidedOutcomes ? "guidedOutcomeActions" : undefined} style={{ ...actionRow, ...(guidedOutcomes ? guidedActionRow : {}) }}>
        {isEdit && !embedded ? (
          <button type="button" onClick={onDelete} disabled={pending} style={deleteBtn}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          {onBack ? <button type="button" onClick={onBack} disabled={pending} style={cancelBtn}>Back</button> : !embedded ? <button type="button" onClick={() => router.back()} disabled={pending} style={cancelBtn}>Cancel</button> : null}
          <button type="button" onClick={submit} disabled={pending || submitDisabled} style={{ ...saveBtn, opacity: submitDisabled ? 0.45 : 1 }}>
            {pending ? "Saving…" : !isEdit ? "Create program" : panel === "foundation" ? "Save direction" : panel === "milestones" ? "Save outcomes" : "Save program"}
          </button>
        </div>
      </div>
      <style>{`@media (max-width: 640px) { .programFormGrid, .programMilestoneSource, .programMilestoneGate { grid-template-columns: minmax(0, 1fr) !important; } .guidedOutcomeActions { bottom: 76px !important; } }`}</style>
    </FormStack>
  );
}

function GuidedOutcomesEditor({
  rows,
  pursuitKey,
  objectiveKind,
  onChange,
  onRemove,
  onAdd,
  onUseSuggestion,
}: {
  rows: Row[];
  pursuitKey: string;
  objectiveKind: FocusFormInitial["objectiveKind"];
  onChange: (key: string, patch: Partial<Row>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onUseSuggestion: (label: string) => void;
}) {
  const suggestions = outcomeSuggestions(pursuitKey, objectiveKind);
  return (
    <section style={guidedOutcomeSection}>
      <header style={guidedOutcomeHeader}>
        <span style={guidedOutcomeEyebrow}>Step 4 · Destination</span>
        <h2 style={guidedOutcomeTitle}>What would make this program successful?</h2>
        <p style={guidedOutcomeCopy}>State the result you want, then add the evidence that would prove it. Training stages, routines, and progression rules come after the program exists.</p>
      </header>

      <div style={suggestionBlock}>
        <span style={suggestionLabel}>Useful starting points</span>
        <div style={suggestionList}>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => onUseSuggestion(suggestion)} style={outcomeSuggestionButton}>
              + {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div style={simpleOutcomeList}>
        {rows.map((row, index) => (
          <div key={row.key} style={{ ...simpleOutcomeCard, ...(index === 0 ? primaryOutcomeCard : {}) }}>
            <div style={simpleOutcomeHead}>
              <div>
                <span style={outcomeNumber}>{index + 1}</span>
                <strong style={simpleOutcomeTitle}>{index === 0 ? "Primary outcome" : `Supporting outcome ${index}`}</strong>
              </div>
              {rows.length > 1 ? <button type="button" onClick={() => onRemove(row.key)} style={simpleRemoveButton}>Remove</button> : null}
            </div>
            <Field label="Desired result" hint="A meaningful change, not the work you will do.">
              <input
                style={inputStyle}
                value={row.label}
                onChange={(event) => onChange(row.key, { label: event.target.value })}
                placeholder={outcomePlaceholder(pursuitKey, objectiveKind)}
              />
            </Field>
            <Field label="Evidence of success" hint="Optional. A grade, score, number, completed target, or clear condition.">
              <input
                style={inputStyle}
                value={row.targetText ?? ""}
                onChange={(event) => onChange(row.key, { targetText: event.target.value })}
                placeholder={evidencePlaceholder(pursuitKey, objectiveKind)}
              />
            </Field>
          </div>
        ))}
      </div>

      <button type="button" onClick={onAdd} style={simpleAddButton}>+ Add another outcome</button>
      <div style={laterNote}><strong>Later in the builder:</strong> connect routines and goals, organize stages, set progression gates, and schedule training. Those details should support these outcomes, not replace them.</div>
    </section>
  );
}

function outcomeSuggestions(pursuitKey: string, objectiveKind: FocusFormInitial["objectiveKind"]): string[] {
  const pursuit = pursuitKey.trim().toLowerCase();
  if (pursuit === "climbing") return ["Complete priority outdoor projects", "Improve outdoor climbing consistency", "Build repeatable finger strength", "Climb more consistently"];
  if (objectiveKind === "SPORT") return ["Improve repeatable sport performance", "Complete a named skill or target list", "Build sport-specific capacity", "Practice more consistently"];
  if (objectiveKind === "STRENGTH") return ["Reach a target load or rep result", "Complete the next skill progression", "Build repeatable working strength"];
  if (objectiveKind === "ENDURANCE") return ["Complete the target distance", "Improve pace at the same effort", "Build sustainable weekly volume"];
  if (objectiveKind === "BODY_COMPOSITION") return ["Reach the target range", "Maintain a sustainable rate of change", "Hold the result while training"];
  if (objectiveKind === "RECOVERY") return ["Settle symptoms", "Restore the missing capacity", "Return to normal training", "Return to the sport"];
  return ["Reach the primary result", "Build the capacity that supports it", "Make the result repeatable"];
}

function outcomePlaceholder(pursuitKey: string, objectiveKind: FocusFormInitial["objectiveKind"]) {
  if (pursuitKey.trim().toLowerCase() === "climbing") return "e.g. Complete my priority outdoor projects";
  if (objectiveKind === "STRENGTH") return "e.g. Build a 50 lb weighted pull-up";
  if (objectiveKind === "ENDURANCE") return "e.g. Finish a half marathon comfortably";
  if (objectiveKind === "BODY_COMPOSITION") return "e.g. Reach and maintain my target range";
  if (objectiveKind === "RECOVERY") return "e.g. Return to normal training without a flare";
  return "Describe the result you want";
}

function evidencePlaceholder(pursuitKey: string, objectiveKind: FocusFormInitial["objectiveKind"]) {
  if (pursuitKey.trim().toLowerCase() === "climbing") return "e.g. Send two named V4 projects";
  if (objectiveKind === "STRENGTH") return "e.g. 1 clean rep at +50 lb";
  if (objectiveKind === "ENDURANCE") return "e.g. 13.1 mi completed at conversational effort";
  if (objectiveKind === "BODY_COMPOSITION") return "e.g. 175-180 lb for four weeks";
  if (objectiveKind === "RECOVERY") return "e.g. full sessions with pain at or below 2/10";
  return "How will you know it happened?";
}

function MilestoneEditor({
  row,
  index,
  total,
  routines,
  exercises,
  stages,
  onChange,
  onRemove,
  onMove,
}: {
  row: Row;
  index: number;
  total: number;
  routines: PickItem[];
  exercises: PickItem[];
  stages: PickItem[];
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const scopeLabel = row.scopeKind === "ROUTINE" ? "Routine" : row.scopeKind === "EXERCISE" ? "Exercise" : "General capacity";
  return (
    <details open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)} style={milestoneCard}>
      <summary style={milestoneSummary}>
        <span style={milestoneNum}>{index + 1}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <strong style={milestoneSummaryTitle}>{row.label.trim() || "Untitled milestone"}</strong>
          <span style={milestoneSummaryMeta}>{row.targetText?.trim() || scopeLabel}</span>
        </span>
        <span aria-hidden style={{ color: "rgba(255,255,255,0.34)" }}>⌄</span>
      </summary>

      <div style={milestoneBody}>
        <div style={milestoneHead}>
          <span style={editLabel}>Edit milestone</span>
        <div style={reorderGroup}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} style={reorderBtn} aria-label="Move up">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} style={reorderBtn} aria-label="Move down">↓</button>
          <button type="button" onClick={onRemove} style={removeBtn} aria-label="Remove milestone">✕</button>
        </div>
      </div>

      <Field label="Outcome" hint="A concrete change you can recognize or measure.">
        <input style={inputStyle} value={row.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Build max finger strength" />
      </Field>

      <div className="programFormGrid programMilestoneGrid" style={milestoneGrid}>
        <Field label="Target or evidence" hint="Optional: the number, grade, hold, or condition that proves it.">
          <input style={inputStyle} value={row.targetText ?? ""} onChange={(e) => onChange({ targetText: e.target.value })} placeholder="e.g. 3×12 @ level 1" />
        </Field>
        <Field label="Estimated time" hint="Used only for roadmap estimates.">
          <div style={inputWithSuffix}>
            <input type="number" inputMode="numeric" min={1} style={{ ...inputStyle, paddingRight: 50 }} value={row.estDurationDays ?? ""} onChange={(e) => onChange({ estDurationDays: e.target.value === "" ? null : Number(e.target.value) })} placeholder="14" aria-label="Estimated days for this milestone" />
            <span style={inputSuffix}>days</span>
          </div>
        </Field>
      </div>

      <div className="programFormGrid programMilestoneGrid" style={stages.length ? milestoneGrid : oneColGrid}>
        {stages.length ? <Field label="Program stage">
          <select style={inputStyle} value={row.stageId ?? ""} onChange={(e) => onChange({ stageId: e.target.value || null })}>
            <option value="">Across the whole program</option>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </Field> : null}
        <Field label="Progress comes from" hint={row.scopeKind === "ROUTINE" ? "Logs from this routine can evaluate frequency gates." : row.scopeKind === "EXERCISE" ? "Keeps this outcome attached to a specific movement." : "Use for a capacity that is not one routine."}>
          <div className="programMilestoneSource" style={sourceGrid}>
            <select style={inputStyle} value={row.scopeKind} onChange={(e) => onChange({ scopeKind: e.target.value as MilestoneScopeKind, scopeRef: "" })}>
              <option value="ROUTINE">Routine</option>
              <option value="EXERCISE">Exercise</option>
              <option value="CAPACITY">General capacity</option>
            </select>
            {row.scopeKind === "ROUTINE" ? <select style={inputStyle} value={row.scopeRef ?? ""} onChange={(e) => onChange({ scopeRef: e.target.value })}><option value="">Choose routine</option>{routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select> : row.scopeKind === "EXERCISE" ? <select style={inputStyle} value={row.scopeRef ?? ""} onChange={(e) => onChange({ scopeRef: e.target.value })}><option value="">Choose exercise</option>{exercises.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : <input style={inputStyle} value={row.scopeRef ?? ""} onChange={(e) => onChange({ scopeRef: e.target.value })} placeholder="e.g. Descent hiking capacity" />}
          </div>
        </Field>
      </div>

      <Field label="Advance when" hint="Leave this manual unless a logged signal can honestly decide it.">
      <div className="programMilestoneGate" style={gateGrid}>
        <select
          style={inputStyle}
          value={row.gateKind ?? "NONE"}
          onChange={(e) => onChange({ gateKind: e.target.value as Row["gateKind"] })}
          aria-label="Advance gate"
        >
          <option value="NONE">No gate</option>
          <option value="FREE_TEXT">Gate: I decide</option>
          <option value="PAIN">Gate: pain ≤</option>
          <option value="FREQUENCY">Gate: frequency</option>
        </select>

        {row.gateKind === "FREQUENCY" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              step={0.5}
              style={{ ...inputStyle, width: 76 }}
              value={row.gateFreqPerWeek ?? ""}
              onChange={(e) => onChange({ gateFreqPerWeek: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="2×"
              aria-label="Sessions per week"
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>/wk for</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={8}
              style={{ ...inputStyle, width: 80 }}
              value={row.gateFreqWeeks ?? ""}
              onChange={(e) => onChange({ gateFreqWeeks: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="3 wks"
              aria-label="Weeks"
            />
          </div>
        ) : row.gateKind === "FREE_TEXT" ? (
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={row.gateNote ?? ""}
            onChange={(e) => onChange({ gateNote: e.target.value })}
            placeholder="Criteria — e.g. nerve line quiet"
          />
        ) : row.gateKind === "PAIN" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={10}
              style={{ ...inputStyle, width: 70 }}
              value={row.gatePainThreshold ?? ""}
              onChange={(e) => onChange({ gatePainThreshold: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="≤ 2"
              aria-label="Pain threshold"
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>for</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              style={{ ...inputStyle, width: 80 }}
              value={row.gatePainDays ?? ""}
              onChange={(e) => onChange({ gatePainDays: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="7 days"
              aria-label="Days"
            />
          </div>
        ) : null}
      </div>
      </Field>
      {row.gateKind === "PAIN" ? (
        <span style={scopeHint}>Auto-checks your logged readings for the linked injury. Shows &ldquo;ready to advance&rdquo; when met.</span>
      ) : row.gateKind === "FREQUENCY" ? (
        <span style={scopeHint}>Auto-checks how often you&apos;ve logged this milestone&apos;s routine. Needs a Routine scope.</span>
      ) : null}
      </div>
    </details>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const twoCol: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
  alignItems: "start",
};

const swatchRow: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", minHeight: 46 };

const swatch: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  padding: 0,
  outlineOffset: 2,
};

const advancedDetails: CSSProperties = {
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "rgba(255,255,255,0.08)",
  paddingTop: 4,
};

const advancedSummary: CSSProperties = {
  minHeight: 42,
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
  color: "rgba(255,255,255,0.58)",
  fontSize: 12,
  fontWeight: 850,
};

const advancedBody: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: "6px 0 4px",
};

const milestoneCard: CSSProperties = {
  borderRadius: 8,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.02)",
  overflow: "hidden",
};

const milestoneSummary: CSSProperties = { minHeight: 58, display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", cursor: "pointer", listStyle: "none" };
const milestoneSummaryTitle: CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, lineHeight: 1.3, fontWeight: 900 };
const milestoneSummaryMeta: CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2, fontSize: 10.5, color: "rgba(255,255,255,0.43)" };
const milestoneBody: CSSProperties = { display: "grid", gap: 14, padding: "14px 14px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.09)" };
const milestoneGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(170px, 0.65fr)", gap: 14, alignItems: "start" };
const oneColGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 };
const editLabel: CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "rgba(255,255,255,0.36)" };
const inputWithSuffix: CSSProperties = { position: "relative" };
const inputSuffix: CSSProperties = { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.4)" };
const sourceGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(120px, 0.45fr) minmax(0, 1fr)", gap: 8 };
const gateGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(160px, 0.45fr) minmax(0, 1fr)", gap: 8, alignItems: "start" };

const milestoneHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const milestoneNum: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "rgba(255,255,255,0.5)",
  letterSpacing: 0.4,
};

const reorderGroup: CSSProperties = { display: "flex", gap: 4 };

const reorderBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.7)",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "center",
  lineHeight: "30px",
};

const removeBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  width: 30,
  height: 30,
  borderRadius: 8,
  border: "1px solid rgba(248,113,113,0.3)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,160,160,0.95)",
  fontSize: 12,
  fontWeight: 800,
  textAlign: "center",
  lineHeight: "30px",
};

const scopeHint: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.42)",
  lineHeight: 1.4,
};

const addBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  textAlign: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px dashed rgba(51,255,122,0.4)",
  background: "rgba(51,255,122,0.06)",
  color: "rgba(120,235,170,0.95)",
  fontSize: 13,
  fontWeight: 800,
};

const errorBox: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.4)",
  background: "rgba(248,113,113,0.1)",
  color: "rgba(252,165,165,0.98)",
  fontSize: 12.5,
  fontWeight: 700,
};

const actionRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  paddingTop: 4,
};

const guidedActionRow: CSSProperties = {
  position: "sticky",
  bottom: 12,
  zIndex: 8,
  padding: "10px 12px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.11)",
  borderRadius: 9,
  background: "rgba(15,23,42,0.96)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
};

const saveBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "11px 20px",
  borderRadius: 11,
  background: "rgba(51,255,122,0.16)",
  border: "1px solid rgba(51,255,122,0.5)",
  color: "#33ff7a",
  fontSize: 14,
  fontWeight: 900,
  textAlign: "center",
};

const cancelBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "11px 16px",
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.7)",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "center",
};

const deleteBtn: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "11px 16px",
  borderRadius: 11,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(252,165,165,0.95)",
  fontSize: 14,
  fontWeight: 800,
  textAlign: "center",
};

const guidedOutcomeSection: CSSProperties = { display: "grid", gap: 18, width: "100%" };
const guidedOutcomeHeader: CSSProperties = { display: "grid", gap: 6, paddingBottom: 2 };
const guidedOutcomeEyebrow: CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "#7ce8aa" };
const guidedOutcomeTitle: CSSProperties = { margin: 0, fontSize: 22, lineHeight: 1.2, color: "rgba(255,255,255,0.96)" };
const guidedOutcomeCopy: CSSProperties = { maxWidth: 680, margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.55)" };
const suggestionBlock: CSSProperties = { display: "grid", gap: 8, padding: "12px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.018)" };
const suggestionLabel: CSSProperties = { fontSize: 10, fontWeight: 900, textTransform: "uppercase", color: "rgba(255,255,255,0.42)" };
const suggestionList: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7 };
const outcomeSuggestionButton: CSSProperties = { minHeight: 38, padding: "7px 10px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(51,255,122,0.22)", borderRadius: 7, background: "rgba(51,255,122,0.055)", color: "rgba(170,245,200,0.88)", fontSize: 11, fontWeight: 800, textAlign: "left", cursor: "pointer" };
const simpleOutcomeList: CSSProperties = { display: "grid", gap: 10 };
const simpleOutcomeCard: CSSProperties = { display: "grid", gap: 13, padding: "15px", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.10)", borderRadius: 8, background: "rgba(255,255,255,0.022)" };
const primaryOutcomeCard: CSSProperties = { borderColor: "rgba(51,255,122,0.28)", background: "rgba(51,255,122,0.035)" };
const simpleOutcomeHead: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const outcomeNumber: CSSProperties = { display: "inline-grid", placeItems: "center", width: 22, height: 22, marginRight: 8, borderRadius: 6, background: "rgba(51,255,122,0.11)", color: "#7ce8aa", fontSize: 10, fontWeight: 900 };
const simpleOutcomeTitle: CSSProperties = { fontSize: 13, color: "rgba(255,255,255,0.88)" };
const simpleRemoveButton: CSSProperties = { minHeight: 36, padding: "0 8px", border: 0, background: "transparent", color: "rgba(248,160,160,0.8)", fontSize: 10.5, fontWeight: 800, cursor: "pointer" };
const simpleAddButton: CSSProperties = { minHeight: 42, padding: "8px 12px", borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(51,255,122,0.34)", borderRadius: 8, background: "rgba(51,255,122,0.04)", color: "#7ce8aa", fontSize: 12, fontWeight: 900, cursor: "pointer" };
const laterNote: CSSProperties = { padding: "11px 13px", borderLeftWidth: 2, borderLeftStyle: "solid", borderLeftColor: "rgba(96,165,250,0.55)", background: "rgba(96,165,250,0.045)", color: "rgba(255,255,255,0.48)", fontSize: 11, lineHeight: 1.5 };
