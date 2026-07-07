// Per-injury training heatmap: takes the affected zones' metadata group
// slugs (e.g. "hamstrings"), pulls the muscle-lens AND sport-lens slices
// of the existing coverage model, and buckets the contributing logs into
// weekly columns split by routine domain.
//
// The sport-lens contribution is the key piece — without it, a running
// or hiking log wouldn't show up under "Hamstrings" because cardio
// routines don't carry muscle metadata. SPORT_MUSCLE_MAP credits each
// sport activity to the muscle groups it loads.

import { addDaysYmd, toAppYmd } from "@/lib/dates";
import {
  getCoverageOverviewModel,
  type CoverageDetailLog,
} from "@/app/progress/coverage";
import { getWeekBoundsSunday } from "@/lib/week";

// Full width of the pre-cached coverage range. The injury page crops this to
// the injury's own window (since start, capped here) so the load bars share a
// date axis with the pain trend.
const WEEKS = 12;
const RECENT_WEEKS = 4;

// Habit-domain logs aren't training load (they're checkbox completions like
// "took supplements"), so they're excluded from the heatmap entirely.
export type HeatmapDomain = "strength" | "cardio" | "mobility" | "sport";

// Reverse lookup: for each muscle group slug, which sport-activity slugs
// load it heavily enough to count. Conservative — only include sports
// where a typical session moves that muscle through real range / load.
// Walking is intentionally excluded everywhere — it's recovery-tier movement
// and shouldn't show up as "training load" on an injury page.
const MUSCLE_TO_SPORT_SLUGS: Record<string, string[]> = {
  hamstrings:    ["running", "hiking", "biking", "rowing", "climbing"],
  quads:         ["running", "hiking", "biking", "climbing", "board-sports"],
  glutes:        ["running", "hiking", "biking", "climbing"],
  calves:        ["running", "hiking", "biking", "climbing", "board-sports"],
  "hip-flexors": ["running", "hiking", "climbing"],
  adductors:     ["climbing", "board-sports"],
  abductors:     ["running", "hiking", "climbing", "board-sports"],
  tibialis:      ["running", "hiking"],
  core:          ["running", "swimming", "rowing", "climbing", "board-sports"],
  abs:           ["running", "swimming", "rowing", "climbing", "board-sports"],
  obliques:      ["climbing", "rowing", "board-sports"],
  lats:          ["swimming", "rowing", "climbing"],
  "upper-back":  ["swimming", "rowing", "climbing"],
  "lower-back":  ["rowing", "climbing"],
  shoulders:     ["swimming", "rowing", "climbing"],
  biceps:        ["climbing", "rowing"],
  triceps:       ["swimming", "climbing"],
  forearms:      ["climbing"],
  fingers:       ["climbing"],
  chest:         ["swimming"],
  "glute-medius":["running", "hiking", "climbing"],
};

const DOMAIN_LABEL: Record<HeatmapDomain, string> = {
  strength: "Strength",
  cardio:   "Cardio",
  sport:    "Sport",
  mobility: "Mobility",
};

const DOMAIN_ORDER: HeatmapDomain[] = ["cardio", "sport", "strength", "mobility"];

function isHeatmapDomain(domain: string): domain is HeatmapDomain {
  return domain === "strength" || domain === "cardio" || domain === "sport" || domain === "mobility";
}

export type InjuryHeatmapDomainRow = {
  domain: HeatmapDomain;
  domainLabel: string;
  totalCount: number;
  recentCount: number;
  weeks: number[]; // length WEEKS, oldest → newest — session counts
  loadWeeks: number[]; // length WEEKS — summed training load
  milesWeeks: number[]; // length WEEKS — summed distance (mi); non-cardio rows stay 0
  contributingLogs: CoverageDetailLog[]; // sorted newest → oldest
};

export type InjuryHeatmapCategory = {
  slug: string;
  label: string;
  totalCount: number;
  recentCount: number;
  weeks: number[]; // combined session counts across all domains, length WEEKS
  loadWeeks: number[]; // combined training load across all domains, length WEEKS
  milesWeeks: number[]; // combined weekly miles — the native cardio metric vs pain
  domains: InjuryHeatmapDomainRow[]; // only domains with at least one log
};

export type InjuryHeatmapData = {
  weekStarts: string[]; // length WEEKS
  categories: InjuryHeatmapCategory[];
};

