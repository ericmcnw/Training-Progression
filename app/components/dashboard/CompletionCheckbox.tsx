"use client";

// Shared completion checkbox — used by the WaG day-detail card and the
// dashboard's TodayActionsBar. Tuned to feel like the workout-log check: the
// tap flips LOCAL state instantly (no waiting on the server), the write runs
// in the background, and a single debounced router.refresh() lets sibling
// surfaces (streak, rhythm, minutes pill) catch up after you stop tapping —
// instead of re-rendering the whole dashboard on every toggle.
//
// WeekAtGlance is server-rendered and only re-renders via the refresh we
// trigger, so the incoming `done` prop is always fresh server state and
// matches what we optimistically set — adopting it never causes a flicker.

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { setCompletionForDay } from "@/app/routines/actions";

export type CompletionCheckboxProps = {
  routineId: string;
  ymd: string;
  done: boolean;
  size?: number; // square px, defaults to 26
  ariaLabel?: string;
};

const CompletionCheckbox = memo(function CompletionCheckbox({
  routineId,
  ymd,
  done,
  size = 26,
  ariaLabel = "Toggle done",
}: CompletionCheckboxProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(done);
  const [prevDone, setPrevDone] = useState(done);
  const desiredRef = useRef(done); // value we want persisted
  const lastSyncedRef = useRef(done); // value known to be persisted
  const inFlightRef = useRef(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt external prop changes (adjust-state-during-render — the canonical
  // React pattern). The only source of a changed prop is the refresh we
  // trigger, which carries fresh server state matching our optimistic value.
  if (done !== prevDone) {
    setPrevDone(done);
    setChecked(done);
  }

  // Re-baseline the persistence target to settled server truth.
  useEffect(() => {
    if (!inFlightRef.current) {
      lastSyncedRef.current = done;
      desiredRef.current = done;
    }
  }, [done]);

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  async function flush() {
    if (inFlightRef.current) return;
    while (desiredRef.current !== lastSyncedRef.current) {
      const desired = desiredRef.current;
      inFlightRef.current = true;
      try {
        await setCompletionForDay(routineId, ymd, desired);
        lastSyncedRef.current = desired;
      } catch (err) {
        console.error("Failed to update completion", err);
        desiredRef.current = lastSyncedRef.current;
        setChecked(lastSyncedRef.current); // roll back the optimistic toggle
        inFlightRef.current = false;
        return;
      }
      inFlightRef.current = false;
    }
    // Coalesced, low-priority refresh so the dashboard re-renders once after
    // the user stops toggling — not on every tap.
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      router.refresh();
    }, 800);
  }

  function toggle() {
    const next = !checked;
    setChecked(next); // instant — never awaits the server
    desiredRef.current = next;
    void flush();
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={toggle}
      style={boxStyle(size, checked)}
    >
      {checked ? "✓" : ""}
    </button>
  );
});

function boxStyle(size: number, checked: boolean): CSSProperties {
  return {
    width: size,
    height: size,
    // Override the global `button { min-height: 44px }` so the size prop
    // actually controls the box (otherwise it floors at 44 and bloats rows).
    minHeight: 0,
    flexShrink: 0,
    padding: 0,
    margin: 0,
    borderRadius: Math.max(6, Math.round(size * 0.28)),
    border: checked ? "1px solid rgba(74,222,128,0.7)" : "1px solid rgba(255,255,255,0.32)",
    background: checked ? "rgba(74,222,128,0.9)" : "rgba(255,255,255,0.04)",
    color: checked ? "#07210f" : "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: Math.round(size * 0.62),
    fontWeight: 900,
    lineHeight: 1,
    cursor: "pointer",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    transition: "background 120ms ease, border-color 120ms ease",
  };
}

export default CompletionCheckbox;
