// Climbing-specific sessions-per-week chart. Stacks by discipline so the
// bouldering / sport-lead / top-rope split is visible at a glance. Sessions
// with mixed disciplines get attributed to their dominant discipline (most
// attempts in that session).
//
// Series are filtered to disciplines that actually have data in the
// visible window — a bouldering-only climber sees a single-color bar,
// not three series with two flat zeros.

import { fillWeeklySeries, incrementWeekMap, weekKey } from "@/lib/progress-v2";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import type { SessionsByWeek, WeekSession } from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { getWeekBoundsSunday } from "@/lib/week";
import { toAppYmd } from "@/lib/dates";
import type { ClimbingDiscipline } from "@/lib/climb-types";

export type ClimbingSessionInput = {
  id: string;
  date: Date;
  routineId: string;
  routineName: string;
  /** Locations name if known — for the chart-panel row label. */
  locationName?: string | null;
  /** Per-discipline attempt counts inside this session. The session is
   *  attributed to whichever discipline has the highest count. */
  disciplineCounts: Record<ClimbingDiscipline, number>;
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

const DISCIPLINE_COLOR: Record<ClimbingDiscipline, string> = {
  BOULDER:    "rgba(251,146,60,0.92)", // orange — matches climbing/sport accent
  SPORT_LEAD: "rgba(248,113,113,0.92)", // red    — aggressive lead vibe
  TOP_ROPE:   "rgba(56,189,248,0.92)",  // sky    — calm, top-rope safety vibe
};

const DISCIPLINE_ORDER: ClimbingDiscipline[] = ["BOULDER", "SPORT_LEAD", "TOP_ROPE"];

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

export function buildClimbingChartData(
  sessions: ClimbingSessionInput[],
  options: { weeks?: ClimbingChartWeeks; now?: Date } = {}
): ClimbingChartData {
  const now = options.now ?? new Date();
  const weeks: ClimbingChartWeeks = options.weeks ?? 12;
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  const inWindow = sessions.filter((s) => s.date >= cutoff);

  // Bucket sessions per (week, dominant-discipline)
  const byDiscipline = new Map<ClimbingDiscipline, {
    discipline: ClimbingDiscipline;
    totalSessions: number;
    sessionCountByWeek: Map<string, number>;
  }>();
  const sessionDominant = new Map<string, ClimbingDiscipline>();
  for (const s of inWindow) {
    const d = dominantDiscipline(s.disciplineCounts);
    sessionDominant.set(s.id, d);
    let bucket = byDiscipline.get(d);
    if (!bucket) {
      bucket = { discipline: d, totalSessions: 0, sessionCountByWeek: new Map() };
      byDiscipline.set(d, bucket);
    }
    bucket.totalSessions += 1;
    incrementWeekMap(bucket.sessionCountByWeek, s.date, 1);
  }

  // Active disciplines in canonical order so colors stay stable across
  // renders (BOULDER first, SPORT_LEAD second, TOP_ROPE last).
  const activeDisciplines = DISCIPLINE_ORDER.filter((d) => byDiscipline.has(d));

  const range = weeks === 4 ? ("4w" as const) : ("12w" as const);
  const weekLabels = fillWeeklySeries(new Map(), range, now).map((p) => p.label);

  const series: StackedBarSeries[] = activeDisciplines.map((d) => {
    const bucket = byDiscipline.get(d)!;
    return {
      label: DISCIPLINE_LABEL[d],
      color: DISCIPLINE_COLOR[d],
      weeklyValues: fillWeeklySeries(bucket.sessionCountByWeek, range, now).map((p) => p.value),
    };
  });

  // Per-week panel rows. Stripe color = session's dominant discipline so
  // panel matches the bar segment that was tapped.
  const weekKeys: string[] = [];
  const cursor = getWeekBoundsSunday(now).start;
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - i * 7);
    weekKeys.push(toAppYmd(date));
  }
  const weekIndexByKey = new Map(weekKeys.map((k, i) => [k, i]));
  const sessionsByWeek: WeekSession[][] = weekKeys.map(() => []);

  for (const s of inWindow) {
    const wkIdx = weekIndexByKey.get(weekKey(s.date));
    if (wkIdx === undefined) continue;
    const d = sessionDominant.get(s.id) ?? dominantDiscipline(s.disciplineCounts);
    sessionsByWeek[wkIdx].push({
      id: s.id,
      performedAt: s.date,
      routineName: s.locationName ?? s.routineName,
      seriesLabel: DISCIPLINE_LABEL[d],
      seriesColor: DISCIPLINE_COLOR[d],
      metricFormatted: "",
      href: `/routines/${s.routineId}/logs/${s.id}/details`,
    });
  }
  for (const ws of sessionsByWeek) {
    ws.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }

  return { weekLabels, series, sessionsByWeek, activeDisciplines };
}

export { DISCIPLINE_LABEL, DISCIPLINE_COLOR, DISCIPLINE_ORDER };
