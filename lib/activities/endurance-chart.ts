import { prisma } from "@/lib/prisma";
import { fillWeeklySeries, incrementWeekMap, weekKey } from "@/lib/progress-v2";
import {
  activitiesByFamily,
  getActivityEntry,
} from "@/lib/activity-families";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import type { SessionsByWeek, WeekSession } from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { getWeekBoundsSunday } from "@/lib/week";
import { toAppYmd } from "@/lib/dates";
import { formatPace } from "@/lib/progress";
import {
  TYPE_SLUG_TO_REGISTRY_SLUG,
  ENDURANCE_ACTIVITY_COLORS,
  ENDURANCE_FALLBACK_COLORS as FALLBACK_COLORS,
} from "@/lib/activities/endurance-palette";

// Builds the 12-week stacked-bar chart series for the endurance
// dashboard. Two log sources roll into the same chart so an edited log
// shows up in its *current* type bucket, not the routine's pre-edit
// metadata bucket:
//   1. Logs against legacy endurance-tagged routines (metadata-based).
//   2. Any log carrying activityTypeId — covers typed quick-log logs
//      against the synthetic Endurance routine AND legacy logs whose
//      activityTypeId was overridden via the edit-log type switcher.
//
// Returns one series per active activity type (sorted desc by total
// mileage), plus a parallel array of week labels.
export type EnduranceChartData = {
  weekLabels: string[];
  series: StackedBarSeries[];
  /** Per-week session lists, aligned with `weekLabels` indices. Powers
   *  the click-week-to-reveal session panel under the chart. */
  sessionsByWeek: SessionsByWeek;
};

