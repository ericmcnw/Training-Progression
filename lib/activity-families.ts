// Activity families — the high-level grouping used by the Activities tab.
//
// Each activity (a CARDIO_ACTIVITY or TRAINING_GROUP metadata slug) belongs to
// one family. The family determines which section of the Activities landing the
// activity card appears in, plus its default analytical framing.
//
// "Strength" and "Body Work" are derived not from a slug but from routine kind:
//   - Strength = kind=WORKOUT  (browsed inside the Strength section)
//   - Body Work = kind=GUIDED + COMPLETION recovery subtypes
//
// This file is the single source of truth — keep it aligned with
// METADATA_GROUP_SEEDS in lib/metadata.ts.

export type ActivityFamily = "endurance" | "sports" | "strength" | "body-work" | "mobility" | "lifestyle";

export type ActivityRegistryEntry = {
  /** Metadata slug (matches MetadataGroup.slug). */
  slug: string;
  /** Display label, often matches MetadataGroup.label. */
  label: string;
  /** Which family this activity belongs to. */
  family: ActivityFamily;
  /** Short eyebrow shown above the card title (e.g., "Cardio", "Board sport"). */
  eyebrow: string;
  /** Emoji glyph for compact surfaces (Plan calendar dots, FAB, headers).
   *  One per activity; sports get distinct icons, endurance shares motion
   *  icons by modality. */
  icon: string;
  /** Optional ordering hint within the family — lower numbers appear first. */
  sortHint?: number;
  /** True if this activity has a deep "world" build-out (Phase 3+). */
  hasDeepWorld?: boolean;
  /** Pinned catch-all (the freeform "Activity" entry). Resolves for
   *  icon/label via getActivityEntry, but excluded from every family
   *  iteration — it's not a browsable/selectable sport, it has its own
   *  always-present entry points. */
  pinnedCatchAll?: boolean;
  /** Excluded from family browse listings (Activities landing, add-sport
   *  picker, chart slug-sets) while still resolving for icon/label/eyebrow.
   *  Backpacking uses this: it's an endurance pursuit with a dedicated
   *  multi-day logger + its own entry point, not a browseable activity card. */
  hiddenFromBrowse?: boolean;
};

// Endurance — pace/distance-shaped activities.
const ENDURANCE_ACTIVITIES: ActivityRegistryEntry[] = [
  { slug: "running", label: "Running", family: "endurance", eyebrow: "Endurance", icon: "🏃", sortHint: 10 },
  { slug: "trail-running", label: "Trail Running", family: "endurance", eyebrow: "Endurance · Outdoor", icon: "🏃", sortHint: 11 },
  { slug: "road-running", label: "Road Running", family: "endurance", eyebrow: "Endurance", icon: "🏃", sortHint: 12 },
  { slug: "walking", label: "Walking", family: "endurance", eyebrow: "Endurance", icon: "🚶", sortHint: 20 },
  { slug: "biking", label: "Biking", family: "endurance", eyebrow: "Endurance", icon: "🚴", sortHint: 30 },
  { slug: "road-cycling", label: "Road Cycling", family: "endurance", eyebrow: "Endurance", icon: "🚴", sortHint: 31 },
  { slug: "mountain-biking", label: "Mountain Biking", family: "endurance", eyebrow: "Endurance · Outdoor", icon: "🚵", sortHint: 32 },
  { slug: "gravel-cycling", label: "Gravel Cycling", family: "endurance", eyebrow: "Endurance · Outdoor", icon: "🚴", sortHint: 33 },
  { slug: "swimming", label: "Swimming", family: "endurance", eyebrow: "Endurance", icon: "🏊", sortHint: 40 },
  { slug: "pool-swimming", label: "Pool Swimming", family: "endurance", eyebrow: "Endurance", icon: "🏊", sortHint: 41 },
  { slug: "open-water-swimming", label: "Open Water Swimming", family: "endurance", eyebrow: "Endurance · Outdoor", icon: "🏊", sortHint: 42 },
  { slug: "rowing", label: "Rowing", family: "endurance", eyebrow: "Endurance", icon: "🚣", sortHint: 50 },
  { slug: "hiking", label: "Hiking", family: "endurance", eyebrow: "Endurance · Outdoor", icon: "🥾", sortHint: 60 },
  // Backpacking is an endurance pursuit (under the hiking umbrella) but has a
  // dedicated multi-day trip logger + its own entry point, so it's hidden from
  // the browseable activity listings. Its synthetic routine is domain=cardio.
  { slug: "backpacking", label: "Backpacking", family: "endurance", eyebrow: "Endurance · Outdoor", icon: "🎒", sortHint: 61, hiddenFromBrowse: true },
];

