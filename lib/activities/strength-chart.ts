import { fillWeeklySeries, incrementWeekMap } from "@/lib/progress-v2";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import type { StrengthSessionStat } from "@/app/progress/details/strength-world-loader";

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
};

export function buildStrengthChartData(
  sessionStats: StrengthSessionStat[],
  now = new Date()
): StrengthChartData {
  const cutoff = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  const inWindow = sessionStats.filter((s) => s.date >= cutoff);

  const sessionsByWeek = new Map<string, number>();
  const volumeByWeek = new Map<string, number>();

  for (const s of inWindow) {
    incrementWeekMap(sessionsByWeek, s.date, 1);
    incrementWeekMap(volumeByWeek, s.date, s.volume);
  }
  // No duration carried on StrengthSessionStat, so we omit `weeklyMinutes`
  // from each series. StackedWeeklyBarChart hides its time chip/column
  // when no series supplies minutes, so the chart stays clean.

  const weekLabels = fillWeeklySeries(new Map(), "12w", now).map((p) => p.label);

  const sessionsSeries: StackedBarSeries = {
    label: "Sessions",
    color: "rgba(84,203,130,0.92)", // strength green — matches domain palette
    weeklyValues: fillWeeklySeries(sessionsByWeek, "12w", now).map((p) => p.value),
  };

  const volumeSeries: StackedBarSeries = {
    label: "Volume",
    // Amber so the volume chart reads visually distinct from the
    // sessions chart at a glance — different metric, different color.
    color: "rgba(251,191,36,0.92)",
    weeklyValues: fillWeeklySeries(volumeByWeek, "12w", now).map((p) => p.value),
  };

  return { weekLabels, sessionsSeries, volumeSeries };
}
