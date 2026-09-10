"use client";

// The ladder — one surface for reading, ticking, and editing. There is no
// separate edit page: tapping a rung's text turns that row into inputs and
// leaves every other row as plain text, so the shape of the ladder stays
// visible while you work on it. Order is the whole content of a progression,
// so hiding rows behind accordions (the Focus roadmap's mistake) is fatal.
//
// The node ticks, the text edits. Two targets, never overlapping.
//
// Enter behaves the way it does in any outliner: on a rung with text it
// commits and opens the next one, on an empty rung it ends the list.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import {
  markRungMet, reopenRung, updateRung, addRung, deleteRung, reorderRungs,
} from "@/app/progressions/actions";
import type { RungView } from "@/app/progressions/data";
import {
  ACCENT, rungRow, railCol, node, nodeCheck, rail, rungTextCol,
  rungLabel, rungMeta, modifierChip, nowPill, rungError,
  editGrid, editRowInline, editBar, editBarLeft, iconBtn, doneBtn,
  addStepBtn, untitledLabel,
} from "@/app/progressions/ui";

type Draft = { label: string; modifier: string; targetText: string };

const inlineInput = { ...inputStyle, padding: "8px 10px" };

function draftFrom(rung: RungView): Draft {
  return {
    label: rung.label,
    modifier: rung.modifier ?? "",
    targetText: rung.targetText ?? "",
  };
}