// Sports — skill / session-shaped activities.
const SPORT_ACTIVITIES: ActivityRegistryEntry[] = [
  { slug: "climbing", label: "Climbing", family: "sports", eyebrow: "Sport", icon: "🧗", sortHint: 5, hasDeepWorld: true },
  { slug: "surfing", label: "Surfing", family: "sports", eyebrow: "Board sport", icon: "🏄", sortHint: 10 },
  { slug: "bodysurfing", label: "Bodysurfing", family: "sports", eyebrow: "Water sport", icon: "🤙", sortHint: 10.5 },
  { slug: "snowboarding", label: "Snowboarding", family: "sports", eyebrow: "Board sport", icon: "🏂", sortHint: 11 },
  { slug: "skiing", label: "Skiing", family: "sports", eyebrow: "Board sport", icon: "🎿", sortHint: 12 },
  { slug: "skateboarding", label: "Skateboarding", family: "sports", eyebrow: "Board sport", icon: "🛹", sortHint: 13 },
  { slug: "basketball", label: "Basketball", family: "sports", eyebrow: "Team sport", icon: "🏀", sortHint: 30 },
  { slug: "spikeball", label: "Spikeball", family: "sports", eyebrow: "Yard sport", icon: "🏐", sortHint: 32 },
  { slug: "tennis", label: "Tennis", family: "sports", eyebrow: "Racquet sport", icon: "🎾", sortHint: 40 },
  { slug: "golf", label: "Golf", family: "sports", eyebrow: "Sport · Outdoor", icon: "⛳", sortHint: 50 },
];

// Freeform catch-all — the "Activity" entry. Family is "sports" so it
// shares the synthetic-routine + body-map plumbing, but pinnedCatchAll
// keeps it out of the sports lists; it surfaces via its own pinned tile +
// FAB item instead. Registered here only so activityIcon()/getActivityEntry
// resolve its glyph on the calendar, FAB, and headers.
const CATCH_ALL_ACTIVITIES: ActivityRegistryEntry[] = [
  { slug: "activity", label: "Activity", family: "sports", eyebrow: "Anything you did", icon: "🤸", sortHint: 0, pinnedCatchAll: true },
];

export const ACTIVITY_REGISTRY: ActivityRegistryEntry[] = [
  ...ENDURANCE_ACTIVITIES,
  ...SPORT_ACTIVITIES,
  ...CATCH_ALL_ACTIVITIES,
];

const ENTRY_BY_SLUG = new Map(ACTIVITY_REGISTRY.map((entry) => [entry.slug, entry]));

export function getActivityEntry(slug: string): ActivityRegistryEntry | null {
  return ENTRY_BY_SLUG.get(slug) ?? null;
}

/** Emoji glyph for an activity slug, or null if unknown. Used by compact
 *  surfaces (Plan calendar, FAB, headers) that want an icon, not text. */
export function activityIcon(slug: string): string | null {
  return ENTRY_BY_SLUG.get(slug)?.icon ?? null;
}

export function isEnduranceActivity(slug: string) {
  return ENTRY_BY_SLUG.get(slug)?.family === "endurance";
}

export function isSportActivity(slug: string) {
  return ENTRY_BY_SLUG.get(slug)?.family === "sports";
}

export function activitiesByFamily(family: ActivityFamily): ActivityRegistryEntry[] {
  return ACTIVITY_REGISTRY.filter((entry) => entry.family === family && !entry.pinnedCatchAll && !entry.hiddenFromBrowse).sort(
    (a, b) => (a.sortHint ?? 999) - (b.sortHint ?? 999) || a.label.localeCompare(b.label)
  );
}

// Family-level metadata for the Activities landing UI.
export const ACTIVITY_FAMILY_META: Record<ActivityFamily, { label: string; eyebrow: string; description: string; accent: string }> = {
  endurance: {
    label: "Endurance",
    eyebrow: "Endurance",
    description: "Pace and distance — running, biking, swimming, hiking.",
    accent: "rgba(78,148,255,0.9)",
  },
  sports: {
    label: "Sports",
    eyebrow: "Sports",
    description: "Skill-based sessions — climbing, surfing, snowboarding, ball sports.",
    accent: "rgba(251,146,60,0.9)",
  },
  strength: {
    label: "Strength",
    eyebrow: "Strength",
    description: "Lifting and resistance training — sets, reps, volume.",
    accent: "rgba(84,203,130,0.9)",
  },
  "body-work": {
    label: "Body Work",
    eyebrow: "Body Work",
    description: "Mobility and recovery — stretching, breathwork, active recovery.",
    accent: "rgba(192,132,252,0.9)",
  },
  mobility: {
    label: "Mobility",
    eyebrow: "Mobility",
    description: "Stretching, yoga, warmups, breathwork, rehab.",
    accent: "rgba(192,132,252,0.9)",
  },
  lifestyle: {
    label: "Lifestyle",
    eyebrow: "Lifestyle",
    description: "Daily habits, recovery, supplements, journaling — anything outside training.",
    accent: "rgba(251,191,36,0.9)",
  },
};

// /activities index iterates this list. body-work is intentionally OUT — its
// scope (injuries + body-zone status) is distinct from the new mobility +
// lifestyle world pages. /activities/body-work still works as a direct URL
// and keeps its meta entry above for that page's own use.
export const ACTIVITY_FAMILY_ORDER: ActivityFamily[] = [
  "endurance",
  "sports",
  "strength",
  "mobility",
  "lifestyle",
];
