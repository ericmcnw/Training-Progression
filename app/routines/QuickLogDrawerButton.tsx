"use client";

import type { CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { QUICK_LOG_ROUTINE_ID } from "@/app/components/LogDrawer";

// Opens the floating LogDrawer in quick-log mode (sentinel routineId).
// Replaces the old `Link href="/routines?mode=quick-log"` so quick logging
// stays in the drawer flow like every other log entry point.
export default function QuickLogDrawerButton({
  label = "Quick Log",
  style,
  className,
}: {
  label?: string;
  style?: CSSProperties;
  className?: string;
}) {
  const { openDrawer } = useLogDrawer();
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => openDrawer(QUICK_LOG_ROUTINE_ID)}
    >
      {label}
    </button>
  );
}
