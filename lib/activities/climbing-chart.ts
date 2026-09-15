// Climbing hub weekly charts — two builders, two questions:
//
//   buildClimbingChartData      → "what kind of climbing am I doing?"
//     One stacked bar per week. Hue = discipline (boulder orange, sport
//     lead red, top rope sky), shade = venue (indoor light, outdoor
//     deep). Only combos with data render, so a gym-boulderer sees one
//     light-orange series, not six legend entries.
//
//   buildClimbingTrainingChartData → "how am I supporting my climbing?"
//     One stacked bar per week of supporting-training sessions, one
//     series per ROUTINE (Pull A, Fingers) rather than per domain —
//     "Strength" doesn't tell you which session did the supporting.
//     Colors come from the shared routine palette, ranked by session count.
//
// Both feed WeeklyBarChartWithSessions; tapping a week opens the panel
// listing that week's logs with stripe colors matching the bar segment.
//
// Sessions with mixed disciplines get attributed to their dominant
// discipline (most attempts in that session).

import { fillWeeklySeries, incrementWeekMap, weekKey } from "@/lib/progress-v2";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import type { SessionsByWeek, WeekSession } from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { getWeekBoundsSunday } from "@/lib/week";
import { toAppYmd } from "@/lib/dates";
import { domainColor, type RoutineDomain } from "@/lib/routines";
import type { ClimbingDiscipline } from "@/lib/climb-types";
import { sessionLoad } from "@/lib/strain";
import { routineColorAt } from "./routine-palette";

export type ClimbingSessionInput = {
  id: string;
  date: Date;
  routineId: string;
  routineName: string;
  /** Location name if known — for the chart-panel row label. */
  locationName?: string | null;
  /** Per-discipline attempt counts inside this session. The session is
   *  attributed to whichever discipline has the highest count. */
  disciplineCounts: Record<ClimbingDiscipline, number>;
  venue?: "GYM" | "CRAG" | null;
  /** Perceived effort + duration → training load for the Load view. */
  effort?: number | null;
  durationSec?: number | null;
};

export type ClimbingTrainingInput = {
  id: string;
  date: Date;
  routineId: string;
  routineName: string;
  /** Effective routine domain — drives the bar color via domainColor(). */
  domain: RoutineDomain | string;
  /** Climbing-tagged exercises that made this session qualify (hybrid
   *  matching). Shown in the week panel's metric slot so the user sees
   *  WHY an untagged routine's session counted. Empty/omitted for
   *  sessions that qualified via the routine tag alone. */
  matchedExercises?: string[];
  /** Perceived effort + duration → training load for the Load view. */
  effort?: number | null;
  durationSec?: number | null;
};

export type ClimbingChartWeeks = 4 | 12;

export type ClimbingChartData = {
  weekLabels: string[];
  series: StackedBarSeries[];
  sessionsByWeek: SessionsByWeek;
  /** Disciplines that contributed at least one session in the window. */
  activeDisciplines: ClimbingDiscipline[];
};

const DISCIPLINE_LABEL: Record<ClimbingDiscipline, string> = {
  BOULDER: "Boulder",
  SPORT_LEAD: "Sport lead",
  TOP_ROPE: "Top rope",
};

// Hue family per discipline; venue picks the shade. Indoor = lighter
// tint, outdoor = deeper saturated tone, unknown venue = the mid base.
const DISCIPLINE_SHADES: Record<ClimbingDiscipline, { indoor: string; outdoor: string; base: string }> = {
  BOULDER: {
    indoor:  "rgba(253,186,116,0.92)", // light orange
    outdoor: "rgba(234,88,12,0.95)",   // deep orange
    base:    "rgba(251,146,60,0.92)",
  },
  SPORT_LEAD: {
    indoor:  "rgba(252,165,165,0.92)", // light red
    outdoor: "rgba(220,38,38,0.95)",   // deep red
    base:    "rgba(248,113,113,0.92)",
  },
  TOP_ROPE: {
    indoor:  "rgba(165,224,252,0.92)", // light sky
    outdoor: "rgba(2,132,199,0.95)",   // deep sky
    base:    "rgba(56,189,248,0.92)",
  },
};

