import { prisma } from "@/lib/prisma";
import { toAppYmd } from "@/lib/dates";
import { effectiveRoutineDomain } from "@/lib/routines";
import { gradeSort, SENT_OUTCOMES, type ClimbGradeSystem } from "@/lib/climb-types";

export type ProfileDomain = "strength" | "cardio" | "mobility" | "sport" | "lifestyle";

export type DomainSplit = { domain: ProfileDomain; count: number };

export type Milestone = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  /** Optional accent color (rgba) for the value text. */
  accent?: string;
};

export type ProfileStats = {
  totalSessions: number;
  activeDays: number;
  totalHours: number;
  firstLogDate: Date | null;
  currentStreak: number;
  longestStreak: number;
  domainSplit: DomainSplit[];
  milestones: Milestone[];
};

const DOMAIN_ORDER: ProfileDomain[] = ["strength", "cardio", "mobility", "sport", "lifestyle"];

// Walks a sorted-descending set of active YMD strings to find the current
// streak (consecutive days ending today or yesterday — not logging yet today
// shouldn't break it) and the longest streak ever.
function computeStreaks(activeYmds: Set<string>, todayYmd: string): { current: number; longest: number } {
  if (activeYmds.size === 0) return { current: 0, longest: 0 };

  const dayMs = 86_400_000;
  const ymdToUtc = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const utcToYmd = (utc: number) => {
    const dt = new Date(utc);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  };

  // Current streak: start at today; if today isn't logged, allow starting at
  // yesterday so an un-logged morning doesn't zero the streak.
  let current = 0;
  let cursor = ymdToUtc(todayYmd);
  if (!activeYmds.has(utcToYmd(cursor))) cursor -= dayMs;
  while (activeYmds.has(utcToYmd(cursor))) {
    current += 1;
    cursor -= dayMs;
  }

  // Longest streak: scan the sorted unique days.
  const sorted = [...activeYmds].map(ymdToUtc).sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] === dayMs) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  return { current, longest };
}