export default function ProgressionLadder({
  progressionId,
  rungs,
  currentId,
}: {
  progressionId: string;
  rungs: RungView[];
  currentId: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(rungs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    setRows(rungs);
  }, [rungs]);

  const beginEdit = useCallback((rung: RungView) => {
    setEditingId(rung.id);
    setDraft(draftFrom(rung));
  }, []);

  // A rung with no label yet is only meaningful while you are typing in it, so
  // open it straight away rather than leaving an "Untitled step" row sitting
  // there. This is what makes Enter-to-add land you in the new row.
  useEffect(() => {
    if (editingId) return;
    const blank = rows.find((r) => !r.label.trim());
    if (blank) beginEdit(blank);
  }, [rows, editingId, beginEdit]);

  function run(fn: () => Promise<void>) {
    setFailed(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch {
        setFailed("Couldn't save — try again");
        router.refresh();
      }
    });
  }

  function commit(id: string, next: Draft) {
    return updateRung(id, {
      label: next.label,
      modifier: next.modifier || null,
      targetText: next.targetText || null,
    });
  }

  function closeEdit(id: string, next: Draft) {
    setEditingId(null);
    setDraft(null);
    run(() => commit(id, next));
  }

  function removeRung(id: string) {
    setEditingId(null);
    setDraft(null);
    setRows((prev) => prev.filter((r) => r.id !== id));
    run(() => deleteRung(id));
  }

  function addAfter(afterId: string | null, next?: Draft) {
    setEditingId(null);
    setDraft(null);
    run(async () => {
      if (afterId && next) await commit(afterId, next);
      const created = await addRung(progressionId, afterId);
      setAutoFocusId(created.id);
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    run(() => reorderRungs(progressionId, next.map((r) => r.id)));
  }

  return (
    <div style={{ display: "grid", gap: 2 }}>
      {rows.map((rung, index) => (
        <Row
          key={rung.id}
          rung={rung}
          index={index}
          total={rows.length}
          isCurrent={rung.id === currentId}
          isLast={index === rows.length - 1}
          isEditing={rung.id === editingId}
          shouldFocus={rung.id === autoFocusId}
          draft={rung.id === editingId ? draft : null}
          busy={busy}
          onBeginEdit={() => beginEdit(rung)}
          onDraftChange={setDraft}
          onCommit={(next) => closeEdit(rung.id, next)}
          onEnter={(next) =>
            next.label.trim() ? addAfter(rung.id, next) : removeRung(rung.id)
          }
          onDelete={() => removeRung(rung.id)}
          onMove={(dir) => move(index, dir)}
          onFocused={() => setAutoFocusId(null)}
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

function Row({
  rung, index, total, isCurrent, isLast, isEditing, shouldFocus, draft, busy,
  onBeginEdit, onDraftChange, onCommit, onEnter, onDelete, onMove, onFocused,
}: {
  rung: RungView;
  index: number;
  total: number;
  isCurrent: boolean;
  isLast: boolean;
  isEditing: boolean;
  shouldFocus: boolean;
  draft: Draft | null;
  busy: boolean;
  onBeginEdit: () => void;
  onDraftChange: (draft: Draft) => void;
  onCommit: (draft: Draft) => void;
  onEnter: (draft: Draft) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onFocused: () => void;
}) {
  const router = useRouter();
  const [ticking, startTick] = useTransition();
  const [tickFailed, setTickFailed] = useState(false);
  const labelRef = useRef<HTMLInputElement | null>(null);
  const done = rung.status === "ACHIEVED";
  const skipped = rung.status === "SKIPPED";

  useEffect(() => {
    if (shouldFocus && labelRef.current) {
      labelRef.current.focus();
      onFocused();
    }
  }, [shouldFocus, onFocused]);

  function toggle() {
    setTickFailed(false);
    startTick(async () => {
      try {
        if (done) await reopenRung(rung.id);
        else await markRungMet(rung.id);
        router.refresh();
      } catch {
        setTickFailed(true);
      }
    });
  }

  const ringColor = done || isCurrent ? ACCENT : "rgba(255,255,255,0.26)";

  return (
    <div style={rungRow(isCurrent)}>
      <button
        type="button"
        className="progRungNode"
        onClick={toggle}
        disabled={ticking || skipped}
        style={railCol}
        aria-label={done ? `Reopen ${rung.label}` : `Mark ${rung.label} done`}
        aria-pressed={done}
      >
        <span
          style={{
            ...node,
            borderColor: ringColor,
            background: done ? ACCENT : "transparent",
            opacity: ticking ? 0.5 : 1,
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
          <input
            ref={labelRef}
            style={inlineInput}
            value={draft.label}
            placeholder="What is this step?"
            aria-label="Step name"
            onChange={(e) => onDraftChange({ ...draft, label: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter(draft);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCommit(draft);
              }
            }}
          />
          <div style={editRowInline}>
            <input
              style={inlineInput}
              value={draft.modifier}
              placeholder="with band · plus +25 lb"
              aria-label="Assistance or added load"
              onChange={(e) => onDraftChange({ ...draft, modifier: e.target.value })}
            />
            <input
              style={inlineInput}
              value={draft.targetText}
              placeholder="10s · 3x8"
              aria-label="How you will know"
              onChange={(e) => onDraftChange({ ...draft, targetText: e.target.value })}
            />
          </div>
          <div style={editBar}>
            <div style={editBarLeft}>
              <button type="button" style={iconBtn} onClick={() => onMove(-1)} disabled={index === 0 || busy} aria-label="Move up">↑</button>
              <button type="button" style={iconBtn} onClick={() => onMove(1)} disabled={index === total - 1 || busy} aria-label="Move down">↓</button>
              <button type="button" style={iconBtn} onClick={onDelete} disabled={busy} aria-label="Delete step">✕</button>
            </div>
            <button type="button" style={doneBtn} onClick={() => onCommit(draft)} disabled={busy}>Done</button>
          </div>
        </div>
      ) : (
        <button type="button" className="progRungText" style={rungTextCol} onClick={onBeginEdit}>
          <span style={rungLabel(done, skipped, isCurrent)}>
            {rung.label.trim() ? rung.label : <span style={untitledLabel}>Untitled step</span>}
            {rung.modifier ? <span style={modifierChip}>{rung.modifier}</span> : null}
            {isCurrent ? <span style={nowPill}>now</span> : null}
          </span>
          {rung.targetText ? <span style={rungMeta}>{rung.targetText}</span> : null}
          {tickFailed ? <span style={rungError}>Couldn&apos;t update — tap again</span> : null}
        </button>
      )}
    </div>
  );
}
