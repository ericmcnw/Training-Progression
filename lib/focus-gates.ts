// Milestone gate evaluation. A gate is the condition to advance a milestone.
// PAIN gates auto-evaluate from readings; FREE_TEXT is self-assessed. Pure +
// isomorphic — pass readings + today in, get a verdict out.

import { addDaysYmd } from "@/lib/dates";

export type GateReading = { ymd: string; level: number };

export type GateVerdict = {
  met: boolean;
  // One-line human summary for the UI ("≤2 held 7d ✓", "recent max 4").
  summary: string;
};

// FREQUENCY gate: the routine averaged ≥ perWeek sessions/week over the last
// `weeks` weeks. weeklyCounts arrives oldest → newest (the same 8-bucket array
// TrackActivity computes); we evaluate the trailing `weeks` buckets. Answers
// "have I been doing it enough to advance?" from real logs.
export function evaluateFrequencyGate(
  weeklyCounts: number[],
  perWeek: number,
  weeks: number
): GateVerdict {
  const w = Math.max(1, Math.min(weeks, weeklyCounts.length));
  const window = weeklyCounts.slice(-w);
  const total = window.reduce((s, n) => s + n, 0);
  const avg = total / w;
  const avgLabel = (Math.round(avg * 10) / 10).toString();
  if (avg >= perWeek - 1e-9) {
    return { met: true, summary: `${avgLabel}×/wk over ${w}wk ✓` };
  }
  return { met: false, summary: `${avgLabel}×/wk over ${w}wk · need ${perWeek}×` };
}

// PAIN gate: every reading in the trailing `days`-day window is ≤ threshold,
// and there's at least one reading in that window (so it isn't vacuously true
// with no data). Forgiving of missed days — it checks the readings that exist,
// not that every calendar day was logged.
export function evaluatePainGate(
  readings: GateReading[],
  threshold: number,
  days: number,
  todayYmd: string
): GateVerdict {
  const windowStart = addDaysYmd(todayYmd, -(Math.max(1, days) - 1));
  const inWindow = readings.filter((r) => r.ymd >= windowStart && r.ymd <= todayYmd);

  if (inWindow.length === 0) {
    return { met: false, summary: `needs ≤${threshold} for ${days}d · no readings yet` };
  }
  const maxLevel = Math.max(...inWindow.map((r) => r.level));
  if (maxLevel <= threshold) {
    return { met: true, summary: `≤${threshold} held ${days}d ✓` };
  }
  return { met: false, summary: `≤${threshold} for ${days}d · recent max ${maxLevel}` };
}
