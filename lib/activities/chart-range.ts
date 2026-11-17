import { prisma } from "@/lib/prisma";

export const CHART_RANGE_KEYS = ["4w", "12w", "26w", "52w", "all"] as const;
export type ChartRangeKey = (typeof CHART_RANGE_KEYS)[number];

export const CHART_RANGE_LABEL: Record<ChartRangeKey, string> = {
  "4w": "4w",
  "12w": "12w",
  "26w": "6mo",
  "52w": "1y",
  all: "All",
};

const TITLE: Record<ChartRangeKey, string> = {
  "4w": "Last 4 Weeks",
  "12w": "Last 12 Weeks",
  "26w": "Last 6 Months",
  "52w": "Last Year",
  all: "All Time",
};

const FIXED_WEEKS: Record<Exclude<ChartRangeKey, "all">, number> = { "4w": 4, "12w": 12, "26w": 26, "52w": 52 };
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function parseChartRange(value: string | undefined): ChartRangeKey {
  return (CHART_RANGE_KEYS as readonly string[]).includes(value ?? "") ? (value as ChartRangeKey) : "12w";
}

// "All" spans back to the account's first log of any kind, so every page's
// all-time chart shares one time axis.
export async function resolveChartRange(value: string | undefined, now = new Date()) {
  const range = parseChartRange(value);
  if (range !== "all") return { range, weeks: FIXED_WEEKS[range], title: TITLE[range] };
  const first = await prisma.routineLog.findFirst({ orderBy: { performedAt: "asc" }, select: { performedAt: true } });
  const weeks = first ? Math.max(12, Math.ceil((now.getTime() - first.performedAt.getTime()) / WEEK_MS) + 1) : 12;
  return { range, weeks, title: TITLE.all };
}
