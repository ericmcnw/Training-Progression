import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, incrementWeekMap } from "@/lib/progress-v2";
import {
  activitiesByFamily,
  getActivityEntry,
  type ActivityRegistryEntry,
} from "@/lib/activity-families";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";

// 12-week sports chart + per-sport rollup. Mirrors the endurance
// builder's shape so the rest of the dashboard code uses one chart
// component for both. Sports log durations primarily (no distance for
// most), so the chart's unit is "sessions" — one bar segment per
// session, stacked by sport type.

export type SportsChartData = {
  weekLabels: string[];
  series: StackedBarSeries[];
  /** Per-sport totals over the 12w window, sorted by session count desc.
   *  Used to power the dashboard's "Top sports" tile grid alongside the
   *  chart, with no second roundtrip. */
  perSport: Array<{
    entry: ActivityRegistryEntry;
    sessions: number;
    totalDurationSec: number;
    lastSessionAt: Date | null;
  }>;
};

// One color per registered sport. Hue families are spread so two
// neighboring stacked segments never collide visually.
const SPORT_ACTIVITY_COLORS: Record<string, string> = {
  climbing:       "rgba(251,146,60,0.9)",   // orange — the deep-world sport
  surfing:        "rgba(56,189,248,0.9)",   // cyan
  snowboarding:   "rgba(168,85,247,0.9)",   // violet
  skiing:         "rgba(167,139,250,0.9)",  // soft violet
  skateboarding:  "rgba(244,114,182,0.9)",  // pink
  basketball:     "rgba(249,115,22,0.9)",   // burnt orange
  tennis:         "rgba(132,204,22,0.9)",   // chartreuse
  golf:           "rgba(40,212,160,0.9)",   // teal-green
};

const FALLBACK_COLORS = [
  "rgba(236,72,153,0.9)",
  "rgba(245,158,11,0.9)",
  "rgba(74,222,128,0.9)",
];

export async function loadSportsChartData(now = new Date()): Promise<SportsChartData> {
  const cutoff = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

  // Resolve sport-tagged routines so the log query can scope by id.
  const sportSlugs = new Set(activitiesByFamily("sports").map((s) => s.slug));
  const taggedRoutines = await prisma.routine.findMany({
    where: { isActive: true, isDeleted: false },
    select: {
      id: true,
      metadataGroups: { select: { group: { select: { slug: true } } } },
    },
  });
  const sportRoutineIds = taggedRoutines
    .filter((r) =>
      (r.metadataGroups ?? []).some((m) => {
        const slug = m.group?.slug;
        return slug ? sportSlugs.has(slug) : false;
      })
    )
    .map((r) => r.id);

  if (sportRoutineIds.length === 0) {
    return {
      weekLabels: fillWeeklySeries(new Map(), "12w", now).map((p) => p.label),
      series: [],
      perSport: [],
    };
  }

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: cutoff },
      routineId: { in: sportRoutineIds },
    },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      durationSec: true,
    },
  });

  // For each routine, choose the most specific sport slug — sortHint
  // higher = more specific. Mirrors the endurance helper's strategy.
  const routineSportEntry = new Map<string, ActivityRegistryEntry>();
  for (const r of taggedRoutines) {
    const candidates = (r.metadataGroups ?? [])
      .map((m) => m.group?.slug)
      .filter((s): s is string => Boolean(s))
      .map((s) => ({ slug: s, entry: getActivityEntry(s) }))
      .filter((c): c is { slug: string; entry: ActivityRegistryEntry } =>
        c.entry !== null && c.entry.family === "sports"
      )
      .sort((a, b) => (b.entry.sortHint ?? 0) - (a.entry.sortHint ?? 0));
    const chosen = candidates[0];
    if (chosen) routineSportEntry.set(r.id, chosen.entry);
  }

  // Weekly session-count maps per sport.
  const weeklySessionsPerSport = new Map<string, Map<string, number>>();
  const weeklyMinutesPerSport = new Map<string, Map<string, number>>();
  const perSportTotals = new Map<string, {
    entry: ActivityRegistryEntry;
    sessions: number;
    totalDurationSec: number;
    lastSessionAt: Date | null;
  }>();

  for (const log of logs) {
    const entry = routineSportEntry.get(log.routineId);
    if (!entry) continue;
    const label = entry.label;
    if (!weeklySessionsPerSport.has(label)) weeklySessionsPerSport.set(label, new Map());
    if (!weeklyMinutesPerSport.has(label)) weeklyMinutesPerSport.set(label, new Map());
    incrementWeekMap(weeklySessionsPerSport.get(label)!, log.performedAt, 1);
    incrementWeekMap(weeklyMinutesPerSport.get(label)!, log.performedAt, (log.durationSec ?? 0) / 60);

    const existing = perSportTotals.get(entry.slug);
    if (existing) {
      existing.sessions += 1;
      existing.totalDurationSec += log.durationSec ?? 0;
      if (!existing.lastSessionAt || log.performedAt > existing.lastSessionAt) {
        existing.lastSessionAt = log.performedAt;
      }
    } else {
      perSportTotals.set(entry.slug, {
        entry,
        sessions: 1,
        totalDurationSec: log.durationSec ?? 0,
        lastSessionAt: log.performedAt,
      });
    }
  }

  const weekLabels = fillWeeklySeries(new Map(), "12w", now).map((p) => p.label);

  let fallbackIdx = 0;
  const series: StackedBarSeries[] = Array.from(weeklySessionsPerSport.entries())
    .map(([label, weekMap]) => ({
      label,
      total: Array.from(weekMap.values()).reduce((a, b) => a + b, 0),
      weekMap,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((e) => {
      const labelSlug = e.label.toLowerCase().replace(/\s+/g, "-");
      const color =
        SPORT_ACTIVITY_COLORS[labelSlug] ||
        FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
      return {
        label: e.label,
        color,
        weeklyValues: fillWeeklySeries(e.weekMap, "12w", now).map((p) => p.value),
        weeklyMinutes: fillWeeklySeries(weeklyMinutesPerSport.get(e.label) ?? new Map(), "12w", now).map((p) => p.value),
      };
    });

  const perSport = Array.from(perSportTotals.values())
    .sort((a, b) =>
      b.sessions - a.sessions ||
      b.totalDurationSec - a.totalDurationSec ||
      a.entry.label.localeCompare(b.entry.label)
    );

  return { weekLabels, series, perSport };
}
