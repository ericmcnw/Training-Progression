import { prisma } from "@/lib/prisma";
import { toAppYmd } from "@/lib/dates";
import { effectiveRoutineDomain } from "@/lib/routines";
import { gradeSort, SENT_OUTCOMES, type ClimbGradeSystem } from "@/lib/climb-types";
import { ENDURANCE_FAMILY_SLUGS } from "@/lib/activity-types";
import {
  currentDailyStreak,
  longestDailyStreak,
  PROFILE_DOMAIN_ORDER,
  type ProfileDomain,
} from "@/lib/profile-summary";

export type { ProfileDomain };

const ENDURANCE_FAMILY_LABELS: Record<string, string> = {
  [ENDURANCE_FAMILY_SLUGS.RUNNING]: "Running",
  [ENDURANCE_FAMILY_SLUGS.WALKING]: "Walking",
  [ENDURANCE_FAMILY_SLUGS.CYCLING]: "Cycling",
  [ENDURANCE_FAMILY_SLUGS.SWIMMING]: "Swimming",
  [ENDURANCE_FAMILY_SLUGS.ROWING]: "Rowing",
};

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
        activityType: { select: { hasPace: true, family: { select: { slug: true } } } },
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

  // Endurance bests pulled from the same pass. Distance/elevation are summed
  // across every endurance modality (a lifetime odometer), but the record
  // tiles carry the family that set them — a 50 mi bike ride and a marathon
  // are not the same achievement. Pace is scoped to running only: averaging a
  // bike's mph into a "best pace" tile next to runs is meaningless.
  let longestDistanceMi = 0;
  let longestDistanceFamily: string | null = null;
  let mostElevationFt = 0;
  let totalEnduranceMi = 0;
  let bestRunPaceSecPerMi: number | null = null;

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

    const familySlug = log.activityType?.family?.slug ?? null;

    if (log.distanceMi != null && log.distanceMi > 0) {
      totalEnduranceMi += log.distanceMi;
      if (log.distanceMi > longestDistanceMi) {
        longestDistanceMi = log.distanceMi;
        longestDistanceFamily = familySlug;
      }
      if (
        log.durationSec &&
        log.distanceMi >= 1 &&
        familySlug === ENDURANCE_FAMILY_SLUGS.RUNNING
      ) {
        const pace = log.durationSec / log.distanceMi;
        if (bestRunPaceSecPerMi === null || pace < bestRunPaceSecPerMi) {
          bestRunPaceSecPerMi = pace;
        }
      }
    }
    if (log.elevationGainFt != null && log.elevationGainFt > mostElevationFt) {
      mostElevationFt = log.elevationGainFt;
    }
  }

  const currentStreak = currentDailyStreak(activeYmds, todayYmd);
  const longestStreak = longestDailyStreak(activeYmds);

  const domainSplit: DomainSplit[] = PROFILE_DOMAIN_ORDER.map((domain) => ({
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
      sub: ENDURANCE_FAMILY_LABELS[longestDistanceFamily ?? ""] ?? undefined,
      accent: "rgba(96,165,250,0.95)",
    });
  }
  if (bestRunPaceSecPerMi !== null) {
    milestones.push({
      key: "pace",
      label: "Best run pace",
      value: formatPace(bestRunPaceSecPerMi),
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
    const name = heaviestSet.sessionExercise?.exercise?.name;
    const reps = heaviestSet.reps ? `${heaviestSet.reps} reps` : null;
    milestones.push({
      key: "heaviest",
      label: "Heaviest set",
      value: `${heaviestSet.weightLb} lb`,
      sub: [name, reps].filter(Boolean).join(" · ") || undefined,
      accent: "rgba(251,146,60,0.95)",
    });
  }
  if (totalSets > 0) {
    milestones.push({ key: "sets", label: "Sets lifted", value: totalSets.toLocaleString() });
  }

  return {
    totalSessions: logs.length,
    activeDays: activeYmds.size,
    // Round to a whole hour once there's ≥100h logged; below that keep one
    // decimal so an early user doesn't see a flat "0".
    totalHours:
      totalDurationSec >= 360_000
        ? Math.round(totalDurationSec / 3600)
        : Math.round(totalDurationSec / 360) / 10,
    firstLogDate,
    currentStreak,
    longestStreak,
    domainSplit,
    milestones,
  };
}
