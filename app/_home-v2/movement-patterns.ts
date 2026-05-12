// Server-only aggregation for the dashboard movement-pattern card.
//
// Reuses the existing coverage model (which already handles the messy
// metadata-inference logic) and reshapes it into a weekly heatmap plus a
// 3-bucket status summary (strong / lacking / absent). 8 weekly columns
// match the domain volume chart so the user reads both at the same scale.

import { addDaysYmd, toAppYmd, todayAppYmd } from "@/lib/dates";
import { getCoverageOverviewModel } from "@/app/progress/coverage";
import { getWeekBoundsSunday } from "@/lib/week";

export type PatternStatus = "strong" | "ok" | "lacking" | "absent";

export type MovementPatternRow = {
  slug: string;
  label: string;
  totalCount: number;        // last 8 weeks
  recentCount: number;       // last 4 weeks
  weeks: number[];           // length 8, oldest → newest
  status: PatternStatus;
};

export type MovementPatternData = {
  weekStarts: string[];      // 8 YMDs, oldest → newest
  patterns: MovementPatternRow[];
  summary: { strong: number; ok: number; lacking: number; absent: number };
  // Headline phrase for the dashboard card.
  headline: string;
};

const WEEKS = 8;
const RECENT_WEEKS = 4;

export async function getMovementPatternData(): Promise<MovementPatternData> {
  // 12w is the widest pre-cached range; we'll take the most recent 8 weeks
  // out of it so this call shares the existing cache slot.
  const overview = await getCoverageOverviewModel("12w");
  const patternSection = overview.sections.find((s) => s.lens === "patterns");

  const today = todayAppYmd();
  const weekBounds = getWeekBoundsSunday(new Date());
  const sparkStart = addDaysYmd(weekBounds.startYmd, -(WEEKS - 1) * 7);
  const weekStarts: string[] = [];
  for (let i = 0; i < WEEKS; i++) weekStarts.push(addDaysYmd(sparkStart, i * 7));

  function bucketIndex(ymd: string): number {
    // Which week index (0..WEEKS-1) does this YMD fall in? Returns -1 if outside.
    for (let i = WEEKS - 1; i >= 0; i--) {
      if (ymd >= weekStarts[i]) return i;
    }
    return -1;
  }

  const patterns: MovementPatternRow[] = (patternSection?.categories ?? []).map((cat) => {
    const weeks = new Array<number>(WEEKS).fill(0);
    const allDetailLogs = Object.values(cat.contributingLogsByKind).flat();
    // De-dupe by logId — a single log can match multiple routine kinds in the
    // model (defensive — shouldn't happen, but cheap to guard).
    const seenLogIds = new Set<string>();
    for (const dl of allDetailLogs) {
      if (seenLogIds.has(dl.logId)) continue;
      seenLogIds.add(dl.logId);
      const ymd = toAppYmd(new Date(dl.performedAt));
      const idx = bucketIndex(ymd);
      if (idx >= 0) weeks[idx] += 1;
    }
    const totalCount = weeks.reduce((s, n) => s + n, 0);
    const recentCount = weeks.slice(WEEKS - RECENT_WEEKS).reduce((s, n) => s + n, 0);
    const status = classify(weeks, recentCount, totalCount);
    return {
      slug: cat.slug,
      label: cat.label,
      totalCount,
      recentCount,
      weeks,
      status,
    };
  });

  // Sort: lacking + absent first (need attention), then by recent count desc.
  const rank: Record<PatternStatus, number> = { absent: 0, lacking: 1, ok: 2, strong: 3 };
  patterns.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (b.recentCount !== a.recentCount) return b.recentCount - a.recentCount;
    return a.label.localeCompare(b.label);
  });

  const summary = {
    strong: patterns.filter((p) => p.status === "strong").length,
    ok: patterns.filter((p) => p.status === "ok").length,
    lacking: patterns.filter((p) => p.status === "lacking").length,
    absent: patterns.filter((p) => p.status === "absent").length,
  };
  const headline = buildHeadline(summary, patterns);

  // Suppress today-only date drift — `today` is only used to scope the bucket
  // edge; we don't actually need to render it.
  void today;

  return { weekStarts, patterns, summary, headline };
}

function classify(weeks: number[], recentCount: number, totalCount: number): PatternStatus {
  if (totalCount === 0) return "absent";
  // Recent 4-week activity drives the day-to-day signal.
  // "strong": 4+ sessions across recent 4 weeks AND hit at least 3 of those weeks
  // "ok": some activity but not consistent
  // "lacking": only 1-2 logs in recent weeks, or none recently
  const recentWeeksWithActivity = weeks.slice(weeks.length - 4).filter((n) => n > 0).length;
  if (recentCount >= 4 && recentWeeksWithActivity >= 3) return "strong";
  if (recentCount >= 2) return "ok";
  return "lacking";
}

function buildHeadline(
  summary: MovementPatternData["summary"],
  patterns: MovementPatternRow[]
): string {
  const lacking = patterns.filter((p) => p.status === "lacking").slice(0, 2);
  const absent = patterns.filter((p) => p.status === "absent").slice(0, 2);
  const flagged = [...absent, ...lacking];
  if (summary.strong === 0 && summary.ok === 0 && summary.lacking === 0 && summary.absent === 0) {
    return "no pattern data yet";
  }
  if (flagged.length === 0) {
    return `${summary.strong + summary.ok} on track`;
  }
  const flaggedNames = flagged.map((p) => p.label).join(", ");
  return `${summary.strong + summary.ok} good · ${summary.lacking + summary.absent} lacking (${flaggedNames})`;
}
