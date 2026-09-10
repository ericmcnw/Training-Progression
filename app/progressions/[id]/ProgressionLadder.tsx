"use client";

// The ladder — one surface for reading, ticking, and editing. Tapping a rung's
// text turns that row into labelled inputs and every other row stays plain
// text, so the order of the ladder — which is the whole content of a
// progression — never disappears behind an accordion.
//
// The node ticks, the text edits. Two targets, never overlapping.
//
// Two rules keep edits safe:
//  - Anything that leaves a row commits it first, so switching rows or adding
//    a step can never silently discard what was typed.
//  - Every change applies to local state immediately and the server call runs
//    behind it. Nothing here re-reads from the server mid-edit, because that
//    is what dismisses the keyboard and drops focus between rows.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Field, inputStyle } from "@/app/routines/[id]/log/form-ui";
import {
  markRungMet, reopenRung, updateRung, addRung, deleteRung, reorderRungs,
} from "@/app/progressions/actions";
import type { RungView } from "@/app/progressions/data";
import {
  ACCENT, rungRow, railCol, node, nodeCheck, rail, rungTextCol,
  rungLabel, rungMeta, modifierChip, nowPill, rungError,
  editGrid, editBar, editBarLeft, iconBtn, doneBtn, addStepBtn, untitledLabel,
} from "@/app/progressions/ui";

type Draft = { label: string; modifier: string; targetText: string };

const inlineInput = { ...inputStyle, padding: "9px 11px" };

function draftFrom(rung: RungView): Draft {
  return {
    label: rung.label,
    modifier: rung.modifier ?? "",
    targetText: rung.targetText ?? "",
  };
}

function normalize(draft: Draft) {
  return {
    label: draft.label.trim(),
    modifier: draft.modifier.trim() || null,
    targetText: draft.targetText.trim() || null,
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
  const [busy, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);

  // Async handlers fire after the state they care about has already changed,
  // so the live draft is read through a ref rather than a stale closure.
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
  // moves away from a row calls this first — that is the whole fix for edits
  // vanishing when you added a step or tapped a different one.
  const flush = useCallback(() => {
    const id = editingRef.current;
    const current = draftRef.current;
    if (!id || !current) return;
    const row = rowsRef.current.find((r) => r.id === id);
    if (!row) return;
    const next = normalize(current);
    const unchanged =
      next.label === row.label.trim() &&
      next.modifier === (row.modifier ?? null) &&
      next.targetText === (row.targetText ?? null);
    if (unchanged) return;

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
    startTransition(async () => {
      try {
        await updateRung(id, next);
      } catch {
        fail();
      }
    });
  }, [fail]);

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
  // catch up. Waiting on the round trip is what dropped the keyboard between
  // steps when typing a ladder with Enter.
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
        };
        setRows((prev) => {
          const at = afterId ? prev.findIndex((r) => r.id === afterId) + 1 : prev.length;
          const next = [...prev];
          next.splice(at, 0, blank);
          return next;
        });
        setEditingId(created.id);
        setDraft({ label: "", modifier: "", targetText: "" });
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

  // Derived locally so a tick moves the "now" marker without a server round trip.
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

function Row({
  rung, index, total, isCurrent, isLast, isEditing, draft, busy,
  onOpen, onDraftChange, onClose, onEnter, onDelete, onMove, onToggle,
}: {
  rung: RungView;
  index: number;
  total: number;
  isCurrent: boolean;
  isLast: boolean;
  isEditing: boolean;
  draft: Draft | null;
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

  useEffect(() => {
    if (isEditing) labelRef.current?.focus();
  }, [isEditing]);

  const ringColor = done || isCurrent ? ACCENT : "rgba(255,255,255,0.26)";

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
          <Field label="Step" hint="The movement, or the thing you can do.">
            <input
              ref={labelRef}
              style={inlineInput}
              value={draft.label}
              placeholder="Pull-up"
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

          <Field label="Easier or harder" hint="Optional. Help you are using, or weight you are adding.">
            <input
              style={inlineInput}
              value={draft.modifier}
              placeholder="with light band · plus +25 lb"
              aria-label="Easier or harder"
              onChange={(e) => onDraftChange({ ...draft, modifier: e.target.value })}
            />
          </Field>

          <Field label="Move on when" hint="Optional. Your call — a number if you have one, a feeling if you do not.">
            <input
              style={inlineInput}
              value={draft.targetText}
              placeholder="3x5 · 10s hold · feels solid"
              aria-label="Move on when"
              onChange={(e) => onDraftChange({ ...draft, targetText: e.target.value })}
            />
          </Field>

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
            {rung.modifier ? <span style={modifierChip}>{rung.modifier}</span> : null}
            {isCurrent ? <span style={nowPill}>now</span> : null}
          </span>
          {rung.targetText ? <span style={rungMeta}>{rung.targetText}</span> : null}
        </button>
      )}
    </div>
  );
}
