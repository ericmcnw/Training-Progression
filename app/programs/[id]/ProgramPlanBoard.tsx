"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type React from "react";
import { Field, inputStyle, pillButtonStyle } from "@/app/routines/[id]/log/form-ui";
import {
  addExerciseToRoutineAndPlan,
  addPlanItem,
  clearPlanTarget,
  endPlanItem,
  fillPlan,
  nudgePlanWeek,
  setPlanTarget,
  updatePlanItem,
  type PlanActionResult,
  type PlanFillKind,
  type PlanTargetInput,
} from "@/app/programs/plan-actions";
import type { PlanBoard, PlanBoardCandidate, PlanBoardGroup, PlanBoardItem, PlanCell } from "@/app/programs/plan-data";

type Run = (action: () => Promise<PlanActionResult>, after?: () => void) => void;

const PHASE_END_LABEL: Record<PlanBoardItem["phaseEnd"], string> = {
  ASK: "Ask me",
  KEEP: "Keep going",
  DROP: "Stop it",
};

export default function ProgramPlanBoard({ programId, board }: { programId: string; board: PlanBoard }) {
  const [selected, setSelected] = useState<{ itemId: string; week: number } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run: Run = (action, after) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else after?.();
    });
  };

  if (board.groups.length === 0) {
    return <p style={introText}>Link a routine to this program, then plan the exercises you want to push.</p>;
  }

  return (
    <div style={stack}>
      <p style={introText}>
        Plan only what you want to push. Each week carries forward until you change a later one. A week moves on once you hit its target; miss it or skip it and the plan waits for you.
      </p>

      {error ? <div role="alert" style={errorBox}>{error}</div> : null}

      {board.groups.map((group) => (
        <section key={group.key} style={groupSection}>
          <div style={groupHead}>
            <h2 style={groupTitle}>{group.title}</h2>
            {group.candidates.length || group.routineId ? (
              <button type="button" onClick={() => setAdding(adding === group.key ? null : group.key)} style={pillButtonStyle} aria-expanded={adding === group.key}>
                {adding === group.key ? "Done" : addLabel(group)}
              </button>
            ) : null}
          </div>

          {adding === group.key ? (
            <AddPanel programId={programId} group={group} library={board.library} pending={pending} run={run} />
          ) : null}

          {group.items.length === 0 && adding !== group.key ? <p style={muted}>{emptyCopy(group)}</p> : null}

          {group.items.map((item) => (
            <PlanItemCard
              key={item.id}
              item={item}
              selectedWeek={selected?.itemId === item.id ? selected.week : null}
              onSelect={(week) => setSelected(week == null ? null : { itemId: item.id, week })}
              pending={pending}
              run={run}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function addLabel(group: PlanBoardGroup) {
  if (group.kind === "ACTIVITY") return "+ Plan an activity";
  if (group.kind === "SPORT") return "+ Plan a sport";
  return "+ Plan an exercise";
}

function emptyCopy(group: PlanBoardGroup) {
  if (group.kind === "ACTIVITY") return "No runs or walks planned. Unplanned sessions still count toward your goals.";
  if (group.kind === "SPORT") return "No sport sessions planned.";
  return "Nothing planned here. Unplanned exercises keep using last time's numbers.";
}

function AddPanel({
  programId,
  group,
  library,
  pending,
  run,
}: {
  programId: string;
  group: PlanBoardGroup;
  library: PlanBoard["library"];
  pending: boolean;
  run: Run;
}) {
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");
  const inRoutine = useMemo(() => new Set(group.candidates.map((c) => c.key)), [group.candidates]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return library.filter((e) => e.name.toLowerCase().includes(q) && !inRoutine.has(e.id)).slice(0, 8);
  }, [library, query, inRoutine]);

  const plan = (candidate: PlanBoardCandidate) => {
    if (candidate.kind === "EXERCISE") return addPlanItem(programId, { kind: "EXERCISE", exerciseId: candidate.exerciseId, routineId: group.routineId });
    if (candidate.kind === "ACTIVITY") {
      return addPlanItem(programId, {
        kind: "ACTIVITY",
        activityTypeId: candidate.activityTypeId,
        enduranceFamilyId: candidate.enduranceFamilyId,
        label: label || null,
      });
    }
    return addPlanItem(programId, { kind: "SPORT", sportSlug: candidate.sportSlug, label: label || null });
  };

  return (
    <div style={addPanel}>
      {group.kind !== "EXERCISE" ? (
        <Field label="Name it (optional)" hint={group.kind === "ACTIVITY" ? "e.g. Long run, Easy runs" : "e.g. Limit days"}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} maxLength={60} />
        </Field>
      ) : null}
      {group.candidates.length ? (
        <ul style={candidateList}>
          {group.candidates.map((candidate) => (
            <li key={candidate.key} style={candidateRow}>
              <div style={{ minWidth: 0 }}>
                <div style={candidateName}>{candidate.name}</div>
                <div style={muted}>{candidate.plannedElsewhere ? `Planned in ${candidate.plannedElsewhere}` : candidate.lastLabel}</div>
              </div>
              <button
                type="button"
                disabled={pending || Boolean(candidate.plannedElsewhere)}
                onClick={() => run(() => plan(candidate), () => setLabel(""))}
                style={pillButtonStyle}
              >
                Plan
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {group.kind === "EXERCISE" && group.routineId ? (
        <Field label="Something new" hint={`Adds it to ${group.title} and plans it.`}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" style={inputStyle} />
        </Field>
      ) : null}
      {matches.length ? (
        <ul style={candidateList}>
          {matches.map((exercise) => (
            <li key={exercise.id} style={candidateRow}>
              <div style={candidateName}>{exercise.name}</div>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => addExerciseToRoutineAndPlan(programId, group.routineId!, exercise.id), () => setQuery(""))}
                style={pillButtonStyle}
              >
                Add + plan
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function fillsFor(item: PlanBoardItem): Array<{ label: string; kind: PlanFillKind; step: number }> {
  const current = item.cells.find((c) => c.tone === "now")?.target;
  if (item.kind === "SPORT") return [{ label: "+1 session a week", kind: "sessions", step: 1 }];
  if (item.kind === "ACTIVITY") {
    return [
      ...(current?.distanceMi != null ? [{ label: "+0.5 mi a week", kind: "distanceMi" as const, step: 0.5 }] : []),
      ...(current?.durationSec != null ? [{ label: "+5 min a week", kind: "durationSec" as const, step: 300 }] : []),
    ];
  }
  return [
    ...(item.supportsWeight ? [{ label: "+5 lb a week", kind: "weightLb" as const, step: 5 }] : []),
    item.unit === "TIME" ? { label: "+5 s a week", kind: "seconds" as const, step: 5 } : { label: "+1 rep a week", kind: "reps" as const, step: 1 },
  ];
}

function PlanItemCard({
  item,
  selectedWeek,
  onSelect,
  pending,
  run,
}: {
  item: PlanBoardItem;
  selectedWeek: number | null;
  onSelect: (week: number | null) => void;
  pending: boolean;
  run: Run;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(item.hasCustomLabel ? item.name : "");
  const selectedCell = item.cells.find((cell) => cell.week != null && cell.week === selectedWeek) ?? null;

  useEffect(() => {
    const strip = stripRef.current;
    const now = strip?.querySelector<HTMLElement>("[data-now]");
    if (strip && now) strip.scrollLeft = Math.max(0, now.offsetLeft - strip.offsetLeft - 60);
  }, []);

  return (
    <article style={card}>
      <div style={cardHead}>
        <div style={{ minWidth: 0 }}>
          <h3 style={itemName}>{item.name}</h3>
          {item.serves ? <div style={servesLine}>serves → {item.serves}</div> : null}
          <div style={{ ...statusLine, color: STATUS_COLOR[item.statusTone] }}>{item.status}</div>
        </div>
        <span style={weekChip}>Wk {item.week}</span>
      </div>

      <div ref={stripRef} style={strip}>
        {item.cells.map((cell) =>
          cell.week != null ? (
            <button
              key={cell.key}
              type="button"
              data-now={cell.tone === "now" ? "" : undefined}
              aria-pressed={selectedWeek === cell.week}
              aria-label={`${cell.label}: ${cell.value}. Edit this week's target.`}
              onClick={() => onSelect(selectedWeek === cell.week ? null : cell.week)}
              style={cellStyle(cell, selectedWeek === cell.week)}
            >
              <CellBody cell={cell} />
            </button>
          ) : (
            <div key={cell.key} style={cellStyle(cell, false)}>
              <CellBody cell={cell} />
            </div>
          ),
        )}
      </div>

      {selectedCell && selectedWeek != null ? (
        <TargetEditor
          key={`${item.id}-${selectedWeek}`}
          item={item}
          week={selectedWeek}
          cell={selectedCell}
          pending={pending}
          onSave={(values) => run(() => setPlanTarget(item.id, selectedWeek, values), () => onSelect(null))}
          onClear={
            selectedWeek > 1 && item.explicitWeeks.includes(selectedWeek)
              ? () => run(() => clearPlanTarget(item.id, selectedWeek), () => onSelect(null))
              : null
          }
        />
      ) : null}

      <details style={options}>
        <summary style={optionsSummary}>Plan options</summary>
        <div style={optionsBody}>
          {fillsFor(item).length ? (
            <div style={optionRow}>
              {fillsFor(item).map((fill) => (
                <button key={fill.kind} type="button" disabled={pending} onClick={() => run(() => fillPlan(item.id, fill.kind, fill.step, 4))} style={pillButtonStyle}>
                  {fill.label} · next 4
                </button>
              ))}
            </div>
          ) : null}

          {item.kind !== "EXERCISE" ? (
            <form
              style={inlineForm}
              onSubmit={(e) => {
                e.preventDefault();
                run(() => updatePlanItem(item.id, { label: name }));
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this lane" aria-label="Lane name" style={{ ...inputStyle, flex: 1 }} maxLength={60} />
              <button type="submit" disabled={pending} style={pillButtonStyle}>Rename</button>
            </form>
          ) : null}

          <div style={phaseEndRow}>
            <span style={muted}>When this phase ends</span>
            <div style={segmented} role="radiogroup" aria-label="When this phase ends">
              {(["ASK", "KEEP", "DROP"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={item.phaseEnd === value}
                  disabled={pending}
                  onClick={() => run(() => updatePlanItem(item.id, { phaseEnd: value }))}
                  style={{ ...segment, ...(item.phaseEnd === value ? segmentOn : null) }}
                >
                  {PHASE_END_LABEL[value]}
                </button>
              ))}
            </div>
          </div>

          <div style={optionRow}>
            <button type="button" disabled={pending} onClick={() => run(() => nudgePlanWeek(item.id, 1))} style={pillButtonStyle}>Move on now</button>
            <button type="button" disabled={pending || item.week <= 1} onClick={() => run(() => nudgePlanWeek(item.id, -1))} style={pillButtonStyle}>Back a week</button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Stop planning ${item.name}? Its logs stay.`)) run(() => endPlanItem(item.id));
              }}
              style={{ ...pillButtonStyle, color: "#ffb4a8" }}
            >
              Stop planning
            </button>
          </div>
        </div>
      </details>
    </article>
  );
}

function CellBody({ cell }: { cell: PlanCell }) {
  return (
    <>
      <span style={cellLabel}>{cell.label}</span>
      <span style={cellValue}>{cell.value}</span>
      {cell.tag ? <span style={{ ...cellTag, color: TAG_COLOR[cell.tone] }}>{cell.tag}</span> : null}
    </>
  );
}

const str = (value: number | null | undefined) => (value != null ? String(value) : "");

function TargetEditor({
  item,
  week,
  cell,
  pending,
  onSave,
  onClear,
}: {
  item: PlanBoardItem;
  week: number;
  cell: PlanCell;
  pending: boolean;
  onSave: (values: PlanTargetInput) => void;
  onClear: (() => void) | null;
}) {
  const start = cell.target;
  const [values, setValues] = useState({
    sets: str(start?.sets),
    reps: str(start?.reps),
    seconds: str(start?.seconds),
    weightLb: str(start?.weightLb),
    distanceMi: str(start?.distanceMi),
    durationMin: start?.durationSec != null ? String(Math.round(start.durationSec / 60)) : "",
    sessions: str(start?.sessions),
    note: start?.note ?? "",
  });
  const [params, setParams] = useState<Record<string, string>>(
    Object.fromEntries(item.paramFields.map((f) => [f.key, str(start?.params?.[f.key])])),
  );
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const bump = (key: keyof typeof values, by: number) =>
    setValues((v) => ({ ...v, [key]: String(Math.max(0, Math.round(((Number(v[key]) || 0) + by) * 10) / 10)) }));
  const timed = item.unit === "TIME";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (item.kind === "EXERCISE") {
      onSave({
        sets: values.sets,
        reps: timed ? "" : values.reps,
        seconds: timed ? values.seconds : "",
        weightLb: item.supportsWeight ? values.weightLb : "",
        params,
      });
    } else if (item.kind === "ACTIVITY") {
      onSave({ distanceMi: values.distanceMi, durationMin: values.durationMin, sessions: values.sessions, note: values.note });
    } else {
      onSave({ sessions: values.sessions, note: values.note });
    }
  };

  return (
    <form style={editor} onSubmit={submit}>
      <div style={editorTitle}>
        {cell.label === "This week" ? "This week" : `Week of ${cell.label}`} · plan week {week}
      </div>

      {item.kind === "EXERCISE" ? (
        <>
          <div style={editorGrid}>
            <Field label="Sets"><input inputMode="numeric" value={values.sets} onChange={set("sets")} style={inputStyle} /></Field>
            {timed ? (
              <Field label="Seconds"><input inputMode="numeric" value={values.seconds} onChange={set("seconds")} style={inputStyle} /></Field>
            ) : (
              <Field label="Reps"><input inputMode="numeric" value={values.reps} onChange={set("reps")} style={inputStyle} /></Field>
            )}
            {item.supportsWeight ? (
              <Field label="Weight lb"><input inputMode="decimal" value={values.weightLb} onChange={set("weightLb")} style={inputStyle} /></Field>
            ) : null}
            {item.paramFields.map((field) => (
              <Field key={field.key} label={`${field.label} ${field.unit}`}>
                <input
                  inputMode="decimal"
                  value={params[field.key] ?? ""}
                  onChange={(e) => setParams((p) => ({ ...p, [field.key]: e.target.value }))}
                  style={inputStyle}
                />
              </Field>
            ))}
          </div>
          <div style={optionRow}>
            {item.supportsWeight ? <button type="button" onClick={() => bump("weightLb", 5)} style={pillButtonStyle}>+5 lb</button> : null}
            {timed ? (
              <button type="button" onClick={() => bump("seconds", 5)} style={pillButtonStyle}>+5 s</button>
            ) : (
              <button type="button" onClick={() => bump("reps", 1)} style={pillButtonStyle}>+1 rep</button>
            )}
            <button type="button" onClick={() => bump("sets", 1)} style={pillButtonStyle}>+1 set</button>
          </div>
        </>
      ) : item.kind === "ACTIVITY" ? (
        <>
          <div style={editorGrid}>
            <Field label="Distance mi"><input inputMode="decimal" value={values.distanceMi} onChange={set("distanceMi")} style={inputStyle} /></Field>
            <Field label="Minutes"><input inputMode="numeric" value={values.durationMin} onChange={set("durationMin")} style={inputStyle} /></Field>
            <Field label="Sessions"><input inputMode="numeric" value={values.sessions} onChange={set("sessions")} style={inputStyle} /></Field>
          </div>
          <div style={optionRow}>
            <button type="button" onClick={() => bump("distanceMi", 0.5)} style={pillButtonStyle}>+0.5 mi</button>
            <button type="button" onClick={() => bump("durationMin", 5)} style={pillButtonStyle}>+5 min</button>
            <button type="button" onClick={() => bump("sessions", 1)} style={pillButtonStyle}>+1 session</button>
          </div>
          <Field label="Note" hint="e.g. flat trail, walk the descents">
            <input value={values.note} onChange={set("note")} style={inputStyle} maxLength={140} />
          </Field>
        </>
      ) : (
        <>
          <div style={editorGrid}>
            <Field label="Sessions a week"><input inputMode="numeric" value={values.sessions} onChange={set("sessions")} style={inputStyle} /></Field>
          </div>
          <Field label="Focus" hint="e.g. one limit day: 4 tries on V5">
            <input value={values.note} onChange={set("note")} style={inputStyle} maxLength={140} />
          </Field>
        </>
      )}

      <p style={muted}>
        {item.kind === "EXERCISE"
          ? "Applies from this week on, until a later week changes it."
          : "Each session must reach the distance or time; the week counts once you have enough sessions. Applies from this week on."}
      </p>
      <div style={optionRow}>
        <button type="submit" disabled={pending} style={saveButton}>Save</button>
        {onClear ? (
          <button type="button" disabled={pending} onClick={onClear} style={pillButtonStyle}>Same as the week before</button>
        ) : null}
      </div>
    </form>
  );
}

const STATUS_COLOR: Record<PlanBoardItem["statusTone"], string> = {
  up: "#7ce8aa",
  held: "#f5c46a",
  away: "#f5c46a",
  done: "rgba(255,255,255,0.62)",
  same: "rgba(255,255,255,0.7)",
};

const TAG_COLOR: Record<PlanCell["tone"], string> = {
  met: "#7ce8aa",
  held: "#f5c46a",
  now: "#7ce8aa",
  up: "#7ce8aa",
  down: "#a9cbff",
  same: "rgba(255,255,255,0.6)",
  new: "#a9cbff",
};

function cellStyle(cell: PlanCell, isSelected: boolean): React.CSSProperties {
  const tone: Record<PlanCell["tone"], React.CSSProperties> = {
    met: { background: "rgba(255,255,255,0.025)", borderColor: "rgba(51,255,122,0.22)" },
    held: { background: "rgba(245,185,74,0.07)", borderColor: "rgba(245,185,74,0.4)" },
    now: { background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.85)" },
    up: { background: "rgba(51,255,122,0.07)", borderColor: "rgba(51,255,122,0.4)" },
    down: { background: "rgba(124,179,255,0.08)", borderColor: "rgba(124,179,255,0.45)" },
    same: { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)" },
    new: { background: "rgba(124,179,255,0.08)", borderColor: "rgba(124,179,255,0.45)" },
  };
  return {
    ...cellBase,
    ...tone[cell.tone],
    ...(cell.week != null ? { cursor: "pointer" } : { opacity: 0.85 }),
    ...(isSelected ? { boxShadow: "0 0 0 2px #33ff7a" } : null),
  };
}

const stack: React.CSSProperties = { display: "grid", gap: 18, minWidth: 0 };
const introText: React.CSSProperties = { margin: 0, padding: "4px 2px", fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.68)", maxWidth: 640 };
const errorBox: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,120,100,0.5)", background: "rgba(255,120,100,0.1)", fontSize: 13 };
const groupSection: React.CSSProperties = { display: "grid", gap: 10, minWidth: 0 };
const groupHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const groupTitle: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 900 };
const muted: React.CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.6)" };
const addPanel: React.CSSProperties = { display: "grid", gap: 10, padding: 10, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" };
const candidateList: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4, maxHeight: 360, overflowY: "auto" };
const candidateRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "4px 2px" };
const candidateName: React.CSSProperties = { fontSize: 14, fontWeight: 800 };
const card: React.CSSProperties = { display: "grid", gap: 10, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", minWidth: 0 };
const cardHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 };
const itemName: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 900 };
const servesLine: React.CSSProperties = { marginTop: 2, fontSize: 12, color: "#a9cbff" };
const statusLine: React.CSSProperties = { marginTop: 3, fontSize: 12, lineHeight: 1.4 };
const weekChip: React.CSSProperties = { flexShrink: 0, padding: "3px 8px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.16)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.75)" };
const strip: React.CSSProperties = { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" };
const cellBase: React.CSSProperties = { flex: "0 0 116px", minHeight: 64, padding: "8px 9px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 2, textAlign: "left", color: "inherit", fontWeight: 400, touchAction: "manipulation", boxSizing: "border-box" };
const cellLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)" };
const cellValue: React.CSSProperties = { fontSize: 13, fontWeight: 800, lineHeight: 1.3 };
const cellTag: React.CSSProperties = { fontSize: 11, fontWeight: 900 };
const editor: React.CSSProperties = { display: "grid", gap: 10, padding: 12, borderRadius: 12, border: "1px solid rgba(51,255,122,0.3)", background: "rgba(51,255,122,0.04)" };
const editorTitle: React.CSSProperties = { fontSize: 13, fontWeight: 900 };
const editorGrid: React.CSSProperties = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" };
const optionRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const inlineForm: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center" };
const saveButton: React.CSSProperties = { ...pillButtonStyle, borderColor: "rgba(51,255,122,0.55)", background: "rgba(51,255,122,0.14)", color: "#c9ffdc" };
const options: React.CSSProperties = { fontSize: 13 };
const optionsSummary: React.CSSProperties = { cursor: "pointer", minHeight: 36, display: "flex", alignItems: "center", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.62)" };
const optionsBody: React.CSSProperties = { display: "grid", gap: 10, paddingTop: 6 };
const phaseEndRow: React.CSSProperties = { display: "grid", gap: 6 };
const segmented: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, padding: 3, borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)" };
const segment: React.CSSProperties = { minHeight: 40, padding: "6px 8px", borderRadius: 8, border: "1px solid transparent", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 800 };
const segmentOn: React.CSSProperties = { background: "rgba(196,160,255,0.16)", borderColor: "rgba(196,160,255,0.55)", color: "#e8dcff" };
