import { prisma } from "@/lib/prisma";
import { weekKey } from "@/lib/progress-v2";
import { activitiesByFamily, getActivityEntry } from "@/lib/activity-families";
import { getWeekBoundsSunday } from "@/lib/week";
import { toAppYmd } from "@/lib/dates";
import {
  ENDURANCE_FALLBACK_COLORS,
  colorForActivity,
} from "@/lib/activities/endurance-palette";

// Pace chart for the endurance dashboard. Two display modes:
//
//   weekly: multi-line — one line per active activity type, points are
//   the type's weighted-average pace for that week (sum sec / sum mi).
//   Weeks with no distance-and-duration data for a series are gaps in
//   the line. Always a fixed 12-week window so it parks alongside the
//   miles bar chart.
//
//   session: single-line — one point per individual session for the
//   selected activity type, x-axis is performedAt. Triggered when the
//   user filters down to a specific type via the family-detail sub-pills.
//
// Pace = duration / distance. Sessions missing either dimension are
// silently excluded (a Workout-style cardio with only time logged still
// counts toward miles totals elsewhere but can't contribute pace).

export type WeeklyPaceSeries = {
  label: string;
  color: string;
  // One entry per week (12 entries, oldest → newest), null when the
  // series logged nothing pace-eligible that week so the line breaks
  // visually instead of dragging through 0.
  weeklyPaceSec: Array<number | null>;
};

export type WeeklyPaceData = {
  mode: "weekly";
  weekLabels: string[];
  series: WeeklyPaceSeries[];
};

export type SessionPacePoint = {
  id: string;
  performedAt: Date;
  paceSec: number;
  distanceMi: number;
  durationSec: number;
  routineName: string;
  href: string;
};

export type SessionPaceData = {
  mode: "session";
  typeName: string;
  color: string;
  points: SessionPacePoint[];
};

export type PaceChartData = WeeklyPaceData | SessionPaceData | null;

// ─── Public entry point ─────────────────────────────────────────────────────

