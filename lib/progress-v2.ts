import { formatUtcDateLabel, toAppYmd } from "@/lib/dates";
import { getWorkoutSessionMetrics, normalizeProgressRange, toPerformedAtFilter, type ProgressRange } from "@/lib/progress";
import { getWeekBoundsSunday } from "@/lib/week";

export type { ProgressRange } from "@/lib/progress";

export type ProgressSection = "overview" | "routines" | "exercises" | "cardio" | "groups";
export type ProgressTab = "overview" | "completion" | "performance" | "workload";

export type SeriesPoint = {
  label: string;
  value: number;
  detailLines?: string[];
};

export function normalizeProgressTab(value?: string | null): ProgressTab {
  if (value === "overview" || value === "completion" || value === "performance" || value === "workload") {
    return value;
  }
  return "overview";
}

export function progressSections() {
  return [
    { key: "overview", label: "Overview", href: "/progress" },
    { key: "routines", label: "Routines", href: "/progress/routines" },
    { key: "exercises", label: "Exercises", href: "/progress/exercises" },
    { key: "cardio", label: "Cardio", href: "/progress/cardio" },
    { key: "groups", label: "Groups", href: "/progress/groups" },
  ] satisfies Array<{ key: ProgressSection; label: string; href: string }>;
}

export function progressTabs(basePath: string, range: ProgressRange) {
  return [
    { key: "overview", label: "Overview", href: `${basePath}?tab=overview&range=${range}` },
    { key: "completion", label: "Completion", href: `${basePath}?tab=completion&range=${range}` },
    { key: "performance", label: "Performance", href: `${basePath}?tab=performance&range=${range}` },
    { key: "workload", label: "Workload", href: `${basePath}?tab=workload&range=${range}` },
  ] satisfies Array<{ key: ProgressTab; label: string; href: string }>;
}

export function progressTabDescription(tab: ProgressTab) {
  if (tab === "overview") return "Best single-page summary for this target.";
  if (tab === "completion") return "Adherence, frequency, and consistency.";
  if (tab === "performance") return "Improvement metrics over time.";
  return "Total work over time.";
}

export function progressRanges(basePath: string, tab: ProgressTab) {
  return [
    { key: "4w", label: "4W", href: `${basePath}?tab=${tab}&range=4w` },
    { key: "12w", label: "12W", href: `${basePath}?tab=${tab}&range=12w` },
    { key: "all", label: "All", href: `${basePath}?tab=${tab}&range=all` },
  ] satisfies Array<{ key: ProgressRange; label: string; href: string }>;
}

export function rangeChipLabel(range: ProgressRange) {
  if (range === "week") return "This Week";
  if (range === "4w") return "Last 4 Weeks";
  if (range === "8w") return "Last 8 Weeks";
  if (range === "12w") return "Last 12 Weeks";
  return "All Time";
}

export function startOfYear(now = new Date()) {
  return new Date(now.getFullYear(), 0, 1);
}

export function weekKey(date: Date) {
  return toAppYmd(getWeekBoundsSunday(date).start);
}

export function formatWeekLabel(ymd: string) {
  return formatUtcDateLabel(ymd, { month: "short", day: "numeric" });
}

export function fillWeeklySeries(
  totals: Map<string, number>,
  range: ProgressRange,
  now = new Date()
): Array<{ label: string; value: number }> {
  if (range === "all") {
    return Array.from(totals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({ label: formatWeekLabel(key), value }));
  }

  const count = range === "week" ? 1 : range === "4w" ? 4 : range === "8w" ? 8 : 12;
  const weeks: string[] = [];
  const cursor = getWeekBoundsSunday(now).start;
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - index * 7);
    weeks.push(weekKey(date));
  }

  return weeks.map((key) => ({ label: formatWeekLabel(key), value: totals.get(key) ?? 0 }));
}

export function incrementWeekMap(map: Map<string, number>, date: Date, value = 1) {
  const key = weekKey(date);
  map.set(key, (map.get(key) ?? 0) + value);
}

export function weeksWithActivity(map: Map<string, number>) {
  return Array.from(map.values()).filter((value) => value > 0).length;
}

export function countGoalMetWeeks(map: Map<string, number>, target: number) {
  if (!Number.isFinite(target) || target <= 0) return 0;
  return Array.from(map.values()).filter((value) => value >= target).length;
}

export function ytdSessions<T extends { performedAt: Date }>(items: T[], now = new Date()) {
  const start = startOfYear(now).getTime();
  return items.filter((item) => item.performedAt.getTime() >= start).length;
}

export function firstOrNull<T>(items: T[]) {
  return items.length > 0 ? items[0] : null;
}

export function lastOrNull<T>(items: T[]) {
  return items.length > 0 ? items[items.length - 1] : null;
}

export function descendantGroupIds(rootId: string, relations: Array<{ parentGroupId: string; childGroupId: string }>) {
  const result = new Set<string>([rootId]);
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const relation of relations) {
      if (relation.parentGroupId !== current || result.has(relation.childGroupId)) continue;
      result.add(relation.childGroupId);
      queue.push(relation.childGroupId);
    }
  }

  return Array.from(result);
}

export function isCardioOnlyKinds(kinds: string[]) {
  return kinds.length > 0 && kinds.every((kind) => kind === "CARDIO");
}

export function hasWorkoutKinds(kinds: string[]) {
  return kinds.some((kind) => kind === "WORKOUT");
}

export function hasSessionLikeKinds(kinds: string[]) {
  return kinds.some((kind) => kind === "GUIDED" || kind === "SESSION" || kind === "COMPLETION");
}

export function getRangeFromSearchParam(value?: string | null) {
  return normalizeProgressRange(value);
}

export function performedAtWhere(range: ProgressRange) {
  return toPerformedAtFilter(range);
}

export function aggregateExerciseSessionRow(sets: Array<{ reps: number | null; seconds: number | null; weightLb: number | null }>) {
  return getWorkoutSessionMetrics(sets);
}

export function trendLabel(values: number[]) {
  if (values.length < 2) return "Not enough history";
  const split = Math.max(1, Math.floor(values.length / 2));
  const previous = values.slice(0, split);
  const recent = values.slice(split);
  const previousAvg = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  if (previousAvg === 0 && recentAvg === 0) return "Flat";
  if (recentAvg > previousAvg * 1.05) return "Trending up";
  if (recentAvg < previousAvg * 0.95) return "Trending down";
  return "Holding steady";
}
