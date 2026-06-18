"use client";

import { useEffect, useState } from "react";
import { learnedEffortForActivity } from "@/app/log/effort-calibration";
import { predictEffortDefault } from "@/lib/strain";

// Resolves the EffortSlider's pre-fill: the user's learned median for this
// activity once there's enough history, otherwise the duration heuristic.
// Fetches the learned value once per activity key; the duration fallback stays
// live so the guess still tracks the duration the user is typing.
export function useLearnedEffortPrefill(opts: {
  routineId?: string | null;
  activityTypeId?: string | null;
  durationMin?: number | null;
}): number {
  const { routineId, activityTypeId, durationMin } = opts;
  const [learned, setLearned] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLearned(null);
    if (!routineId && !activityTypeId) return;
    learnedEffortForActivity({ routineId, activityTypeId })
      .then((value) => { if (!cancelled) setLearned(value); })
      .catch(() => { if (!cancelled) setLearned(null); });
    return () => { cancelled = true; };
  }, [routineId, activityTypeId]);

  return learned ?? predictEffortDefault(durationMin ?? null);
}
