import { daysAgoMidnight, startOfWeekMonday } from "@/lib/week";
import type { PulseSlot } from "./ActivityPulseStrip";

// Minimum log shape any pulse builder needs. Bigger log shapes (with eg.
// elevation, location) extend this. Builders only read fields they understand,
// so extra properties are tolerated.
export type PulseLogInput = {
  performedAt: Date;
  durationSec: number | null;
  distanceMi: number | null;
  elevationGainFt?: number | null;
  location?: string | null;
};

function trendArrow(curr: number, prev: number, opts?: { lowerIsBetter?: boolean }) {
  const lowerIsBetter = opts?.lowerIsBetter ?? false;
  if (curr === prev) return { arrow: "→", tone: "flat" as const, delta: "0" };
  const better = lowerIsBetter ? curr < prev : curr > prev;
  const delta = curr - prev;
  return {
    arrow: better ? "↑" : "↓",
    tone: better ? ("up" as const) : ("down" as const),
    delta: delta > 0 ? `+${delta}` : `${delta}`,
  };
}

function weeklyStreak(sessions: PulseLogInput[], now: Date): { current: number; longest: number } {
  if (sessions.length === 0) return { current: 0, longest: 0 };
  const weekKeys = new Set<string>();
  for (const s of sessions) weekKeys.add(startOfWeekMonday(s.performedAt).toISOString().slice(0, 10));
  const sorted = [...weekKeys].sort();

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = Math.round(
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    if (gap === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  let current = 0;
  let cursor = startOfWeekMonday(now);
  while (weekKeys.has(cursor.toISOString().slice(0, 10))) {
    current += 1;
    cursor = new Date(cursor.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return { current, longest };
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatHours(sec: number) {
  // Compact h/m display — "1h 30m" / "4h" / "45m" / "0h" — preferred over the
  // decimal-hour form (1.5h) for human readability on activity world cards.
  if (sec <= 0) return "0h";
  const totalMin = Math.floor(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatPace(secPerMile: number) {
  if (!Number.isFinite(secPerMile) || secPerMile <= 0) return "—";
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatMiles(mi: number) {
  if (mi <= 0) return "0 mi";
  if (mi >= 100) return `${Math.round(mi)} mi`;
  return `${mi.toFixed(1)} mi`;
}

// ── Pulse builders ───────────────────────────────────────────────────────────

const ACCENT_BLUE = "rgba(78,148,255,0.9)";
const ACCENT_AMBER = "rgba(251,191,36,0.9)";
const ACCENT_ORANGE = "rgba(251,146,60,0.9)";
const ACCENT_GREEN = "rgba(74,222,128,0.9)";
const ACCENT_TEAL = "rgba(45,212,191,0.9)";

/**
 * Endurance / cardio activity pulse: This Week miles · Recent fastest pace ·
 * All-time longest single session · Weekly streak.
 *
 * Pace slot only renders when the activity has any pace data (some endurance
 * activities — eg. swimming pool laps logged as duration only — won't have
 * a meaningful pace).
 */
export function buildCardioPulse(sessions: PulseLogInput[], now: Date): PulseSlot[] {
  const thisWeekStart = startOfWeekMonday(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = daysAgoMidnight(now, 30);
  const sixtyDaysAgo = daysAgoMidnight(now, 60);

  const thisWeek = sessions.filter((s) => s.performedAt >= thisWeekStart);
  const lastWeek = sessions.filter((s) => s.performedAt >= lastWeekStart && s.performedAt < thisWeekStart);
  const thisWeekMiles = thisWeek.reduce((sum, s) => sum + (s.distanceMi ?? 0), 0);
  const lastWeekMiles = lastWeek.reduce((sum, s) => sum + (s.distanceMi ?? 0), 0);
  const thisWeekSessions = thisWeek.length;

  // Pace = sec/mile of the fastest session in the last 30d (need both metrics).
  const paceCandidates = sessions.filter(
    (s) => (s.distanceMi ?? 0) > 0 && (s.durationSec ?? 0) > 0
  );
  const recentPaceLogs = paceCandidates.filter((s) => s.performedAt >= thirtyDaysAgo);
  const priorPaceLogs = paceCandidates.filter(
    (s) => s.performedAt >= sixtyDaysAgo && s.performedAt < thirtyDaysAgo
  );
  const minPace = (logs: PulseLogInput[]) =>
    logs.length === 0
      ? null
      : Math.min(...logs.map((s) => (s.durationSec ?? 0) / (s.distanceMi ?? 1)));
  const recentBestPace = minPace(recentPaceLogs);
  const priorBestPace = minPace(priorPaceLogs);

  // All-time longest single session distance.
  const longestMi = sessions.reduce((max, s) => Math.max(max, s.distanceMi ?? 0), 0);
  const longestLog = sessions.find((s) => (s.distanceMi ?? 0) === longestMi && longestMi > 0) ?? null;

  const streak = weeklyStreak(sessions, now);

  const slots: PulseSlot[] = [];

  // Slot 1 — This Week
  slots.push({
    role: "frequency",
    label: "This Week",
    value: thisWeekMiles > 0 ? formatMiles(thisWeekMiles) : `${thisWeekSessions}`,
    sub:
      thisWeekSessions === 0
        ? "No sessions yet"
        : thisWeekMiles > 0
        ? `${thisWeekSessions} session${thisWeekSessions !== 1 ? "s" : ""}`
        : `${thisWeekSessions} session${thisWeekSessions !== 1 ? "s" : ""} (no distance logged)`,
    trend:
      lastWeekMiles > 0 || thisWeekMiles > 0
        ? {
            ...trendArrow(Math.round(thisWeekMiles), Math.round(lastWeekMiles)),
            suffix: " mi vs last wk",
          }
        : undefined,
    accent: ACCENT_BLUE,
  });

  // Slot 2 — Recent Pace (only if we have pace data)
  if (paceCandidates.length > 0) {
    slots.push({
      role: "recent-performance",
      label: "30-Day Best Pace",
      value: recentBestPace ? formatPace(recentBestPace) : "—",
      sub: recentBestPace
        ? priorBestPace
          ? `Prior 30d best: ${formatPace(priorBestPace)}`
          : "First fast effort in window"
        : "Log a paced effort to start tracking",
      trend:
        recentBestPace && priorBestPace
          ? (() => {
              const t = trendArrow(Math.round(recentBestPace), Math.round(priorBestPace), { lowerIsBetter: true });
              return { ...t, delta: `${t.delta}s`, suffix: "/mi" };
            })()
          : undefined,
      accent: ACCENT_ORANGE,
    });
  }

  // Slot 3 — All-time longest
  slots.push({
    role: "all-time-best",
    label: "Longest",
    value: longestMi > 0 ? formatMiles(longestMi) : "—",
    sub: longestLog
      ? `On ${longestLog.performedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : "No distance logged yet",
    accent: ACCENT_AMBER,
  });

  // Slot 4 — Weekly streak
  slots.push({
    role: "streak",
    label: "Weekly Streak",
    value: `${streak.current}w`,
    sub:
      streak.current === 0
        ? "Log this week to start"
        : streak.longest > streak.current
        ? `Best run: ${streak.longest} weeks`
        : "Personal best — keep going",
    accent: ACCENT_GREEN,
  });

  return slots;
}

// ── Strength inputs ──────────────────────────────────────────────────────────

export type StrengthSetSummary = {
  weightLb: number;
  reps: number;
  volume: number;
};

export type StrengthPulseInput = {
  /** All-time strength session dates, used for streak + week filtering. */
  sessionDates: Date[];
  /** Set count this week. */
  thisWeekSets: number;
  /** Set count last week (for trend). */
  lastWeekSets: number;
  /** Number of sessions this week. */
  thisWeekSessions: number;
  /** Most-recent PR's exercise name + weight×reps, if any in last 30 days. */
  recentPR: { exerciseName: string; weight: number; reps: number; date: Date } | null;
  /** All-time heaviest single set across all exercises. */
  allTimePR: { exerciseName: string; weight: number; reps: number } | null;
};

/**
 * Strength pulse: This Week sets · Recent PR · All-time top weight · Weekly
 * streak. Strength sessions are workout-shaped (sets+reps+weight) so the
 * frequency slot uses sets logged, not miles or hours.
 */
export function buildStrengthPulse(input: StrengthPulseInput, now: Date): PulseSlot[] {
  const sessions = input.sessionDates.map((date) => ({
    performedAt: date,
    durationSec: null,
    distanceMi: null,
  })) satisfies PulseLogInput[];
  const streak = weeklyStreak(sessions, now);

  const slots: PulseSlot[] = [
    {
      role: "frequency",
      label: "This Week",
      value: String(input.thisWeekSets),
      sub:
        input.thisWeekSessions === 0
          ? "No sessions yet"
          : `${input.thisWeekSessions} session${input.thisWeekSessions !== 1 ? "s" : ""} · sets logged`,
      trend:
        input.thisWeekSets > 0 || input.lastWeekSets > 0
          ? { ...trendArrow(input.thisWeekSets, input.lastWeekSets), suffix: " sets vs last wk" }
          : undefined,
      accent: ACCENT_GREEN,
    },
    {
      role: "recent-performance",
      label: "Recent PR",
      value: input.recentPR ? `${input.recentPR.weight} lb` : "—",
      sub: input.recentPR
        ? `${input.recentPR.exerciseName} · ${input.recentPR.reps} rep${input.recentPR.reps !== 1 ? "s" : ""} on ${input.recentPR.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : "Hit a new max in the last 30 days to see it here",
      accent: ACCENT_ORANGE,
    },
    {
      role: "all-time-best",
      label: "Heaviest Set",
      value: input.allTimePR ? `${input.allTimePR.weight} lb` : "—",
      sub: input.allTimePR
        ? `${input.allTimePR.exerciseName} · ${input.allTimePR.reps} rep${input.allTimePR.reps !== 1 ? "s" : ""}`
        : "Log a set with weight to start tracking",
      accent: ACCENT_AMBER,
    },
    {
      role: "streak",
      label: "Weekly Streak",
      value: `${streak.current}w`,
      sub:
        streak.current === 0
          ? "Train this week to start"
          : streak.longest > streak.current
          ? `Best run: ${streak.longest} weeks`
          : "Personal best — keep going",
      accent: ACCENT_BLUE,
    },
  ];

  return slots;
}

/**
 * Board sport pulse (surfing / snowboarding): This Week sessions · Top spot ·
 * All-time time on board · Weekly streak. No pace metric — these activities
 * are session-shaped, not distance-shaped.
 */
export function buildBoardSportPulse(sessions: PulseLogInput[], now: Date): PulseSlot[] {
  const thisWeekStart = startOfWeekMonday(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const thisWeek = sessions.filter((s) => s.performedAt >= thisWeekStart);
  const lastWeek = sessions.filter((s) => s.performedAt >= lastWeekStart && s.performedAt < thisWeekStart);
  const thisWeekSessions = thisWeek.length;
  const lastWeekSessions = lastWeek.length;
  const thisWeekDuration = thisWeek.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

  // Top spot: most-visited location across all-time logs.
  const spotCounts = new Map<string, number>();
  for (const s of sessions) {
    const loc = s.location?.trim();
    if (!loc) continue;
    spotCounts.set(loc, (spotCounts.get(loc) ?? 0) + 1);
  }
  const sortedSpots = [...spotCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topSpot = sortedSpots[0] ?? null;
  const totalNamedSpots = sortedSpots.length;

  // All-time time on board.
  const totalDurationSec = sessions.reduce((sum, s) => sum + (s.durationSec ?? 0), 0);

  const streak = weeklyStreak(sessions, now);

  const slots: PulseSlot[] = [
    {
      role: "frequency",
      label: "This Week",
      value: String(thisWeekSessions),
      sub:
        thisWeekSessions === 0
          ? "No sessions yet"
          : thisWeekDuration > 0
          ? `${formatHours(thisWeekDuration)} on board`
          : `${thisWeekSessions} session${thisWeekSessions !== 1 ? "s" : ""}`,
      trend:
        thisWeekSessions > 0 || lastWeekSessions > 0
          ? { ...trendArrow(thisWeekSessions, lastWeekSessions), suffix: " vs last wk" }
          : undefined,
      accent: ACCENT_BLUE,
    },
    {
      role: "recent-performance",
      label: "Top Spot",
      value: topSpot ? String(topSpot[1]) : "—",
      sub: topSpot
        ? `${topSpot[0]} · ${topSpot[1]} session${topSpot[1] !== 1 ? "s" : ""}`
        : "Tag a spot to start tracking",
      accent: ACCENT_TEAL,
    },
    {
      role: "all-time-best",
      label: "Time on Board",
      value: totalDurationSec > 0 ? formatHours(totalDurationSec) : "—",
      sub: totalNamedSpots > 0
        ? `Across ${totalNamedSpots} spot${totalNamedSpots !== 1 ? "s" : ""}`
        : "All-time logged duration",
      accent: ACCENT_AMBER,
    },
    {
      role: "streak",
      label: "Weekly Streak",
      value: `${streak.current}w`,
      sub:
        streak.current === 0
          ? "Log this week to start"
          : streak.longest > streak.current
          ? `Best run: ${streak.longest} weeks`
          : "Personal best — keep going",
      accent: ACCENT_GREEN,
    },
  ];

  return slots;
}
