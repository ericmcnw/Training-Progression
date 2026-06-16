"use client";

// Inline minutes pill rendered next to a CompletionCheckbox on the WaG
// detail panel, ONLY for COMPLETION routines whose Routine.capturesDuration
// is true (cold plunge, sauna, massage, foam rolling, active recovery).
//
// Display state shows either the existing minutes ("12m") or a subtle
// "+ min" affordance when the day is done but no duration is recorded. A
// null duration is intentionally distinct from zero — the user explicitly
// asked unlogged minutes to count as "session done, no minutes recorded"
// rather than as a 0-minute log. Stats helpers honor the same rule.
//
// Edit state swaps the pill for a tiny number input + save / clear /
// cancel buttons. Saves are optimistic so the pill updates immediately
// without waiting for the round-trip; a debounced router.refresh() lets
// other surfaces (rhythm grid, training balance) pick up the new value.

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { setCompletionDurationForDay } from "@/app/routines/actions";

export type CompletionMinutesPillProps = {
  routineId: string;
  ymd: string;
  /** Most recent log's duration in seconds. null/undefined = day done but
   *  no minutes recorded yet — pill renders an "+ min" affordance. */
  currentDurationSec?: number | null;
  /** Only render the pill when the day is actually done. If the user
   *  unchecks the routine, the pill should disappear (the duration
   *  belongs to a log that no longer exists). */
  isDone: boolean;
};

const CompletionMinutesPill = memo(function CompletionMinutesPill({
  routineId,
  ymd,
  currentDurationSec,
  isDone,
}: CompletionMinutesPillProps) {
  const router = useRouter();
  // Optimistic local copy of the duration so the pill flips immediately on
  // save without waiting for the server / refresh round-trip.
  const [displayedSec, setDisplayedSec] = useState<number | null>(
    currentDurationSec ?? null
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep local copy in sync if the server-side value changes (e.g. via a
  // separate edit on another surface). Only update when the user is NOT
  // mid-edit so we don't wipe their draft.
  useEffect(() => {
    if (!editing) setDisplayedSec(currentDurationSec ?? null);
  }, [currentDurationSec, editing]);

  // Auto-focus the number input when entering edit mode.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!isDone) return null;

  const displayedMin = displayedSec != null ? Math.round(displayedSec / 60) : null;

  function startEdit() {
    setDraft(displayedMin != null ? String(displayedMin) : "");
    setEditing(true);
  }

  async function save() {
    const trimmed = draft.trim();
    // Empty input clears the duration — null is "done without minutes",
    // which is the documented semantic.
    const minutes = trimmed === "" ? null : Number(trimmed);
    if (minutes != null && (!Number.isFinite(minutes) || minutes < 0)) {
      // Invalid input — bail without saving so the user can correct.
      return;
    }
    setSaving(true);
    const optimisticSec = minutes != null && minutes > 0 ? Math.round(minutes * 60) : null;
    setDisplayedSec(optimisticSec);
    try {
      await setCompletionDurationForDay(routineId, ymd, minutes);
      router.refresh();
    } catch {
      // Roll back on server failure. We don't surface a toast here — the
      // user will see the pill snap back and can retry.
      setDisplayedSec(currentDurationSec ?? null);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function cancel() {
    setEditing(false);
    setDraft("");
  }

  if (editing) {
    return (
      <span style={editShellStyle}>
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          placeholder="min"
          aria-label="Minutes"
          style={inputStyle}
          disabled={saving}
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          style={saveBtnStyle}
          aria-label="Save minutes"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          style={cancelBtnStyle}
          aria-label="Cancel"
        >
          ✕
        </button>
      </span>
    );
  }

  // Display mode. Two variants — value present or absent.
  return (
    <button
      type="button"
      onClick={startEdit}
      style={displayedSec != null ? filledPillStyle : emptyPillStyle}
      aria-label={
        displayedSec != null
          ? `Edit minutes (currently ${displayedMin})`
          : "Add minutes"
      }
    >
      {displayedSec != null ? `${displayedMin}m` : "+ min"}
    </button>
  );
});

export default CompletionMinutesPill;

// ── Styles ──────────────────────────────────────────────────────────────────

const baseBtn: CSSProperties = {
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  minHeight: 24,
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  lineHeight: 1,
};

const filledPillStyle: CSSProperties = {
  ...baseBtn,
  border: "1px solid rgba(84,203,130,0.4)",
  background: "rgba(84,203,130,0.13)",
  color: "rgba(190,235,210,0.95)",
};

const emptyPillStyle: CSSProperties = {
  ...baseBtn,
  border: "1px dashed rgba(255,255,255,0.22)",
  background: "transparent",
  color: "rgba(255,255,255,0.5)",
  fontWeight: 700,
};

const editShellStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const inputStyle: CSSProperties = {
  width: 56,
  padding: "4px 8px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 8,
  background: "rgba(0,0,0,0.3)",
  color: "inherit",
  // 16px+ to dodge iOS Safari focus zoom.
  fontSize: 16,
  fontWeight: 700,
  textAlign: "center" as const,
  // Hide the spinner buttons on most browsers — the pill is tight.
  MozAppearance: "textfield",
};

const saveBtnStyle: CSSProperties = {
  ...baseBtn,
  border: "1px solid rgba(84,203,130,0.5)",
  background: "rgba(84,203,130,0.18)",
  color: "rgba(190,235,210,1)",
  width: 24,
  minHeight: 24,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const cancelBtnStyle: CSSProperties = {
  ...baseBtn,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.65)",
  width: 24,
  minHeight: 24,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
