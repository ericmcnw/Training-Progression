import { fillWeeklySeries, incrementWeekMap, weekKey } from "@/lib/progress-v2";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import type { StrengthSessionStat } from "@/app/progress/details/strength-world-loader";
import type { SessionsByWeek, WeekSession } from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { getWeekBoundsSunday } from "@/lib/week";
import { toAppYmd } from "@/lib/dates";

// Two weekly series the strength dashboard wants:
//   - Sessions per week (count) over the last 12 weeks
//   - Total volume per week (lb) over the last 12 weeks
//
// Both are single-series stacked charts (the StackedWeeklyBarChart
// component still renders cleanly with one series). Built from the
// session stats already loaded by `loadStrengthWorld` — no extra
// Prisma roundtrip.

export type StrengthChartData = {
  weekLabels: string[];
  sessionsSeries: StackedBarSeries;
  volumeSeries: StackedBarSeries;
  /** Per-week session lists, aligned with `weekLabels` indices. The
   *  sessions metric is formatted as "N sets · X.Yk lb" so it works
   *  under both the sessions chart and the volume chart panel. */
  sessionsByWeek: SessionsByWeek;
};

export function buildStrengthChartData(
  sessionStats: StrengthSessionStat[],
  now = new Date()
): StrengthChartData {
  const cutoff = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const inWindow = sessionStats.filter((s) => s.date >= cutoff);

  const sessionCountByWeek = new Map<string, number>();
  const volumeByWeek = new Map<string, number>();

  for (const s of inWindow) {
    incrementWeekMap(sessionCountByWeek, s.date, 1);
    incrementWeekMap(volumeByWeek, s.date, s.volume);
  }
  // No duration carried on StrengthSessionStat, so we omit `weeklyMinutes`
  // from each series. StackedWeeklyBarChart hides its time chip/column
  // when no series supplies minutes, so the chart stays clean.

  const weekLabels = fillWeeklySeries(new Map(), "12w", now).map((p) => p.label);

  const sessionsSeries: StackedBarSeries = {
    label: "Sessions",
    color: "rgba(84,203,130,0.92)", // strength green — matches domain palette
    weeklyValues: fillWeeklySeries(sessionCountByWeek, "12w", now).map((p) => p.value),
  };

  const volumeSeries: StackedBarSeries = {
    label: "Volume",
    // Amber so the volume chart reads visually distinct from the
    // sessions chart at a glance — different metric, different color.
    color: "rgba(251,191,36,0.92)",
    weeklyValues: fillWeeklySeries(volumeByWeek, "12w", now).map((p) => p.value),
  };

  // Ordered week-key list so each session can be bucketed into its
  // correct week index for the panel underneath either chart.
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
    // Append top-set detail when present so the user sees the actual
    // heaviest lift from the session, not just aggregate set count +
    // volume. e.g. "12 sets · 1.5k lb · top: 210×3 Bench".
    const topSetSuffix = s.topSet && s.topSet.weight > 0
      ? ` · top: ${s.topSet.weight}×${s.topSet.reps} ${s.topSet.exerciseName}`
      : "";
    sessionsByWeek[wkIdx].push({
      id: s.id,
      performedAt: s.date,
      routineName: s.routineName,
      // Both strength charts share one panel, so we use a neutral
      // label and color rather than picking sessions-green vs
      // volume-amber. The panel's left stripe will reflect this.
      seriesLabel: "Strength",
      seriesColor: "rgba(84,203,130,0.92)",
      metricFormatted: `${s.sets} set${s.sets === 1 ? "" : "s"} · ${formatVolume(s.volume)}${topSetSuffix}`,
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
