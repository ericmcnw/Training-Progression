"use client";

// The ladder — one surface for reading, ticking, and editing.
//
// A step asks two questions and no more: what are you doing, and what tells
// you to move on. The second is a picker rather than a text box, because free
// text can describe a target but nothing can count it — "3x5" is a string. A
// metric plus a number plus an exercise is something the app can check against
// logged sets.
//
// Two rules keep edits safe:
//  - Anything that leaves a row commits it first, so switching rows or adding
//    a step can never silently discard what was typed.
//  - Every change applies to local state immediately and the server call runs
//    behind it. Nothing re-reads from the server mid-edit, because that is
//    what dismisses the keyboard and drops focus between rows.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Field, inputStyle } from "@/app/routines/[id]/log/form-ui";
import {
  markRungMet, reopenRung, updateRung, addRung, deleteRung, reorderRungs,
} from "@/app/progressions/actions";
import type { RungView, ExerciseOption } from "@/app/progressions/data";
import type { RungMetric } from "@/generated/prisma";
import ExercisePicker from "./ExercisePicker";
import {
  ACCENT, rungRow, railCol, node, nodeCheck, rail, rungTextCol,
  rungLabel, rungMeta, nowPill, rungError, readyPill,
  editGrid, editBar, editBarLeft, iconBtn, doneBtn, addStepBtn, untitledLabel,
  measureRow, unitTag, bestLine,
} from "@/app/progressions/ui";

const METRICS = [
  { key: "", label: "I decide when", unit: "" },
  { key: "WEIGHT", label: "Weight reaches", unit: "lb" },
  { key: "REPS", label: "Reps reach", unit: "reps" },
  { key: "SECONDS", label: "Hold reaches", unit: "sec" },
] as const;

function unitFor(metric: RungMetric | null) {
  return METRICS.find((m) => m.key === (metric ?? ""))?.unit ?? "";
}

type Draft = {
  label: string;
  note: string;
  metric: "" | RungMetric;
  value: string;
  exerciseId: string | null;
};

const inlineInput = { ...inputStyle, padding: "9px 11px" };

function draftFrom(rung: RungView): Draft {
  return {
    label: rung.label,
    note: rung.targetText ?? "",
    metric: rung.metric ?? "",
    value: rung.value != null ? String(rung.value) : "",
    exerciseId: rung.exerciseId,
  };
}

function resolve(draft: Draft) {
  const metric = draft.metric || null;
  const raw = draft.value.trim();
  const parsed = raw === "" ? null : Number(raw);
  const value = metric && parsed != null && Number.isFinite(parsed) ? parsed : null;
  return {
    label: draft.label.trim(),
    targetText: value == null ? draft.note.trim() || null : null,
    metric: value == null ? null : metric,
    value,
    exerciseId: draft.exerciseId,
  };
}