export async function loadEndurancePaceChart(input: {
  familySlug: string; // "overview" or a family slug
  typeSlug: string | null;
  now?: Date;
}): Promise<PaceChartData> {
  const now = input.now ?? new Date();

  // Always a 12-week window so the weekly view stays comparable across
  // visits. Session mode uses the same window so a typed log retyped
  // two months ago doesn't disappear from the view.
  const cutoff = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);

  // Same dual-source rule as the bar chart: typed logs OR logs against
  // metadata-tagged endurance routines.
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

  // Per-routine "most specific endurance label" so legacy un-typed logs
  // still bucket into the right line.
  const routineEnduranceLabel = new Map<string, string>();
  for (const r of taggedRoutines) {
    const candidates = (r.metadataGroups ?? [])
      .map((m) => m.group?.slug)
      .filter((s): s is string => Boolean(s))
      .filter((s) => enduranceSlugs.has(s))
      .map((s) => ({ slug: s, entry: getActivityEntry(s) }))
      .filter((c): c is { slug: string; entry: NonNullable<ReturnType<typeof getActivityEntry>> } => c.entry !== null)
      .sort((a, b) => (b.entry.sortHint ?? 0) - (a.entry.sortHint ?? 0));
    if (candidates[0]) routineEnduranceLabel.set(r.id, candidates[0].entry.label);
  }

  // Resolve the family + type the user is currently scoped to. Both are
  // optional — overview shows every family, no-type shows every type
  // within a family.
  const families = await prisma.enduranceFamily.findMany({
    select: {
      id: true,
      slug: true,
      types: { select: { id: true, slug: true, name: true } },
    },
  });
  const activeFamily =
    input.familySlug === "overview" ? null : families.find((f) => f.slug === input.familySlug) ?? null;
  const activeType =
    activeFamily && input.typeSlug
      ? activeFamily.types.find((t) => t.slug === input.typeSlug) ?? null
      : null;

  const logs = await prisma.routineLog.findMany({
    where: {
      performedAt: { gte: cutoff },
      // Pace requires both — narrow at the SQL layer so we don't drag
      // duration-only or distance-only sessions into the JS rollup.
      distanceMi: { gt: 0 },
      durationSec: { gt: 0 },
      OR: [
        ...(enduranceRoutineIds.length > 0
          ? [{ routineId: { in: enduranceRoutineIds } }]
          : []),
        { activityTypeId: { not: null } },
      ],
      // Family/type narrowing — only when the user has scoped down.
      ...(activeFamily
        ? {
            activityType: activeType
              ? { id: activeType.id }
              : { familyId: activeFamily.id },
          }
        : {}),
    },
    orderBy: { performedAt: "asc" },
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
      routine: { select: { name: true } },
    },
  });

  // ── Session mode (a specific type is selected) ─────────────────────────
  if (activeType) {
    const points: SessionPacePoint[] = logs
      .filter((l) => l.distanceMi && l.durationSec)
      .map((l) => ({
        id: l.id,
        performedAt: l.performedAt,
        paceSec: l.durationSec! / l.distanceMi!, // sec per mile
        distanceMi: l.distanceMi!,
        durationSec: l.durationSec!,
        routineName: l.routine?.name ?? "Untitled session",
        href: `/routines/${l.routineId}/logs/${l.id}/details`,
      }));

    if (points.length === 0) return null;

    const color =
      colorForActivity(activeType.name, activeType.slug) ?? ENDURANCE_FALLBACK_COLORS[0];

    return {
      mode: "session",
      typeName: activeType.name,
      color,
      points,
    };
  }

  // ── Weekly mode (overview or family with no type) ──────────────────────

  // Build the ordered 12-week key list (oldest → newest) — same shape as
  // the miles bar chart so the two charts line up visually.
  const weekKeys: string[] = [];
  const cursor = getWeekBoundsSunday(now).start;
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - i * 7);
    weekKeys.push(toAppYmd(date));
  }
  const weekIdxByKey = new Map(weekKeys.map((k, i) => [k, i]));

  // Per-label accumulators — sum seconds and sum miles per week so the
  // resulting pace is mileage-weighted (a 10-mi tempo doesn't get drowned
  // out by a 1-mi cooldown).
  type Accumulator = {
    label: string;
    typeSlug: string | null;
    weekSec: number[]; // length 12
    weekMi: number[]; // length 12
  };
  const accumulators = new Map<string, Accumulator>();

  for (const log of logs) {
    let label: string | undefined;
    let typeSlug: string | null = null;

    if (log.activityType) {
      if (log.activityType.family?.slug !== "endurance") {
        // Activity types outside the endurance family shouldn't pollute
        // the chart, even if the user somehow tagged a non-endurance
        // type to an endurance-tagged routine.
        if (!enduranceRoutineIds.includes(log.routineId)) continue;
        label = routineEnduranceLabel.get(log.routineId);
      } else {
        label = log.activityType.name;
        typeSlug = log.activityType.slug;
      }
    } else {
      label = routineEnduranceLabel.get(log.routineId);
    }
    if (!label) continue;

    const wkIdx = weekIdxByKey.get(weekKey(log.performedAt));
    if (wkIdx === undefined) continue;

    let acc = accumulators.get(label);
    if (!acc) {
      acc = {
        label,
        typeSlug,
        weekSec: new Array(12).fill(0),
        weekMi: new Array(12).fill(0),
      };
      accumulators.set(label, acc);
    }
    acc.weekSec[wkIdx] += log.durationSec ?? 0;
    acc.weekMi[wkIdx] += log.distanceMi ?? 0;
  }

  if (accumulators.size === 0) return null;

  // Convert accumulators to series with per-week pace. Skip series whose
  // total miles are zero — that means every log had distance=0 (rare,
  // but the SQL filter is gt:0 so this is double-defense).
  let fallbackIdx = 0;
  const series: WeeklyPaceSeries[] = Array.from(accumulators.values())
    .map((acc) => {
      const totalMi = acc.weekMi.reduce((a, b) => a + b, 0);
      const weeklyPaceSec = acc.weekSec.map((sec, i) =>
        acc.weekMi[i] > 0 ? sec / acc.weekMi[i] : null
      );
      return { acc, totalMi, weeklyPaceSec };
    })
    .filter((e) => e.totalMi > 0)
    // Sort by total mileage desc so the legend ordering matches the bar
    // chart — most-active type first.
    .sort((a, b) => b.totalMi - a.totalMi)
    .map((e) => {
      const fromPalette = colorForActivity(e.acc.label, e.acc.typeSlug);
      const color =
        fromPalette ?? ENDURANCE_FALLBACK_COLORS[fallbackIdx++ % ENDURANCE_FALLBACK_COLORS.length];
      return {
        label: e.acc.label,
        color,
        weeklyPaceSec: e.weeklyPaceSec,
      };
    });

  if (series.length === 0) return null;

  const weekLabels = weekKeys.map((k) => {
    // Short M/D label — cheaper than re-importing formatWeekLabel and
    // matches the bar chart's tick density.
    const [, m, d] = k.split("-");
    return `${Number(m)}/${Number(d)}`;
  });

  return { mode: "weekly", weekLabels, series };
}
