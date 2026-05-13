// Per-injury training heatmap: takes the affected zones' metadata group
// slugs (e.g. "hamstrings"), pulls the muscle-lens slice of the existing
// coverage model, and buckets the contributing logs into weekly columns
// for the detail page heatmap. Mirrors the dashboard movement-patterns
// shape so the same heatmap visual can be reused below the chart.

import { addDaysYmd, toAppYmd } from "@/lib/dates";
import { getCoverageOverviewModel, type CoverageDetailLog } from "@/app/progress/coverage";
import { getWeekBoundsSunday } from "@/lib/week";

const WEEKS = 8;
const RECENT_WEEKS = 4;

export type InjuryHeatmapCategory = {
  slug: string;
  label: string;
  totalCount: number;
  recentCount: number;
  weeks: number[]; // length WEEKS, oldest → newest
  contributingLogs: CoverageDetailLog[]; // sorted newest → oldest
};

export type InjuryHeatmapData = {
  weekStarts: string[]; // length WEEKS, oldest → newest
  categories: InjuryHeatmapCategory[];
};

export async function getInjuryTrainingHeatmap(metadataGroupSlugs: string[]): Promise<InjuryHeatmapData> {
  if (metadataGroupSlugs.length === 0) return { weekStarts: [], categories: [] };

  // 12w is the widest pre-cached range; we take the most recent 8 weeks
  // out of it so this call shares the existing cache slot.
  const overview = await getCoverageOverviewModel("12w");
  const muscleSection = overview.sections.find((s) => s.lens === "muscles");
  const slugSet = new Set(metadataGroupSlugs);
  const targetCategories = (muscleSection?.categories ?? []).filter((c) => slugSet.has(c.slug));

  const weekBounds = getWeekBoundsSunday(new Date());
  const sparkStart = addDaysYmd(weekBounds.startYmd, -(WEEKS - 1) * 7);
  const weekStarts: string[] = [];
  for (let i = 0; i < WEEKS; i++) weekStarts.push(addDaysYmd(sparkStart, i * 7));

  function bucketIndex(ymd: string): number {
    for (let i = WEEKS - 1; i >= 0; i--) {
      if (ymd >= weekStarts[i]) return i;
    }
    return -1;
  }

  const categories: InjuryHeatmapCategory[] = targetCategories.map((cat) => {
    const weeks = new Array<number>(WEEKS).fill(0);
    const allLogs = Object.values(cat.contributingLogsByKind).flat();
    const seenLogIds = new Set<string>();
    const contributingLogs: CoverageDetailLog[] = [];
    for (const dl of allLogs) {
      if (seenLogIds.has(dl.logId)) continue;
      seenLogIds.add(dl.logId);
      contributingLogs.push(dl);
      const ymd = toAppYmd(new Date(dl.performedAt));
      const idx = bucketIndex(ymd);
      if (idx >= 0) weeks[idx] += 1;
    }
    contributingLogs.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    const totalCount = weeks.reduce((s, n) => s + n, 0);
    const recentCount = weeks.slice(WEEKS - RECENT_WEEKS).reduce((s, n) => s + n, 0);
    return {
      slug: cat.slug,
      label: cat.label,
      totalCount,
      recentCount,
      weeks,
      contributingLogs,
    };
  });

  return { weekStarts, categories };
}
