// Shared descriptive aggregation over a window's ReportLog[]. Period-agnostic:
// the same summarize() powers week/month/year and (later) the profile pulse,
// and feeds the this-vs-previous comparison by running over the prior window.

import { toAppYmd } from "@/lib/dates";
import { sessionLoad } from "@/lib/strain";
import {
  longestDailyStreak,
  PROFILE_DOMAIN_ORDER as DOMAIN_ORDER,
  type ProfileDomain as Domain,
} from "@/lib/profile-summary";
import type { ReportLog } from "./load";

export type TopRoutine = { id: string; name: string; count: number; domain: Domain };

export type ReportSummary = {
  sessions: number;
  totalSec: number;
  totalMi: number;
  totalElevFt: number;
  /** Cumulative training load (effort × duration) via lib/strain. */
  load: number;
  activeDays: number;
  longestStreak: number;
  perDomain: Record<Domain, number>;
  activeDomains: Domain[];
  /** ymd → session count, for heatmaps. */
  dayCounts: Map<string, number>;
  topRoutines: TopRoutine[];
  longest: ReportLog | null;
  furthest: ReportLog | null;
};

export function summarize(logs: ReportLog[]): ReportSummary {
  const perDomain: Record<Domain, number> = {
    strength: 0, cardio: 0, mobility: 0, sport: 0, lifestyle: 0,
  };
  const dayCounts = new Map<string, number>();
  const routineMap = new Map<string, TopRoutine>();

  let totalSec = 0;
  let totalMi = 0;
  let totalElevFt = 0;
  let load = 0;
  let longest: ReportLog | null = null;
  let furthest: ReportLog | null = null;

  for (const l of logs) {
    perDomain[l.domain]++;
    totalSec += l.durationSec ?? 0;
    totalMi += l.distanceMi ?? 0;
    totalElevFt += l.elevationGainFt ?? 0;
    load += sessionLoad(l.effort, l.durationSec, l.distanceMi);

    const ymd = toAppYmd(l.performedAt);
    dayCounts.set(ymd, (dayCounts.get(ymd) ?? 0) + 1);

    const existing = routineMap.get(l.routineId);
    if (existing) existing.count++;
    else routineMap.set(l.routineId, { id: l.routineId, name: l.routine.name, count: 1, domain: l.domain });

    if ((l.durationSec ?? 0) > (longest?.durationSec ?? 0)) longest = l;
    if (l.distanceMi && (l.distanceMi ?? 0) > (furthest?.distanceMi ?? 0)) furthest = l;
  }

  return {
    sessions: logs.length,
    totalSec,
    totalMi,
    totalElevFt,
    load,
    activeDays: dayCounts.size,
    longestStreak: longestDailyStreak(new Set(dayCounts.keys())),
    perDomain,
    activeDomains: DOMAIN_ORDER.filter((d) => perDomain[d] > 0),
    dayCounts,
    topRoutines: Array.from(routineMap.values()).sort((a, b) => b.count - a.count).slice(0, 5),
    longest,
    furthest,
  };
}

export type Delta = {
  cur: number;
  prev: number;
  diff: number;
  /** Percent change vs prev, or null when prev is 0 (avoid divide-by-zero). */
  pct: number | null;
  dir: "up" | "down" | "flat";
};

export function delta(cur: number, prev: number): Delta {
  const diff = cur - prev;
  return {
    cur,
    prev,
    diff,
    pct: prev > 0 ? (diff / prev) * 100 : null,
    dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}
