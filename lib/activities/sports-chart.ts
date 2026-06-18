import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, incrementWeekMap, weekKey } from "@/lib/progress-v2";
import {
  activitiesByFamily,
  getActivityEntry,
  type ActivityRegistryEntry,
} from "@/lib/activity-families";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import type { SessionsByWeek, WeekSession } from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { getWeekBoundsSunday } from "@/lib/week";
import { toAppYmd } from "@/lib/dates";
import { sportSlugFromRoutineId } from "@/lib/synthetic-sport-routines";
import { sessionLoad } from "@/lib/strain";

// 12-week sports chart + per-sport rollup. Mirrors the endurance
// builder's shape so the rest of the dashboard code uses one chart
// component for both. Sports log durations primarily (no distance for
// most), so the chart's unit is "sessions" — one bar segment per
// session, stacked by sport type.

export type SportsChartData = {
  weekLabels: string[];
  series: StackedBarSeries[];
  /** Per-sport totals over the 12w window, sorted by session count desc. */
  perSport: Array<{
    entry: ActivityRegistryEntry;
    sessions: number;
    totalDurationSec: number;
    lastSessionAt: Date | null;
  }>;
  /** Per-week session lists, aligned with `weekLabels` indices. Powers
   *  the click-week-to-reveal session panel under the chart. */
  sessionsByWeek: SessionsByWeek;
};

// One color per registered sport. Hue families are spread so no two
// sports read as the same color on the chart. Previously climbing
// (orange) + basketball (burnt orange) and snowboarding (violet) +
// skiing (soft violet) were near-duplicates.
const SPORT_ACTIVITY_COLORS: Record<string, string> = {
  climbing:       "rgba(251,146,60,0.9)",   // orange — the deep-world sport
  surfing:        "rgba(56,189,248,0.9)",   // cyan
  bodysurfing:    "rgba(2,132,199,0.9)",    // ocean blue — deeper than surf cyan
  snowboarding:   "rgba(168,85,247,0.9)",   // violet
  skiing:         "rgba(99,102,241,0.9)",   // indigo — clear blue-purple, distinct from violet + cyan
  skateboarding:  "rgba(244,114,182,0.9)",  // pink
  basketball:     "rgba(220,38,38,0.9)",    // red — moved off the orange family
  spikeball:      "rgba(250,204,21,0.9)",   // yellow — matches the Spikeball ball
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

  // Resolve the two routine populations this chart reads from:
  //   1. LEGACY: routines tagged with a sports-family metadata group
  //      (e.g. an old "Bouldering" SESSION routine tagged with the
  //      `climbing` slug). Pre-Phase-1 logging path.
  //   2. SYNTHETIC: per-sport placeholder routines created by the
  //      new "Log Sports" surface on /log. Their id encodes the sport
  //      slug (sports-{slug}-synthetic) so no metadata lookup is
  //      needed to attribute the log.
  // Both populations contribute to the same chart and per-sport rollup
  // — chart code is the "bilingual loader" that lets the user migrate
  // from legacy → synthetic without losing history.
  const sportSlugs = new Set(activitiesByFamily("sports").map((s) => s.slug));
  const taggedRoutines = await prisma.routine.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      isPlaceholder: false, // exclude synthetic — handled below
    },
    select: {
      id: true,
      metadataGroups: { select: { group: { select: { slug: true } } } },
    },
  });
  const legacyRoutineIds = taggedRoutines
    .filter((r) =>
      (r.metadataGroups ?? []).some((m) => {
        const slug = m.group?.slug;
        return slug ? sportSlugs.has(slug) : false;
      })
    )
    .map((r) => r.id);

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: cutoff },
      OR: [
        ...(legacyRoutineIds.length > 0
          ? [{ routineId: { in: legacyRoutineIds } }]
          : []),
        // Synthetic sport routines are auto-detectable by their id
        // pattern — no need to query for them up-front.
        { routineId: { startsWith: "sports-", endsWith: "-synthetic" } },
      ],
    },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      durationSec: true,
      effort: true,
      // Routine name powers the session-panel row label. Pulled in the
      // same query — no extra roundtrip.
      routine: { select: { name: true } },
    },
  });

  if (logs.length === 0) {
    return {
      weekLabels: fillWeeklySeries(new Map(), "12w", now).map((p) => p.label),
      series: [],
      perSport: [],
      sessionsByWeek: Array.from({ length: 12 }, () => [] as WeekSession[]),
    };
  }

  // Ordered week-key list for bucketing each log into the right week
  // index for the sessions panel. Mirrors the endurance chart helper.
  const weekKeys: string[] = [];
  const cursor = getWeekBoundsSunday(now).start;
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - i * 7);
    weekKeys.push(toAppYmd(date));
  }
  const weekIndexByKey = new Map(weekKeys.map((k, i) => [k, i]));
  const sessionsByWeek: WeekSession[][] = weekKeys.map(() => []);

  // Build a routineId → sport entry map.
  //   • Legacy routines: pick the most-specific sport slug from their
  //     metadata groups (higher sortHint = more specific).
  //   • Synthetic routines: slug is encoded in the routine id and
  //     resolves to its activity-registry entry directly.
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
  for (const log of logs) {
    if (routineSportEntry.has(log.routineId)) continue;
    const slug = sportSlugFromRoutineId(log.routineId);
    if (!slug) continue;
    const entry = getActivityEntry(slug);
    if (entry && entry.family === "sports") {
      routineSportEntry.set(log.routineId, entry);
    }
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

    // Bucket the log into the right week for the sessions panel.
    const wkIdx = weekIndexByKey.get(weekKey(log.performedAt));
    if (wkIdx !== undefined) {
      sessionsByWeek[wkIdx].push({
        id: log.id,
        performedAt: log.performedAt,
        routineName: log.routine?.name ?? "Untitled session",
        seriesLabel: label,
        seriesColor: "rgba(255,255,255,0.4)", // resolved below
        metricFormatted: log.durationSec ? formatDuration(log.durationSec) : "1 session",
        load: sessionLoad(log.effort, log.durationSec),
        loadEstimated: log.effort == null,
        // RAW rating only — null when unrated. Charts never use an estimate.
        effort: log.effort ?? undefined,
        href: `/routines/${log.routineId}/logs/${log.id}/details`,
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

  // Backfill seriesColor on every captured session now that resolved.
  const colorByLabel = new Map(series.map((s) => [s.label, s.color]));
  for (const weekSessions of sessionsByWeek) {
    for (const ws of weekSessions) {
      const color = colorByLabel.get(ws.seriesLabel);
      if (color) ws.seriesColor = color;
    }
    weekSessions.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }

  return { weekLabels, series, perSport, sessionsByWeek };
}

function formatDuration(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