export default function ProgressionLadder({
  progressionId,
  rungs,
  currentId,
  exercises,
}: {
  progressionId: string;
  rungs: RungView[];
  currentId: string | null;
  exercises: ExerciseOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(rungs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);

  // Async handlers fire after the state they care about has changed, so the
  // live draft is read through a ref rather than a stale closure.
  const draftRef = useRef<Draft | null>(null);
  const editingRef = useRef<string | null>(null);
  const rowsRef = useRef(rows);
  draftRef.current = draft;
  editingRef.current = editingId;
  rowsRef.current = rows;

  useEffect(() => {
    setRows(rungs);
  }, [rungs]);

  const fail = useCallback(() => {
    setFailed("Couldn't save — refreshing");
    router.refresh();
  }, [router]);

  // Persist whatever row is open, if it actually changed. Everything that
  // moves away from a row calls this first.
  const flush = useCallback(() => {
    const id = editingRef.current;
    const live = draftRef.current;
    if (!id || !live) return;
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    const next = resolve(live);
    const unchanged =
      next.label === row.label.trim() &&
      next.targetText === (row.targetText ?? null) &&
      next.metric === (row.metric ?? null) &&
      next.value === (row.value ?? null) &&
      next.exerciseId === (row.exerciseId ?? null);
    if (unchanged) return;

    const name = next.exerciseId
      ? (exercises.find((o) => o.id === next.exerciseId)?.name ?? null)
      : null;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, ...next, modifier: null, exerciseName: name } : r
      )
    );
    startTransition(async () => {
      try {
        await updateRung(id, next);
      } catch {
        fail();
      }
    });
  }, [exercises, fail]);

  function openRow(rung: RungView) {
    flush();
    setFailed(null);
    setEditingId(rung.id);
    setDraft(draftFrom(rung));
  }

  function closeRow() {
    flush();
    setEditingId(null);
    setDraft(null);
  }

  function removeRow(id: string) {
    flush();
    setEditingId(null);
    setDraft(null);
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      try {
        await deleteRung(id);
      } catch {
        fail();
      }
    });
  }

  // Insert locally and open the new row straight away, then let the server
  // catch up — waiting on the round trip is what dropped the keyboard.
  function addAfter(afterId: string | null) {
    flush();
    setFailed(null);
    startTransition(async () => {
      try {
        const created = await addRung(progressionId, afterId);
        const blank: RungView = {
          id: created.id,
          label: "",
          modifier: null,
          targetText: null,
          status: "ACTIVE",
          sortOrder: 0,
          metric: null,
          value: null,
          exerciseId: null,
          exerciseName: null,
          best: null,
        };
        setRows((prev) => {
          const at = afterId ? prev.findIndex((r) => r.id === afterId) + 1 : prev.length;
          const next = [...prev];
          next.splice(at, 0, blank);
          return next;
        });
        setEditingId(created.id);
        setDraft({ label: "", note: "", metric: "", value: "", exerciseId: null });
      } catch {
        fail();
      }
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    flush();
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    startTransition(async () => {
      try {
        await reorderRungs(progressionId, next.map((r) => r.id));
      } catch {
        fail();
      }
    });
  }

  function setStatus(id: string, done: boolean) {
    flush();
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: done ? "ACTIVE" : "ACHIEVED" } : r))
    );
    startTransition(async () => {
      try {
        if (done) await reopenRung(id);
        else await markRungMet(id);
        router.refresh();
      } catch {
        fail();
      }
    });
  }

  const liveCurrentId = rows.find((r) => r.status === "ACTIVE")?.id ?? currentId;

  return (
    <div style={{ display: "grid", gap: 2 }}>
      {rows.map((rung, index) => (
        <Row
          key={rung.id}
          rung={rung}
          index={index}
          total={rows.length}
          isCurrent={rung.id === liveCurrentId}
          isLast={index === rows.length - 1}
          isEditing={rung.id === editingId}
          draft={rung.id === editingId ? draft : null}
          exercises={exercises}
          busy={busy}
          onOpen={() => openRow(rung)}
          onDraftChange={setDraft}
          onClose={closeRow}
          onEnter={() => {
            const live = draftRef.current;
            if (live && !live.label.trim()) removeRow(rung.id);
            else addAfter(rung.id);
          }}
          onDelete={() => removeRow(rung.id)}
          onMove={(dir) => move(index, dir)}
          onToggle={(done) => setStatus(rung.id, done)}
        />
      ))}

      <button type="button" style={addStepBtn} onClick={() => addAfter(null)} disabled={busy}>
        + Add a step
      </button>

      {failed ? <span style={rungError}>{failed}</span> : null}
      <style>{`.progRungNode:active { transform: scale(0.92); }`}</style>
    </div>
  );
}

// "25 lb in Weighted Pull-Up", or the free-text note, or nothing.
function summaryOf(rung: RungView) {
  if (rung.metric && rung.value != null) {
    const unit = unitFor(rung.metric);
    return [`${rung.value} ${unit}`.trim(), rung.exerciseName].filter(Boolean).join(" · ");
  }
  return rung.targetText || rung.modifier || "";
}