const DISCIPLINE_ORDER: ClimbingDiscipline[] = ["BOULDER", "SPORT_LEAD", "TOP_ROPE"];
type VenueKey = "GYM" | "CRAG" | "UNKNOWN";
const VENUE_ORDER: VenueKey[] = ["GYM", "CRAG", "UNKNOWN"];

function comboLabel(d: ClimbingDiscipline, v: VenueKey): string {
  if (v === "GYM") return `Indoor ${DISCIPLINE_LABEL[d]}`;
  if (v === "CRAG") return `Outdoor ${DISCIPLINE_LABEL[d]}`;
  return DISCIPLINE_LABEL[d];
}

function comboColor(d: ClimbingDiscipline, v: VenueKey): string {
  const shades = DISCIPLINE_SHADES[d];
  if (v === "GYM") return shades.indoor;
  if (v === "CRAG") return shades.outdoor;
  return shades.base;
}

function dominantDiscipline(counts: Record<ClimbingDiscipline, number>): ClimbingDiscipline {
  let best: ClimbingDiscipline = "BOULDER";
  let bestCount = -1;
  for (const d of DISCIPLINE_ORDER) {
    if (counts[d] > bestCount) {
      best = d;
      bestCount = counts[d];
    }
  }
  return best;
}

function buildWeekIndex(weeks: ClimbingChartWeeks, now: Date) {
  const weekKeys: string[] = [];
  const cursor = getWeekBoundsSunday(now).start;
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - i * 7);
    weekKeys.push(toAppYmd(date));
  }
  return new Map(weekKeys.map((k, i) => [k, i]));
}

// ─── Chart 1: climbing sessions, hue=discipline shade=venue ─────────────────

export function buildClimbingChartData(
  sessions: ClimbingSessionInput[],
  options: { weeks?: ClimbingChartWeeks; now?: Date } = {}
): ClimbingChartData {
  const now = options.now ?? new Date();
  const weeks: ClimbingChartWeeks = options.weeks ?? 12;
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  const inWindow = sessions.filter((s) => s.date >= cutoff);

  type Bucket = {
    label: string;
    color: string;
    sessionCountByWeek: Map<string, number>;
  };
  const buckets = new Map<string, Bucket>(); // key: `${discipline}::${venue}`
  const groupOfSession = new Map<string, { label: string; color: string }>();
  const activeDisciplineSet = new Set<ClimbingDiscipline>();

  for (const s of inWindow) {
    const d = dominantDiscipline(s.disciplineCounts);
    activeDisciplineSet.add(d);
    const v: VenueKey = (s.venue ?? "UNKNOWN") as VenueKey;
    const key = `${d}::${v}`;
    let b = buckets.get(key);
    if (!b) {
      b = { label: comboLabel(d, v), color: comboColor(d, v), sessionCountByWeek: new Map() };
      buckets.set(key, b);
    }
    incrementWeekMap(b.sessionCountByWeek, s.date, 1);
    groupOfSession.set(s.id, { label: b.label, color: b.color });
  }

  // Canonical order: discipline-major, indoor before outdoor, so the
  // stack groups same-hue segments together and colors stay stable.
  const orderedKeys: string[] = [];
  for (const d of DISCIPLINE_ORDER) {
    for (const v of VENUE_ORDER) {
      const key = `${d}::${v}`;
      if (buckets.has(key)) orderedKeys.push(key);
    }
  }

  const range = weeks === 4 ? ("4w" as const) : ("12w" as const);
  const weekLabels = fillWeeklySeries(new Map(), range, now).map((p) => p.label);

  const series: StackedBarSeries[] = orderedKeys.map((key) => {
    const b = buckets.get(key)!;
    return {
      label: b.label,
      color: b.color,
      weeklyValues: fillWeeklySeries(b.sessionCountByWeek, range, now).map((p) => p.value),
    };
  });

  const weekIndexByKey = buildWeekIndex(weeks, now);
  const sessionsByWeek: WeekSession[][] = [...Array(weeks)].map(() => []);
  for (const s of inWindow) {
    const wkIdx = weekIndexByKey.get(weekKey(s.date));
    if (wkIdx === undefined) continue;
    const group = groupOfSession.get(s.id)!;
    sessionsByWeek[wkIdx].push({
      id: s.id,
      performedAt: s.date,
      routineName: s.locationName ?? s.routineName,
      seriesLabel: group.label,
      seriesColor: group.color,
      metricFormatted: "",
      load: sessionLoad(s.effort, s.durationSec),
      loadEstimated: s.effort == null,
      effort: s.effort ?? undefined,
      href: `/routines/${s.routineId}/logs/${s.id}/details`,
    });
  }
  for (const ws of sessionsByWeek) {
    ws.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }

  return {
    weekLabels,
    series,
    sessionsByWeek,
    activeDisciplines: DISCIPLINE_ORDER.filter((d) => activeDisciplineSet.has(d)),
  };
}

