"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import { Field, inputStyle, pillButtonStyle } from "@/app/routines/[id]/log/form-ui";
import {
  addPlanItem,
  clearPlanTarget,
  endPlanItem,
  fillPlan,
  nudgePlanWeek,
  setPlanTarget,
  type PlanActionResult,
} from "@/app/programs/plan-actions";
import type { PlanBoardGroup, PlanBoardItem, PlanCell } from "@/app/programs/plan-data";

type Selection = { itemId: string; week: number };

export default function ProgramPlanBoard({ programId, groups }: { programId: string; groups: PlanBoardGroup[] }) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<PlanActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else after?.();
    });
  }

  if (groups.length === 0) {
    return (
      <section style={intro}>
        <p style={introText}>Link a routine to this program, then plan the exercises you want to push.</p>
      </section>
    );
  }

  return (
    <div style={stack}>
      <section style={intro}>
        <p style={introText}>
          Plan only what you want to push. Each week carries forward until you change a later one. A week moves on once you hit its target; miss it or skip it and the plan waits for you.
        </p>
      </section>

      {error ? <div role="alert" style={errorBox}>{error}</div> : null}

      {groups.map((group) => {
        const key = group.routineId ?? "other";
        const open = adding === key;
        return (
          <section key={key} style={groupSection}>
            <div style={groupHead}>
              <h2 style={groupTitle}>{group.routineName}</h2>
              {group.candidates.length > 0 ? (
                <button type="button" onClick={() => setAdding(open ? null : key)} style={pillButtonStyle} aria-expanded={open}>
                  {open ? "Done" : "+ Plan an exercise"}
                </button>
              ) : null}
            </div>

            {open ? (
              <ul style={candidateList}>
                {group.candidates.map((candidate) => (
                  <li key={candidate.exerciseId} style={candidateRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={candidateName}>{candidate.name}</div>
                      <div style={muted}>{candidate.plannedElsewhere ? `Planned in ${candidate.plannedElsewhere}` : candidate.lastLabel}</div>
                    </div>
                    <button
                      type="button"
                      disabled={pending || Boolean(candidate.plannedElsewhere)}
                      onClick={() => run(() => addPlanItem(programId, candidate.exerciseId, group.routineId))}
                      style={pillButtonStyle}
                    >
                      Plan
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {group.items.length === 0 && !open ? (
              <p style={muted}>Nothing planned here. Unplanned exercises keep using last time&apos;s numbers.</p>
            ) : null}

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
        );
      })}
    </div>
  );
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
  run: (action: () => Promise<PlanActionResult>, after?: () => void) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const selectedCell = item.cells.find((cell) => cell.week != null && cell.week === selectedWeek) ?? null;

  useEffect(() => {
    const strip = stripRef.current;
    const now = strip?.querySelector<HTMLElement>("[data-now]");
    if (strip && now) strip.scrollLeft = Math.max(0, now.offsetLeft - strip.offsetLeft - 60);
  }, []);

  const fills: Array<{ label: string; kind: "weightLb" | "reps" | "seconds"; step: number }> = [
    ...(item.supportsWeight ? [{ label: "+5 lb a week", kind: "weightLb" as const, step: 5 }] : []),
    item.unit === "TIME"
      ? { label: "+5 s a week", kind: "seconds" as const, step: 5 }
      : { label: "+1 rep a week", kind: "reps" as const, step: 1 },
  ];

  return (
    <article style={card}>
      <div style={cardHead}>
        <div style={{ minWidth: 0 }}>
          <h3 style={itemName}>{item.name}</h3>
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
          <div style={optionRow}>
            {fills.map((fill) => (
              <button
                key={fill.kind}
                type="button"
                disabled={pending}
                onClick={() => run(() => fillPlan(item.id, fill.kind, fill.step, 4))}
                style={pillButtonStyle}
              >
                {fill.label} · next 4
              </button>
            ))}
          </div>
          <div style={optionRow}>
            <button type="button" disabled={pending} onClick={() => run(() => nudgePlanWeek(item.id, 1))} style={pillButtonStyle}>
              Move on now
            </button>
            <button
              type="button"
              disabled={pending || item.week <= 1}
              onClick={() => run(() => nudgePlanWeek(item.id, -1))}
              style={pillButtonStyle}
            >
              Back a week
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Stop planning ${item.name}? Its logs stay; the log form goes back to last time's numbers.`)) {
                  run(() => endPlanItem(item.id));
                }
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
  onSave: (values: { sets: string; reps: string; seconds: string; weightLb: string }) => void;
  onClear: (() => void) | null;
}) {
  const start = cell.target;
  const [sets, setSets] = useState(start?.sets != null ? String(start.sets) : "");
  const [reps, setReps] = useState(start?.reps != null ? String(start.reps) : "");
  const [seconds, setSeconds] = useState(start?.seconds != null ? String(start.seconds) : "");
  const [weightLb, setWeightLb] = useState(start?.weightLb != null ? String(start.weightLb) : "");
  const timed = item.unit === "TIME";

  const bump = (value: string, by: number, set: (v: string) => void) => set(String(Math.max(0, (Number(value) || 0) + by)));

  return (
    <form
      style={editor}
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ sets, reps: timed ? "" : reps, seconds: timed ? seconds : "", weightLb: item.supportsWeight ? weightLb : "" });
      }}
    >
      <div style={editorTitle}>
        {cell.label === "This week" ? "This week" : `Week of ${cell.label}`} · plan week {week}
      </div>
      <div style={editorGrid}>
        <Field label="Sets">
          <input inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} style={inputStyle} aria-label="Sets" />
        </Field>
        {timed ? (
          <Field label="Seconds">
            <input inputMode="numeric" value={seconds} onChange={(e) => setSeconds(e.target.value)} style={inputStyle} aria-label="Seconds" />
          </Field>
        ) : (
          <Field label="Reps">
            <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} style={inputStyle} aria-label="Reps" />
          </Field>
        )}
        {item.supportsWeight ? (
          <Field label="Weight lb">
            <input inputMode="decimal" value={weightLb} onChange={(e) => setWeightLb(e.target.value)} style={inputStyle} aria-label="Weight in pounds" />
          </Field>
        ) : null}
      </div>
      <div style={optionRow}>
        {item.supportsWeight ? (
          <button type="button" onClick={() => bump(weightLb, 5, setWeightLb)} style={pillButtonStyle}>+5 lb</button>
        ) : null}
        {timed ? (
          <button type="button" onClick={() => bump(seconds, 5, setSeconds)} style={pillButtonStyle}>+5 s</button>
        ) : (
          <button type="button" onClick={() => bump(reps, 1, setReps)} style={pillButtonStyle}>+1 rep</button>
        )}
        <button type="button" onClick={() => bump(sets, 1, setSets)} style={pillButtonStyle}>+1 set</button>
      </div>
      <p style={muted}>Applies from this week on, until a later week changes it.</p>
      <div style={optionRow}>
        <button type="submit" disabled={pending} style={saveButton}>Save</button>
        {onClear ? (
          <button type="button" disabled={pending} onClick={onClear} style={pillButtonStyle}>
            Same as the week before
          </button>
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
const intro: React.CSSProperties = { padding: "4px 2px" };
const introText: React.CSSProperties = { margin: 0, fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.68)", maxWidth: 640 };
const errorBox: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,120,100,0.5)", background: "rgba(255,120,100,0.1)", fontSize: 13 };
const groupSection: React.CSSProperties = { display: "grid", gap: 10, minWidth: 0 };
const groupHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const groupTitle: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 900 };
const muted: React.CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.45, color: "rgba(255,255,255,0.6)" };
const candidateList: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, maxHeight: 360, overflowY: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" };
const candidateRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 10px" };
const candidateName: React.CSSProperties = { fontSize: 14, fontWeight: 800 };
const card: React.CSSProperties = { display: "grid", gap: 10, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", minWidth: 0 };
const cardHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 };
const itemName: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 900 };
const statusLine: React.CSSProperties = { marginTop: 3, fontSize: 12, lineHeight: 1.4 };
const weekChip: React.CSSProperties = { flexShrink: 0, padding: "3px 8px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.16)", fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.75)" };
const strip: React.CSSProperties = { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" };
const cellBase: React.CSSProperties = { flex: "0 0 112px", minHeight: 64, padding: "8px 9px", borderRadius: 10, borderWidth: 1, borderStyle: "solid", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 2, textAlign: "left", color: "inherit", touchAction: "manipulation", boxSizing: "border-box" };
const cellLabel: React.CSSProperties = { fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.6)" };
const cellValue: React.CSSProperties = { fontSize: 13, fontWeight: 800, lineHeight: 1.3 };
const cellTag: React.CSSProperties = { fontSize: 11, fontWeight: 900 };
const editor: React.CSSProperties = { display: "grid", gap: 10, padding: 12, borderRadius: 12, border: "1px solid rgba(51,255,122,0.3)", background: "rgba(51,255,122,0.04)" };
const editorTitle: React.CSSProperties = { fontSize: 13, fontWeight: 900 };
const editorGrid: React.CSSProperties = { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" };
const optionRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
const saveButton: React.CSSProperties = { ...pillButtonStyle, borderColor: "rgba(51,255,122,0.55)", background: "rgba(51,255,122,0.14)", color: "#c9ffdc" };
const options: React.CSSProperties = { fontSize: 13 };
const optionsSummary: React.CSSProperties = { cursor: "pointer", minHeight: 36, display: "flex", alignItems: "center", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.62)" };
const optionsBody: React.CSSProperties = { display: "grid", gap: 8, paddingTop: 6 };