function Row({
  rung, index, total, isCurrent, isLast, isEditing, draft, busy, exercises,
  onOpen, onDraftChange, onClose, onEnter, onDelete, onMove, onToggle,
}: {
  rung: RungView;
  index: number;
  total: number;
  isCurrent: boolean;
  isLast: boolean;
  isEditing: boolean;
  draft: Draft | null;
  exercises: ExerciseOption[];
  busy: boolean;
  onOpen: () => void;
  onDraftChange: (draft: Draft) => void;
  onClose: () => void;
  onEnter: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onToggle: (done: boolean) => void;
}) {
  const labelRef = useRef<HTMLInputElement | null>(null);
  const done = rung.status === "ACHIEVED";
  const skipped = rung.status === "SKIPPED";
  const ready =
    !done && rung.value != null && rung.best != null && rung.best >= rung.value;

  useEffect(() => {
    if (isEditing) labelRef.current?.focus();
  }, [isEditing]);

  const ringColor = done || isCurrent ? ACCENT : "rgba(255,255,255,0.26)";
  const summary = summaryOf(rung);

  return (
    <div style={rungRow(isCurrent)}>
      <button
        type="button"
        className="progRungNode"
        onClick={() => onToggle(done)}
        disabled={busy || skipped}
        style={railCol}
        aria-label={done ? `Reopen ${rung.label}` : `Mark ${rung.label} done`}
        aria-pressed={done}
      >
        <span
          style={{
            ...node,
            borderColor: ringColor,
            background: done ? ACCENT : "transparent",
          }}
        >
          {done ? <span style={nodeCheck}>✓</span> : null}
        </span>
        {!isLast ? (
          <span style={{ ...rail, background: done ? ACCENT : "rgba(255,255,255,0.12)" }} />
        ) : null}
      </button>

      {isEditing && draft ? (
        <div style={editGrid}>
          <Field label="Step" hint="The movement, including how you are doing it.">
            <input
              ref={labelRef}
              style={inlineInput}
              value={draft.label}
              placeholder="Pull-up with a light band"
              aria-label="Step"
              onChange={(e) => onDraftChange({ ...draft, label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onEnter();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
          </Field>

          <Field
            label="Move on when"
            hint={
              draft.metric
                ? "Pick the exercise and the app can tick this for you."
                : "Pick a number and the app can watch for it. Leave it on I decide to judge it yourself."
            }
          >
            <select
              style={inlineInput}
              value={draft.metric}
              aria-label="How this step is measured"
              onChange={(e) =>
                onDraftChange({ ...draft, metric: e.target.value as Draft["metric"] })
              }
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </Field>

          {draft.metric ? (
            <>
              <div style={measureRow}>
                <input
                  style={{ ...inlineInput, width: 110 }}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={draft.value}
                  placeholder="25"
                  aria-label="Target number"
                  onChange={(e) => onDraftChange({ ...draft, value: e.target.value })}
                />
                <span style={unitTag}>{unitFor(draft.metric || null)}</span>
              </div>
              <Field label="In which exercise" hint="Optional, but required for it to tick itself.">
                <ExercisePicker
                  options={exercises}
                  value={draft.exerciseId}
                  onChange={(id) => onDraftChange({ ...draft, exerciseId: id })}
                />
              </Field>
            </>
          ) : (
            <input
              style={inlineInput}
              value={draft.note}
              placeholder="feels solid · no pain after"
              aria-label="Move on when, in your words"
              onChange={(e) => onDraftChange({ ...draft, note: e.target.value })}
            />
          )}

          <div style={editBar}>
            <div style={editBarLeft}>
              <button type="button" style={iconBtn} onClick={() => onMove(-1)} disabled={index === 0 || busy} aria-label="Move up">↑</button>
              <button type="button" style={iconBtn} onClick={() => onMove(1)} disabled={index === total - 1 || busy} aria-label="Move down">↓</button>
              <button type="button" style={iconBtn} onClick={onDelete} disabled={busy} aria-label="Delete step">✕</button>
            </div>
            <button type="button" style={doneBtn} onClick={onClose} disabled={busy}>Done</button>
          </div>
        </div>
      ) : (
        <button type="button" className="progRungText" style={rungTextCol} onClick={onOpen}>
          <span style={rungLabel(done, skipped, isCurrent)}>
            {rung.label.trim() ? rung.label : <span style={untitledLabel}>Tap to name this step</span>}
            {isCurrent ? <span style={nowPill}>now</span> : null}
            {ready ? <span style={readyPill}>ready</span> : null}
          </span>
          {summary ? <span style={rungMeta}>{summary}</span> : null}
          {rung.best != null && rung.value != null && !done ? (
            <span style={bestLine}>
              best so far {rung.best} {unitFor(rung.metric)}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}