// ─── Chart 2: supporting training, stacked by domain ────────────────────────

export function buildClimbingTrainingChartData(
  trainingSessions: ClimbingTrainingInput[],
  options: { weeks?: ClimbingChartWeeks; now?: Date } = {}
): { weekLabels: string[]; series: StackedBarSeries[]; sessionsByWeek: SessionsByWeek } {
  const now = options.now ?? new Date();
  const weeks: ClimbingChartWeeks = options.weeks ?? 12;
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  const inWindow = trainingSessions.filter((t) => t.date >= cutoff);

  // Bucketed by ROUTINE, not domain: "Strength" doesn't tell you which session
  // supported the climbing — "Pull A" does. Routines are ranked by session
  // count so the ones actually carrying the block lead the legend.
  type Bucket = { routineId: string; routineName: string; total: number; sessionCountByWeek: Map<string, number> };
  const buckets = new Map<string, Bucket>();
  for (const t of inWindow) {
    let b = buckets.get(t.routineId);
    if (!b) {
      b = { routineId: t.routineId, routineName: t.routineName, total: 0, sessionCountByWeek: new Map() };
      buckets.set(t.routineId, b);
    }
    b.total += 1;
    incrementWeekMap(b.sessionCountByWeek, t.date, 1);
  }

  const orderedRoutines = [...buckets.values()].sort(
    (a, b) => b.total - a.total || a.routineName.localeCompare(b.routineName)
  );
  const colorByRoutineId = new Map(
    orderedRoutines.map((r, idx) => [r.routineId, routineColorAt(idx)])
  );

  const range = weeks === 4 ? ("4w" as const) : ("12w" as const);
  const weekLabels = fillWeeklySeries(new Map(), range, now).map((p) => p.label);

  const series: StackedBarSeries[] = orderedRoutines.map((r) => ({
    label: r.routineName,
    color: colorByRoutineId.get(r.routineId)!,
    weeklyValues: fillWeeklySeries(r.sessionCountByWeek, range, now).map((p) => p.value),
  }));

  const weekIndexByKey = buildWeekIndex(weeks, now);
  const sessionsByWeek: WeekSession[][] = [...Array(weeks)].map(() => []);
  for (const t of inWindow) {
    const wkIdx = weekIndexByKey.get(weekKey(t.date));
    if (wkIdx === undefined) continue;
    const matched = t.matchedExercises ?? [];
    const metricFormatted =
      matched.length === 0
        ? ""
        : matched.length <= 2
          ? matched.join(", ")
          : `${matched.slice(0, 2).join(", ")} +${matched.length - 2}`;
    sessionsByWeek[wkIdx].push({
      id: t.id,
      performedAt: t.date,
      routineName: t.routineName,
      seriesLabel: t.routineName,
      seriesColor: colorByRoutineId.get(t.routineId) ?? domainColor(String(t.domain)),
      metricFormatted,
      load: sessionLoad(t.effort, t.durationSec),
      loadEstimated: t.effort == null,
      href: `/routines/${t.routineId}/logs/${t.id}/details`,
    });
  }
  for (const ws of sessionsByWeek) {
    ws.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }

  return { weekLabels, series, sessionsByWeek };
}

export { DISCIPLINE_LABEL, DISCIPLINE_ORDER };
