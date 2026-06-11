// Generic "sessions per week, stacked by routine" chart data builder.
// Used by /activities/mobility and /activities/lifestyle — both surfaces
// want the same shape (just session counts, no volume/distance/pace) so
// they share one builder. Strength has its own version because it also
// surfaces volume; if a future domain ever wants the same plain shape,
// route it through here.

import { fillWeeklySeries, incrementWeekMap, weekKey } from "@/lib/progress-v2";
import type { StackedBarSeries } from "@/app/progress/StackedWeeklyBarChart";
import type { SessionsByWeek, WeekSession } from "@/app/activities/_shared/WeeklyBarChartWithSessions";
import { getWeekBoundsSunday } from "@/lib/week";
import { toAppYmd } from "@/lib/dates";

export type SessionChartInput = {
  id: string;
  date: Date;
  routineId: string;
  routineName: string;
};

export type SessionChartData = {
  weekLabels: string[];
  series: StackedBarSeries[];
  sessionsByWeek: SessionsByWeek;
};

// Palette mirrors strength-chart.ts — same hue contrast story so a user
// flipping between domains sees a consistent color language.
const ROUTINE_PALETTE = [
  "rgba(192,132,252,0.92)",  // violet — mobility default
  "rgba(251,191,36,0.94)",   // amber  — lifestyle default
  "rgba(84,203,130,0.92)",   // green
  "rgba(56,189,248,0.94)",   // sky
  "rgba(248,113,113,0.92)",  // red
  "rgba(251,146,60,0.92)",   // orange
  "rgba(244,114,182,0.92)",  // pink
  "rgba(163,230,53,0.92)",   // lime
  "rgba(34,211,238,0.92)",   // teal
  "rgba(217,70,239,0.92)",   // magenta
];

export type SessionChartWeeks = 4 | 12;

export function buildSessionsChartData(
  sessions: SessionChartInput[],
  options: { accentFirst?: string; now?: Date; weeks?: SessionChartWeeks } = {}
): SessionChartData {
  const now = options.now ?? new Date();
  const weeks: SessionChartWeeks = options.weeks ?? 12;
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  const inWindow = sessions.filter((s) => s.date >= cutoff);

  const byRoutine = new Map<string, {
    routineId: string;
    routineName: string;
    totalSessions: number;
    sessionCountByWeek: Map<string, number>;
  }>();
  for (const s of inWindow) {
    let bucket = byRoutine.get(s.routineId);
    if (!bucket) {
      bucket = {
        routineId: s.routineId,
        routineName: s.routineName,
        totalSessions: 0,
        sessionCountByWeek: new Map(),
      };
      byRoutine.set(s.routineId, bucket);
    }
    bucket.totalSessions += 1;
    incrementWeekMap(bucket.sessionCountByWeek, s.date, 1);
  }

  const rankedRoutines = Array.from(byRoutine.values()).sort((a, b) => {
    if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions;
    return a.routineName.localeCompare(b.routineName);
  });

  // First slot reserved for the caller's accent (so the heaviest routine
  // matches the domain hero color). Subsequent slots cycle the palette
  // skipping the accent so the same color isn't repeated.
  const accent = options.accentFirst;
  const palette = accent
    ? [accent, ...ROUTINE_PALETTE.filter((c) => c !== accent)]
    : ROUTINE_PALETTE;
  const colorByRoutineId = new Map<string, string>();
  rankedRoutines.forEach((r, idx) => {
    colorByRoutineId.set(r.routineId, palette[idx % palette.length]);
  });

  const range = weeks === 4 ? ("4w" as const) : ("12w" as const);
  const weekLabels = fillWeeklySeries(new Map(), range, now).map((p) => p.label);

  const series: StackedBarSeries[] = rankedRoutines.map((r) => ({
    label: r.routineName,
    color: colorByRoutineId.get(r.routineId)!,
    weeklyValues: fillWeeklySeries(r.sessionCountByWeek, range, now).map((p) => p.value),
  }));

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
    sessionsByWeek[wkIdx].push({
      id: s.id,
      performedAt: s.date,
      routineName: s.routineName,
      seriesLabel: s.routineName,
      seriesColor: colorByRoutineId.get(s.routineId) ?? "rgba(255,255,255,0.4)",
      // No useful per-session metric on these surfaces (one mobility /
      // lifestyle log = one session, no volume/distance/pace). Empty
      // string suppresses the metric column in the chart panel rows.
      metricFormatted: "",
      href: `/routines/${s.routineId}/logs/${s.id}/details`,
    });
  }
  for (const ws of sessionsByWeek) {
    ws.sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime());
  }

  return { weekLabels, series, sessionsByWeek };
}