function formatPace(secPerMi: number): string {
  const m = Math.floor(secPerMi / 60);
  const s = Math.round(secPerMi % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

export async function loadProfileStats(todayYmd: string): Promise<ProfileStats> {
  const [logs, climbAttempts, heaviestSet, totalSets] = await Promise.all([
    prisma.routineLog.findMany({
      select: {
        performedAt: true,
        durationSec: true,
        distanceMi: true,
        elevationGainFt: true,
        activityTypeId: true,
        routine: { select: { domain: true, kind: true, subtype: true } },
      },
    }),
    prisma.climbAttempt.findMany({
      select: { grade: true, gradeSystem: true, outcome: true },
    }),
    prisma.setEntry.findFirst({
      where: { weightLb: { not: null } },
      orderBy: { weightLb: "desc" },
      select: {
        weightLb: true,
        reps: true,
        sessionExercise: { select: { exercise: { select: { name: true } } } },
      },
    }),
    prisma.setEntry.count(),
  ]);

  // ── Lifetime totals + domain split + streaks ──────────────────────────────
  const activeYmds = new Set<string>();
  const domainCounts = new Map<ProfileDomain, number>();
  let totalDurationSec = 0;
  let firstLogDate: Date | null = null;

  // Endurance bests pulled from the same pass.
  let longestDistanceMi = 0;
  let mostElevationFt = 0;
  let totalEnduranceMi = 0;
  let bestPaceSecPerMi: number | null = null;

  for (const log of logs) {
    activeYmds.add(toAppYmd(log.performedAt));
    if (!firstLogDate || log.performedAt < firstLogDate) firstLogDate = log.performedAt;
    if (log.durationSec) totalDurationSec += log.durationSec;

    const domain = effectiveRoutineDomain(
      log.routine.domain,
      log.routine.kind,
      log.routine.subtype
    ) as ProfileDomain;
    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);

    if (log.distanceMi != null && log.distanceMi > 0) {
      totalEnduranceMi += log.distanceMi;
      if (log.distanceMi > longestDistanceMi) longestDistanceMi = log.distanceMi;
      if (log.durationSec && log.distanceMi >= 1) {
        const pace = log.durationSec / log.distanceMi;
        if (bestPaceSecPerMi === null || pace < bestPaceSecPerMi) bestPaceSecPerMi = pace;
      }
    }
    if (log.elevationGainFt != null && log.elevationGainFt > mostElevationFt) {
      mostElevationFt = log.elevationGainFt;
    }
  }

  const { current: currentStreak, longest: longestStreak } = computeStreaks(activeYmds, todayYmd);

  const domainSplit: DomainSplit[] = DOMAIN_ORDER.map((domain) => ({
    domain,
    count: domainCounts.get(domain) ?? 0,
  })).filter((d) => d.count > 0);

  // ── Climbing bests ────────────────────────────────────────────────────────
  let hardestBoulder: string | null = null;
  let hardestBoulderSort = -1;
  let hardestRope: string | null = null;
  let hardestRopeSort = -1;
  let totalSends = 0;
  for (const a of climbAttempts) {
    if (!SENT_OUTCOMES.has(a.outcome)) continue;
    totalSends += 1;
    const sort = gradeSort(a.grade, a.gradeSystem as ClimbGradeSystem);
    if (a.gradeSystem === "BOULDER_V") {
      if (sort > hardestBoulderSort) {
        hardestBoulderSort = sort;
        hardestBoulder = a.grade;
      }
    } else if (sort > hardestRopeSort) {
      hardestRopeSort = sort;
      hardestRope = a.grade;
    }
  }

  // ── Milestones (only surface the ones backed by real data) ────────────────
  const milestones: Milestone[] = [];

  if (hardestBoulder) {
    milestones.push({
      key: "boulder",
      label: "Hardest boulder",
      value: hardestBoulder,
      sub: "Clean send",
      accent: "rgba(74,222,128,0.95)",
    });
  }
  if (hardestRope) {
    milestones.push({
      key: "rope",
      label: "Hardest rope",
      value: hardestRope,
      sub: "Clean send",
      accent: "rgba(74,222,128,0.95)",
    });
  }
  if (totalSends > 0) {
    milestones.push({ key: "sends", label: "Total sends", value: String(totalSends) });
  }
  if (longestDistanceMi > 0) {
    milestones.push({
      key: "distance",
      label: "Longest distance",
      value: `${longestDistanceMi.toFixed(1)} mi`,
      accent: "rgba(96,165,250,0.95)",
    });
  }
  if (bestPaceSecPerMi !== null) {
    milestones.push({
      key: "pace",
      label: "Best pace",
      value: formatPace(bestPaceSecPerMi),
      sub: "≥ 1 mi efforts",
      accent: "rgba(96,165,250,0.95)",
    });
  }
  if (totalEnduranceMi > 0) {
    milestones.push({
      key: "totalmiles",
      label: "Lifetime miles",
      value: totalEnduranceMi.toFixed(0),
    });
  }
  if (mostElevationFt > 0) {
    milestones.push({
      key: "elevation",
      label: "Most elevation",
      value: `${mostElevationFt.toLocaleString()} ft`,
    });
  }
  if (heaviestSet?.weightLb) {
    milestones.push({
      key: "heaviest",
      label: "Heaviest set",
      value: `${heaviestSet.weightLb} lb`,
      sub: heaviestSet.sessionExercise?.exercise?.name ?? undefined,
      accent: "rgba(251,146,60,0.95)",
    });
  }
  if (totalSets > 0) {
    milestones.push({ key: "sets", label: "Sets lifted", value: totalSets.toLocaleString() });
  }

  return {
    totalSessions: logs.length,
    activeDays: activeYmds.size,
    totalHours: Math.round(totalDurationSec / 3600),
    firstLogDate,
    currentStreak,
    longestStreak,
    domainSplit,
    milestones,
  };
}
