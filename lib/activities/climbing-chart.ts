// Climbing sessions-per-week chart. One stacked bar per week with two
// information layers:
//   - Climbing sessions, stacked by discipline (boulder / sport / top
//     rope) OR by venue (indoor / outdoor) via the stackBy option.
//   - Supporting-training sessions as a violet series on top of the
//     stack, so "climbed 3x + trained fingers 2x" reads in one bar.
// Replaces the separate Activity Coverage heatmap — the week-tap panel
// (WeeklyBarChartWithSessions) lists climbing AND training logs for the
// tapped week together, each linking to its log detail.
//
// Sessions with mixed disciplines get attributed to their dominant
// discipline (most attempts in that session). Series only render for
// buckets that actually have data in the visible window.

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
  /** Location name if known — for the chart-panel row label. */
  locationName?: string | null;
  /** Per-discipline attempt counts inside this session. The session is
   *  attributed to whichever discipline has the highest count. */
  disciplineCounts: Record<ClimbingDiscipline, number>;
  /** Session venue — drives the bars when stackBy = "venue". */
  venue?: "GYM" | "CRAG" | null;
};

export type ClimbingTrainingInput = {
  id: string;
  date: Date;
  routineId: string;
  routineName: string;
};

export type ClimbingChartWeeks = 4 | 12;
export type ClimbingStackBy = "discipline" | "venue";

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

type VenueKey = "GYM" | "CRAG" | "UNKNOWN";
const VENUE_LABEL: Record<VenueKey, string> = {
  GYM: "Indoor",
  CRAG: "Outdoor",
  UNKNOWN: "Unknown",
};
// Indoor blue / outdoor green — same pairing the old venue-split card
// used, so the colors carry an existing association.
const VENUE_COLOR: Record<VenueKey, string> = {
  GYM:     "rgba(78,148,255,0.92)",
  CRAG:    "rgba(132,204,22,0.92)",
  UNKNOWN: "rgba(148,163,184,0.6)",
};
const VENUE_ORDER: VenueKey[] = ["GYM", "CRAG", "UNKNOWN"];

const TRAINING_LABEL = "Training";
const TRAINING_COLOR = "rgba(168,85,247,0.92)"; // violet — matches old coverage row

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
  options: {
    weeks?: ClimbingChartWeeks;
    now?: Date;
    stackBy?: ClimbingStackBy;
    /** Supporting-training logs (Fingers, Pull Day, …). Rendered as one
     *  violet series stacked above the climbing buckets. */
    trainingSessions?: ClimbingTrainingInput[];
  } = {}
): ClimbingChartData {
  const now = options.now ?? new Date();
  const weeks: ClimbingChartWeeks = options.weeks ?? 12;
  const stackBy: ClimbingStackBy = options.stackBy ?? "discipline";
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  const inWindow = sessions.filter((s) => s.date >= cutoff);
  const trainingInWindow = (options.trainingSessions ?? []).filter((t) => t.date >= cutoff);

  // ── Bucket sessions by (week, group) where group = discipline or venue ──
  type Bucket = {
    key: string;
    label: string;
    color: string;
    totalSessions: number;
    sessionCountByWeek: Map<string, number>;
  };
  const buckets = new Map<string, Bucket>();
  const groupOfSession = new Map<string, { label: string; color: string }>();

  function bucketFor(key: string, label: string, color: string): Bucket {
    let b = buckets.get(key);
    if (!b) {
      b = { key, label, color, totalSessions: 0, sessionCountByWeek: new Map() };
      buckets.set(key, b);
    }
    return b;
  }

  const activeDisciplineSet = new Set<ClimbingDiscipline>();
  for (const s of inWindow) {
    const d = dominantDiscipline(s.disciplineCounts);
    activeDisciplineSet.add(d);
    const groupKey = stackBy === "discipline" ? d : ((s.venue ?? "UNKNOWN") as VenueKey);
    const label = stackBy === "discipline" ? DISCIPLINE_LABEL[d] : VENUE_LABEL[groupKey as VenueKey];
    const color = stackBy === "discipline" ? DISCIPLINE_COLOR[d] : VENUE_COLOR[groupKey as VenueKey];
    const b = bucketFor(groupKey, label, color);
    b.totalSessions += 1;
    incrementWeekMap(b.sessionCountByWeek, s.date, 1);
    groupOfSession.set(s.id, { label, color });
  }

  // Training bucket — always last in the stack, only when it has data.
  const trainingBucket = trainingInWindow.length > 0
    ? bucketFor("TRAINING", TRAINING_LABEL, TRAINING_COLOR)
    : null;
  if (trainingBucket) {
    for (const t of trainingInWindow) {
      trainingBucket.totalSessions += 1;
      incrementWeekMap(trainingBucket.sessionCountByWeek, t.date, 1);
    }
  }

  // Canonical bucket order so colors stay stable across renders.
  const orderedKeys: string[] =
    stackBy === "discipline"
      ? [...DISCIPLINE_ORDER.filter((d) => buckets.has(d)), "TRAINING"]
      : [...VENUE_ORDER.filter((v) => buckets.has(v)), "TRAINING"];
  const orderedBuckets = orderedKeys
    .map((k) => buckets.get(k))
    .filter((b): b is Bucket => !!b);

  const range = weeks === 4 ? ("4w" as const) : ("12w" as const);
  const weekLabels = fillWeeklySeries(new Map(), range, now).map((p) => p.label);

  const series: StackedBarSeries[] = orderedBuckets.map((b) => ({
    label: b.label,
    color: b.color,
    weeklyValues: fillWeeklySeries(b.sessionCountByWeek, range, now).map((p) => p.value),
  }));

  // ── Per-week panel rows — climbing + training together, date order ──────
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
    const group = groupOfSession.get(s.id)!;
    sessionsByWeek[wkIdx].push({
      id: s.id,
      performedAt: s.date,
      routineName: s.locationName ?? s.routineName,
      seriesLabel: group.label,
      seriesColor: group.color,
      metricFormatted: "",
      href: `/routines/${s.routineId}/logs/${s.id}/details`,
    });
  }
  for (const t of trainingInWindow) {
    const wkIdx = weekIndexByKey.get(weekKey(t.date));
    if (wkIdx === undefined) continue;
    sessionsByWeek[wkIdx].push({
      id: t.id,
      performedAt: t.date,
      routineName: t.routineName,
      seriesLabel: TRAINING_LABEL,
      seriesColor: TRAINING_COLOR,
      metricFormatted: "",
      href: `/routines/${t.routineId}/logs/${t.id}/details`,
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

export { DISCIPLINE_LABEL, DISCIPLINE_COLOR, DISCIPLINE_ORDER };
