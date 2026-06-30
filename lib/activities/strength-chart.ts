import { fillWeeklySeries, incrementWeekMap, weekKey } from "@/lib/progress-v2";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import type { StrengthSessionStat } from "@/app/progress/details/strength-world-loader";
import type { SessionsByWeek, WeekSession } from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { getWeekBoundsSunday } from "@/lib/week";
import { toAppYmd } from "@/lib/dates";

// 12-week strength dashboard charts. Both the sessions-per-week and
// volume-per-week charts split by ROUTINE (one stacked segment per
// routine each week) so the user can see at a glance which routine is
// driving their volume that week.

export type StrengthChartData = {
  weekLabels: string[];
  /** Sessions per week, stacked one segment per routine. */
  sessionsSeries: StackedBarSeries[];
  /** Volume (lb) per week, stacked one segment per routine. */
  volumeSeries: StackedBarSeries[];
  /** Per-week session lists. Stripe color matches each session's
   *  routine series color. */
  sessionsByWeek: SessionsByWeek;
};

// Palette assigned in order of routine total-volume (heaviest first
// gets the first color). Ordered for maximum hue contrast — each
// adjacent pair is far apart on the color wheel — and de-duplicated
// so there aren't two near-greens or two near-blues anywhere in the
// list. Previously had green+emerald, sky+light-blue, amber+yellow,
// which read as the same color from across the room.
const ROUTINE_PALETTE = [
  "rgba(84,203,130,0.92)",   // green
  "rgba(251,191,36,0.94)",   // amber
  "rgba(167,139,250,0.94)",  // violet
  "rgba(248,113,113,0.92)",  // red
  "rgba(56,189,248,0.94)",   // sky
  "rgba(251,146,60,0.92)",   // orange
  "rgba(244,114,182,0.92)",  // pink
  "rgba(163,230,53,0.92)",   // lime
  "rgba(34,211,238,0.92)",   // teal
  "rgba(217,70,239,0.92)",   // magenta
];

export function buildStrengthChartData(
  sessionStats: StrengthSessionStat[],
  now = new Date()
): StrengthChartData {
  const cutoff = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const inWindow = sessionStats.filter((s) => s.date >= cutoff);

  // Group by routine. Keep totals so we can rank routines for color
  // assignment and series ordering.
  const byRoutine = new Map<
    string,
    {
      routineId: string;
      routineName: string;
      totalVolume: number;
      totalSessions: number;
      sessionCountByWeek: Map<string, number>;
      volumeByWeek: Map<string, number>;
    }
  >();
  for (const s of inWindow) {
    let bucket = byRoutine.get(s.routineId);
    if (!bucket) {
      bucket = {
        routineId: s.routineId,
        routineName: s.routineName,
        totalVolume: 0,
        totalSessions: 0,
        sessionCountByWeek: new Map(),
        volumeByWeek: new Map(),
      };
      byRoutine.set(s.routineId, bucket);
    }
    bucket.totalVolume += s.volume;
    bucket.totalSessions += 1;
    incrementWeekMap(bucket.sessionCountByWeek, s.date, 1);
    incrementWeekMap(bucket.volumeByWeek, s.date, s.volume);
  }

  // Rank by total volume (desc), tiebreak by session count then name
  // so the heaviest-trained routine takes the first palette slot.
  const rankedRoutines = Array.from(byRoutine.values()).sort((a, b) => {
    if (b.totalVolume !== a.totalVolume) return b.totalVolume - a.totalVolume;
    if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions;
    return a.routineName.localeCompare(b.routineName);
  });

  const colorByRoutineId = new Map<string, string>();
  rankedRoutines.forEach((r, idx) => {
    colorByRoutineId.set(r.routineId, ROUTINE_PALETTE[idx % ROUTINE_PALETTE.length]);
  });

  const weekLabels = fillWeeklySeries(new Map(), "12w", now).map((p) => p.label);

  const sessionsSeries: StackedBarSeries[] = rankedRoutines.map((r) => ({
    label: r.routineName,
    color: colorByRoutineId.get(r.routineId)!,
    weeklyValues: fillWeeklySeries(r.sessionCountByWeek, "12w", now).map((p) => p.value),
  }));

  const volumeSeries: StackedBarSeries[] = rankedRoutines.map((r) => ({
    label: r.routineName,
    color: colorByRoutineId.get(r.routineId)!,
    weeklyValues: fillWeeklySeries(r.volumeByWeek, "12w", now).map((p) => p.value),
  }));

  // Build per-week session lists for the panel underneath either chart.
  const weekKeys: string[] = [];
  const cursor = getWeekBoundsSunday(now).start;
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - i * 7);
    weekKeys.push(toAppYmd(date));
  }
  const weekIndexByKey = new Map(weekKeys.map((k, i) => [k, i]));
  const sessionsByWeek: WeekSession[][] = weekKeys.map(() => []);

  for (const s of inWindow) {
    const wkIdx = weekIndexByKey.get(weekKey(s.date));
    if (wkIdx === undefined) continue;
    const topSetSuffix = s.topSet && s.topSet.weight > 0
      ? ` · top: ${s.topSet.weight}×${s.topSet.reps} ${s.topSet.exerciseName}`
      : "";
    sessionsByWeek[wkIdx].push({
      id: s.id,
      performedAt: s.date,
      routineName: s.routineName,
      seriesLabel: s.routineName,
      // Stripe color matches the routine's chart segment color so the
      // panel and the bar read as one visual.
      seriesColor: colorByRoutineId.get(s.routineId) ?? "rgba(255,255,255,0.4)",
      metricFormatted: `${s.sets} set${s.sets === 1 ? "" : "s"} · ${formatVolume(s.volume)}${topSetSuffix}`,
      // Sets power the Sessions⇄Sets toggle (load is intentionally dropped on
      // strength — sets/volume are the native "how much"). Only the Sessions
      // chart passes secondaryLabel="Sets", so the Volume chart shows no toggle.
      secondaryValue: s.sets,
      href: `/routines/${s.routineId}/logs/${s.id}/details`,
    });
  }
  for (const ws of sessionsByWeek) {
    ws.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }

  return { weekLabels, sessionsSeries, volumeSeries, sessionsByWeek };
}

function formatVolume(lb: number): string {
  if (lb <= 0) return "—";
  if (lb >= 10000) return `${(lb / 1000).toFixed(0)}k lb`;
  if (lb >= 1000) return `${(lb / 1000).toFixed(1)}k lb`;
  return `${lb.toLocaleString()} lb`;
}