export async function loadEnduranceChartData(input?: {
  familySlug?: string;
  typeSlug?: string | null;
  now?: Date;
}): Promise<EnduranceChartData> {
  const now = input?.now ?? new Date();
  const familySlug = input?.familySlug ?? "overview";
  const typeSlug = input?.typeSlug ?? null;
  const cutoff = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

  // Resolve the endurance-tagged routine ids in a small first round-trip
  // so the log query can filter on them.
  const enduranceSlugs = new Set(activitiesByFamily("endurance").map((e) => e.slug));
  const taggedRoutines = await prisma.routine.findMany({
    where: { isActive: true, isDeleted: false },
    select: {
      id: true,
      metadataGroups: { select: { group: { select: { slug: true } } } },
    },
  });
  const enduranceRoutineIds = taggedRoutines
    .filter((r) =>
      (r.metadataGroups ?? []).some((m) => {
        const slug = m.group?.slug;
        return slug ? enduranceSlugs.has(slug) : false;
      })
    )
    .map((r) => r.id);

  // Resolve the active family + type so we can narrow the log query at
  // the SQL layer. Both are optional — Overview keeps the multi-line
  // view across every family.
  const families = await prisma.enduranceFamily.findMany({
    select: {
      id: true,
      slug: true,
      types: { select: { id: true, slug: true } },
    },
  });
  const activeFamily =
    familySlug === "overview" ? null : families.find((f) => f.slug === familySlug) ?? null;
  const activeType =
    activeFamily && typeSlug
      ? activeFamily.types.find((t) => t.slug === typeSlug) ?? null
      : null;

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: cutoff },
      OR: [
        ...(enduranceRoutineIds.length > 0
          ? [{ routineId: { in: enduranceRoutineIds } }]
          : []),
        { activityTypeId: { not: null } },
      ],
      // Family/type narrowing — only when the user has scoped down via
      // the family tabs / type sub-pills. Legacy un-typed logs against
      // metadata-tagged routines don't survive a type filter (they have
      // no activityType to match) — that's intended; the Overview tab
      // remains the single source of truth for un-typed data.
      ...(activeFamily
        ? {
            activityType: activeType
              ? { id: activeType.id }
              : { familyId: activeFamily.id },
          }
        : {}),
    },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      distanceMi: true,
      durationSec: true,
      activityTypeId: true,
      activityType: {
        select: { slug: true, name: true, family: { select: { slug: true } } },
      },
      // Routine name powers the session-panel row label. Pulled in the
      // same query — no extra roundtrip.
      routine: { select: { name: true } },
    },
  });

  // Build the ordered week-key list (oldest → newest, length 12) the
  // chart will render. Used to bucket each log into the right week
  // index for the sessions panel.
  const weekKeys: string[] = [];
  const cursor = getWeekBoundsSunday(now).start;
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - i * 7);
    weekKeys.push(toAppYmd(date));
  }
  const weekIndexByKey = new Map(weekKeys.map((k, i) => [k, i]));
  const sessionsByWeek: WeekSession[][] = weekKeys.map(() => []);

  // For each tagged routine, pick the most specific endurance slug —
  // sortHint = higher specificity.
  const routineEnduranceLabel = new Map<string, string>();
  for (const r of taggedRoutines) {
    const candidates = (r.metadataGroups ?? [])
      .map((m) => m.group?.slug)
      .filter((s): s is string => Boolean(s))
      .filter((s) => enduranceSlugs.has(s))
      .map((s) => ({ slug: s, entry: getActivityEntry(s) }))
      .filter((c): c is { slug: string; entry: NonNullable<ReturnType<typeof getActivityEntry>> } => c.entry !== null)
      .sort((a, b) => (b.entry.sortHint ?? 0) - (a.entry.sortHint ?? 0));
    const chosen = candidates[0];
    if (chosen) routineEnduranceLabel.set(r.id, chosen.entry.label);
  }

  // Build per-activity weekly miles + minutes maps. Label comes from the
  // log's activityType when present; falls back to the routine's
  // chosen-slug label for legacy un-typed logs.
  const seriesPaletteSlug = new Map<string, string>();
  const weeklyMilesPerActivity = new Map<string, Map<string, number>>();
  const weeklyMinutesPerActivity = new Map<string, Map<string, number>>();

  for (const log of logs) {
    let label: string | undefined;
    let paletteSlug: string | undefined;
    if (log.activityType) {
      // ActivityType rows only exist for endurance activities today
      // (every row sits under an EnduranceFamily), so a typed log is
      // already endurance — no need for a family check. Trust the
      // user's per-log type over the routine's pre-edit metadata.
      label = log.activityType.name;
      paletteSlug = TYPE_SLUG_TO_REGISTRY_SLUG[log.activityType.slug];
    } else {
      label = routineEnduranceLabel.get(log.routineId);
    }
    if (!label) continue;

    if (paletteSlug) seriesPaletteSlug.set(label, paletteSlug);
    if (!weeklyMilesPerActivity.has(label)) weeklyMilesPerActivity.set(label, new Map());
    if (!weeklyMinutesPerActivity.has(label)) weeklyMinutesPerActivity.set(label, new Map());

    incrementWeekMap(weeklyMilesPerActivity.get(label)!, log.performedAt, log.distanceMi ?? 0);
    incrementWeekMap(weeklyMinutesPerActivity.get(label)!, log.performedAt, (log.durationSec ?? 0) / 60);

    // Bucket the log into the right week index for the sessions panel.
    // Color is resolved below when we finalize series; we revisit and
    // backfill seriesColor on each session after the series array exists.
    const wkIdx = weekIndexByKey.get(weekKey(log.performedAt));
    if (wkIdx !== undefined) {
      const distance = log.distanceMi ?? 0;
      const duration = log.durationSec ?? 0;
      // Endurance sessions read richest with all three: distance,
      // duration, pace. Pace is only meaningful when both are present
      // (and distance > 0 to avoid div-by-zero). When only one signal
      // exists, surface that one.
      const parts: string[] = [];
      if (distance > 0) {
        parts.push(`${distance >= 100 ? distance.toFixed(0) : distance.toFixed(1)} mi`);
      }
      if (duration > 0) {
        parts.push(formatDuration(duration));
      }
      if (distance > 0 && duration > 0) {
        // formatPace already appends "/mi" — don't double-suffix.
        parts.push(formatPace(duration / distance));
      }
      const metricFormatted = parts.length > 0 ? parts.join(" · ") : "—";
      sessionsByWeek[wkIdx].push({
        id: log.id,
        performedAt: log.performedAt,
        routineName: log.routine?.name ?? "Untitled session",
        seriesLabel: label,
        seriesColor: "rgba(255,255,255,0.4)", // placeholder — resolved below
        metricFormatted,
        href: `/routines/${log.routineId}/logs/${log.id}/details`,
      });
    }
  }

  const weekLabels = fillWeeklySeries(new Map(), "12w", now).map((p) => p.label);

  let fallbackIdx = 0;
  const series: StackedBarSeries[] = Array.from(weeklyMilesPerActivity.entries())
    .map(([label, weekMap]) => ({
      label,
      total: Array.from(weekMap.values()).reduce((a, b) => a + b, 0),
      weekMap,
    }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((e) => {
      const paletteSlug = seriesPaletteSlug.get(e.label);
      const labelSlug = e.label.toLowerCase().replace(/\s+/g, "-");
      const color =
        (paletteSlug && ENDURANCE_ACTIVITY_COLORS[paletteSlug]) ||
        ENDURANCE_ACTIVITY_COLORS[labelSlug] ||
        FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
      return {
        label: e.label,
        color,
        weeklyValues: fillWeeklySeries(e.weekMap, "12w", now).map((p) => p.value),
        weeklyMinutes: fillWeeklySeries(weeklyMinutesPerActivity.get(e.label) ?? new Map(), "12w", now).map((p) => p.value),
      };
    });

  // Backfill seriesColor on every captured session now that the series
  // colors are resolved. Sessions whose label didn't make it into the
  // series (filtered out because total === 0) keep the placeholder
  // gray — those won't render in the panel anyway since their week
  // bars don't exist either.
  const colorByLabel = new Map(series.map((s) => [s.label, s.color]));
  for (const weekSessions of sessionsByWeek) {
    for (const ws of weekSessions) {
      const color = colorByLabel.get(ws.seriesLabel);
      if (color) ws.seriesColor = color;
    }
  }
  // Sort sessions within each week by date (oldest → newest) so the
  // panel reads top-down as the week unfolded.
  for (const weekSessions of sessionsByWeek) {
    weekSessions.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }

  return { weekLabels, series, sessionsByWeek };
}

function formatDuration(sec: number): string {
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}
