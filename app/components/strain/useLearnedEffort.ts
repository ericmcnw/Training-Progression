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
  // Stamp the fetched value with the activity key it belongs to. While a new
  // key's fetch is in flight the stamp won't match, so we fall back to the
  // duration heuristic rather than show a stale activity's learned value —
  // and we avoid resetting state synchronously inside the effect.
  const key = activityTypeId ? `t:${activityTypeId}` : routineId ? `r:${routineId}` : "";
  const [entry, setEntry] = useState<{ key: string; value: number | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    learnedEffortForActivity({ routineId, activityTypeId })
      .then((value) => { if (!cancelled) setEntry({ key, value }); })
      .catch(() => { if (!cancelled) setEntry({ key, value: null }); });
    return () => { cancelled = true; };
  }, [key, routineId, activityTypeId]);

  const learned = entry && entry.key === key ? entry.value : null;
  return learned ?? predictEffortDefault(durationMin ?? null);
}
