"use client";

// Opens the LogDrawer against the synthetic Endurance routine so the user
// can pick an activity type and log without creating a routine first.
// Sibling of QuickLogDrawerButton (strength's free-form lift entry).
//
// The synthetic routine has kind=CARDIO; the drawer's existing dispatch
// loads the cardio form, which now renders the activity-type picker when
// the routine is synthetic (routineIsSynthetic prop).

import type { CSSProperties } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import { SYNTHETIC_ENDURANCE_ROUTINE_ID } from "@/lib/activity-types";

// Short label by default to match the Strength section's "Quick Log"
// pill width — the routines list header pins the section title in the
// center and the quick-log pill absolute-positions on the left, so a
// wider label collides with the centered "ENDURANCE" text.
export default function EnduranceQuickLogButton({
  label = "🏃 Log",
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
      onClick={() => openDrawer(SYNTHETIC_ENDURANCE_ROUTINE_ID)}
    >
      {label}
    </button>
  );
}
