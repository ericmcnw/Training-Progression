"use client";

// Shared completion checkbox — used by both the WaG day-detail card and the
// dashboard's TodayActionsBar. Optimistic toggling, server sync, and a
// throttled router.refresh() so logged state propagates to other surfaces
// (rhythm grid, training balance, etc) without flicker.

import { memo, useEffect, useRef, type CSSProperties } from "react";
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef(done);
  const inFlightRef = useRef(false);
  const serverDoneRef = useRef(done);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    serverDoneRef.current = done;
    if (!inFlightRef.current && inputRef.current && inputRef.current.checked !== done) {
      inputRef.current.checked = done;
      targetRef.current = done;
    }
  }, [done, ymd, routineId]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  async function flush() {
    if (inFlightRef.current) return;
    while (targetRef.current !== serverDoneRef.current) {
      const desired = targetRef.current;
      inFlightRef.current = true;
      try {
        await setCompletionForDay(routineId, ymd, desired);
        serverDoneRef.current = desired;
      } catch (err) {
        console.error("Failed to update completion", err);
        targetRef.current = serverDoneRef.current;
        if (inputRef.current) inputRef.current.checked = serverDoneRef.current;
        inFlightRef.current = false;
        return;
      }
      inFlightRef.current = false;
    }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      router.refresh();
    }, 400);
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    targetRef.current = event.target.checked;
    void flush();
  }

  const style: CSSProperties = {
    width: size,
    height: size,
    margin: 0,
    flexShrink: 0,
    cursor: "pointer",
    accentColor: "rgba(84,203,130,0.95)",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
  };

  return (
    <input
      ref={inputRef}
      type="checkbox"
      defaultChecked={done}
      onChange={onChange}
      aria-label={ariaLabel}
      style={style}
    />
  );
});

export default CompletionCheckbox;