export async function getInjuryTrainingHeatmap(metadataGroupSlugs: string[]): Promise<InjuryHeatmapData> {
  if (metadataGroupSlugs.length === 0) return { weekStarts: [], categories: [] };

  // 12w is the widest pre-cached range — use it whole and share the cache slot.
  const overview = await getCoverageOverviewModel("12w");
  const muscleSection = overview.sections.find((s) => s.lens === "muscles");
  const sportsSection = overview.sections.find((s) => s.lens === "sports");

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

  const categories: InjuryHeatmapCategory[] = metadataGroupSlugs.map((muscleSlug) => {
    // Collect every contributing log for this muscle group from two sources:
    //   1. Direct muscle-lens credit (strength workouts tagged with this muscle,
    //      session templates that include the muscle in metadata, etc.).
    //   2. Sport-lens credit via MUSCLE_TO_SPORT_SLUGS — a running session that
    //      doesn't carry muscle metadata still gets credited to the hamstrings.
    const seenLogIds = new Set<string>();
    const pooled: CoverageDetailLog[] = [];

    const directCat = muscleSection?.categories.find((c) => c.slug === muscleSlug);
    if (directCat) {
      const allLogs = Object.values(directCat.contributingLogsByKind).flat();
      for (const dl of allLogs) {
        if (seenLogIds.has(dl.logId)) continue;
        seenLogIds.add(dl.logId);
        pooled.push(dl);
      }
    }

    const sportSlugs = MUSCLE_TO_SPORT_SLUGS[muscleSlug] ?? [];
    if (sportSlugs.length > 0 && sportsSection) {
      for (const sportSlug of sportSlugs) {
        const sportCat = sportsSection.categories.find((c) => c.slug === sportSlug);
        if (!sportCat) continue;
        const allLogs = Object.values(sportCat.contributingLogsByKind).flat();
        for (const dl of allLogs) {
          if (seenLogIds.has(dl.logId)) continue;
          seenLogIds.add(dl.logId);
          pooled.push(dl);
        }
      }
    }

    // Bucket by domain (honoring the routine's explicit domain override —
    // a PT routine marked "mobility" stays mobility), then by week. Habit-
    // domain logs are dropped here since they're not training load.
    const byDomain = new Map<
      HeatmapDomain,
      { logs: CoverageDetailLog[]; weeks: number[]; loadWeeks: number[]; milesWeeks: number[] }
    >();
    for (const dl of pooled) {
      if (!isHeatmapDomain(dl.routineDomain)) continue;
      const domain = dl.routineDomain;
      const entry =
        byDomain.get(domain) ??
        {
          logs: [],
          weeks: new Array<number>(WEEKS).fill(0),
          loadWeeks: new Array<number>(WEEKS).fill(0),
          milesWeeks: new Array<number>(WEEKS).fill(0),
        };
      entry.logs.push(dl);
      const ymd = toAppYmd(new Date(dl.performedAt));
      const idx = bucketIndex(ymd);
      if (idx >= 0) {
        entry.weeks[idx] += 1;
        entry.loadWeeks[idx] += dl.load;
        entry.milesWeeks[idx] += dl.distanceMi ?? 0;
      }
      byDomain.set(domain, entry);
    }

    const domains: InjuryHeatmapDomainRow[] = DOMAIN_ORDER
      .map((domain) => {
        const entry = byDomain.get(domain);
        if (!entry) return null;
        const totalCount = entry.weeks.reduce((s, n) => s + n, 0);
        const recentCount = entry.weeks.slice(WEEKS - RECENT_WEEKS).reduce((s, n) => s + n, 0);
        entry.logs.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
        return {
          domain,
          domainLabel: DOMAIN_LABEL[domain],
          totalCount,
          recentCount,
          weeks: entry.weeks,
          loadWeeks: entry.loadWeeks.map((n) => Math.round(n)),
          milesWeeks: entry.milesWeeks.map((n) => Math.round(n * 10) / 10),
          contributingLogs: entry.logs,
        };
      })
      .filter((row): row is InjuryHeatmapDomainRow => row !== null);

    // Combined weekly totals for the category header strip.
    const combinedWeeks = new Array<number>(WEEKS).fill(0);
    const combinedLoadWeeks = new Array<number>(WEEKS).fill(0);
    const combinedMilesWeeks = new Array<number>(WEEKS).fill(0);
    for (const row of domains) {
      for (let i = 0; i < WEEKS; i++) {
        combinedWeeks[i] += row.weeks[i];
        combinedLoadWeeks[i] += row.loadWeeks[i];
        combinedMilesWeeks[i] += row.milesWeeks[i];
      }
    }
    const totalCount = combinedWeeks.reduce((s, n) => s + n, 0);
    const recentCount = combinedWeeks.slice(WEEKS - RECENT_WEEKS).reduce((s, n) => s + n, 0);

    // Use the direct muscle-lens label when available, otherwise capitalize
    // the slug as a fallback (handles any slug missing from the muscle lens).
    const label = directCat?.label ?? muscleSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      slug: muscleSlug,
      label,
      totalCount,
      recentCount,
      weeks: combinedWeeks,
      loadWeeks: combinedLoadWeeks.map((n) => Math.round(n)),
      milesWeeks: combinedMilesWeeks.map((n) => Math.round(n * 10) / 10),
      domains,
    };
  });

  return { weekStarts, categories };
}
