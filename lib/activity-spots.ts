// Per-activity configuration for the spots-map feature (Phase 2 of the
// global maps build). Climbing has its own dedicated route + bespoke
// component; this file defines how the generic /activities/[slug]/map
// page presents itself for every other activity.
//
// Design notes:
// - `supportsMap` defaults to true. We don't gate any activity from getting
//   a map page — even pool swimming benefits if the user wants to mark
//   which pool they trained at.
// - `spotTypes` is optional. If empty, the map UI hides the type toggle
//   and stores spots as untyped (type=null). Activities like surfing don't
//   need a category (a coord IS the spot).
// - Pin colors default to the activity-family accent. Activities can
//   override per-type to encode meaning visually (indoor vs outdoor).

import { ACTIVITY_FAMILY_META, getActivityEntry } from "./activity-families";

export type SpotTypeOption = {
  value: string;
  label: string;
  emoji?: string;
  pinColor: string;
};

export type ActivitySpotConfig = {
  /** Whether this activity exposes a map page in its TargetHeader. */
  supportsMap: boolean;
  /** Per-activity sub-categories. Empty = no type field shown in UI. */
  spotTypes: SpotTypeOption[];
  /** Default pin color for spots without a specific type. */
  defaultPinColor: string;
  /** Singular label for a spot in this activity (e.g. "court", "trail"). */
  spotNoun: string;
};

const INDOOR_OUTDOOR_TYPES: SpotTypeOption[] = [
  { value: "indoor", label: "Indoor", emoji: "🏠", pinColor: "rgba(120,190,255,0.95)" },
  { value: "outdoor", label: "Outdoor", emoji: "🌳", pinColor: "rgba(74,222,128,0.95)" },
];

const HIKING_TYPES: SpotTypeOption[] = [
  { value: "trailhead", label: "Trailhead", emoji: "🥾", pinColor: "rgba(74,222,128,0.95)" },
  { value: "peak", label: "Peak", emoji: "⛰", pinColor: "rgba(251,191,36,0.95)" },
  { value: "park", label: "Park", emoji: "🌲", pinColor: "rgba(132,204,255,0.95)" },
];

const SURF_TYPES: SpotTypeOption[] = [
  { value: "beach", label: "Beach break", emoji: "🏖", pinColor: "rgba(132,204,255,0.95)" },
  { value: "reef", label: "Reef break", emoji: "🪸", pinColor: "rgba(251,146,60,0.95)" },
  { value: "point", label: "Point break", emoji: "🏝", pinColor: "rgba(74,222,128,0.95)" },
];

const SNOW_TYPES: SpotTypeOption[] = [
  { value: "resort", label: "Resort", emoji: "🎿", pinColor: "rgba(132,204,255,0.95)" },
  { value: "backcountry", label: "Backcountry", emoji: "⛰", pinColor: "rgba(192,132,252,0.95)" },
];

const PER_SLUG_OVERRIDES: Record<string, Partial<ActivitySpotConfig>> = {
  // Ball + court sports — useful to distinguish gym vs park.
  basketball: { spotTypes: INDOOR_OUTDOOR_TYPES, spotNoun: "court" },
  tennis:     { spotTypes: INDOOR_OUTDOOR_TYPES, spotNoun: "court" },
  // Outdoor sports with meaningful sub-categories.
  hiking:     { spotTypes: HIKING_TYPES, spotNoun: "trail" },
  surfing:    { spotTypes: SURF_TYPES, spotNoun: "spot" },
  snowboarding: { spotTypes: SNOW_TYPES, spotNoun: "mountain" },
  skiing:     { spotTypes: SNOW_TYPES, spotNoun: "mountain" },
  // Single-type activities — keep the noun specific but skip the type buttons.
  golf:       { spotNoun: "course" },
  skateboarding: { spotNoun: "park" },
  "trail-running":     { spotNoun: "trail" },
  "mountain-biking":   { spotNoun: "trail" },
  "gravel-cycling":    { spotNoun: "route" },
  "open-water-swimming": { spotNoun: "spot" },
};

export function getActivitySpotConfig(slug: string): ActivitySpotConfig | null {
  const entry = getActivityEntry(slug);
  if (!entry) return null;
  // Climbing is intentionally excluded — it has the dedicated /activities/
  // climbing/map route with its own ClimbLocation-backed component.
  if (slug === "climbing") return null;

  const familyAccent = ACTIVITY_FAMILY_META[entry.family].accent;
  const overrides = PER_SLUG_OVERRIDES[slug] ?? {};
  return {
    supportsMap: true,
    spotTypes: [],
    defaultPinColor: familyAccent.replace(/0\.9\)$/, "0.95)"),
    spotNoun: "spot",
    ...overrides,
  };
}

/** Returns the pin color for a given spot type within an activity, falling
 *  back to the activity's default. */
export function spotTypeColor(config: ActivitySpotConfig, type: string | null): string {
  if (!type) return config.defaultPinColor;
  const match = config.spotTypes.find((t) => t.value === type);
  return match?.pinColor ?? config.defaultPinColor;
}

/** Light shape covering both the Prisma include result and any consumer
 *  that prefers to pass already-mapped data. */
export type RoutineMetadataInput = Array<{ group: { slug: string } | null }>;

/** Resolves the activity slug for a routine — used by log forms to know
 *  which ActivitySpot library to surface in the picker. Falls back to the
 *  routine's `subtype` when no metadata group resolves to a known activity.
 *  Returns null when there's no spot-eligible activity (the form can hide
 *  the picker or fall back to free-text). */
export function resolveRoutineActivitySlug(
  metadataGroups: RoutineMetadataInput,
  subtype: string | null,
): string | null {
  for (const entry of metadataGroups) {
    const slug = entry.group?.slug;
    if (!slug) continue;
    const config = getActivitySpotConfig(slug);
    if (config?.supportsMap) return slug;
  }
  if (subtype) {
    const slug = subtype.toLowerCase().replace(/_/g, "-");
    const config = getActivitySpotConfig(slug);
    if (config?.supportsMap) return slug;
  }
  return null;
}

/** Stable shape for a saved ActivitySpot as exposed to log forms. */
export type ActivitySpotBasic = {
  id: string;
  name: string;
  type: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** Mutable draft used by the picker when the user is creating a new spot
 *  in-line during a log session (parallel to NewClimbLocationDraft). */
export type NewActivitySpotDraft = {
  name: string;
  type: string | null;
  region: string;
  latitude: number | null;
  longitude: number | null;
};

// ── Cross-activity spot compatibility ─────────────────────────────────────
//
// Some places host multiple activities — Paugussett State Forest is both a
// climbing crag and a trail-running spot, Bishop is both bouldering and
// hiking, Tahoe is both skiing and snowboarding. The picker surfaces saved
// spots from any "compatible" activity so users don't have to re-create the
// same place under each sport.
//
// Conservative defaults: outdoor + endurance activities cross-pollinate;
// facility-bound sports (basketball, tennis, golf) stay pure to avoid
// noisy dropdowns. A spot's origin activity is preserved when picked —
// the log links to the existing record, not a duplicate.
const COMPATIBLE_ACTIVITY_SPOTS: Record<string, string[]> = {
  // Endurance activities can happen almost anywhere outdoor — wide net.
  "trail-running":     ["trail-running", "hiking", "climbing", "mountain-biking", "gravel-cycling"],
  "hiking":            ["hiking", "climbing", "trail-running", "mountain-biking"],
  "running":           ["running", "trail-running", "walking"],
  "road-running":      ["road-running", "running", "walking"],
  "walking":           ["walking", "running", "trail-running", "hiking"],
  "mountain-biking":   ["mountain-biking", "trail-running", "hiking", "gravel-cycling"],
  "gravel-cycling":    ["gravel-cycling", "mountain-biking", "trail-running", "biking", "road-cycling"],
  "biking":            ["biking", "road-cycling", "gravel-cycling"],
  "road-cycling":      ["road-cycling", "biking", "gravel-cycling"],
  "rowing":            ["rowing"],
  "open-water-swimming": ["open-water-swimming", "surfing"],
  "swimming":          ["swimming", "pool-swimming", "open-water-swimming"],
  "pool-swimming":     ["pool-swimming", "swimming"],

  // Climbing: own crags + hiking spots (approach trails / shared trailheads).
  "climbing":          ["climbing", "hiking"],

  // Board sports: snow shares between skiing/snowboarding; surf with
  // open-water swimming; skate parks pretty isolated.
  "snowboarding":      ["snowboarding", "skiing"],
  "skiing":            ["skiing", "snowboarding"],
  "surfing":           ["surfing", "open-water-swimming"],
  "skateboarding":     ["skateboarding"],

  // Facility-bound sports — own only.
  "basketball":        ["basketball"],
  "tennis":            ["tennis"],
  "golf":              ["golf"],
};

/** Returns the activity slugs whose saved spots should appear in this
 *  activity's picker. Always includes the slug itself. Falls back to
 *  [slug] when there's no entry — conservative default. */
export function compatibleActivitySlugs(slug: string): string[] {
  return COMPATIBLE_ACTIVITY_SPOTS[slug] ?? [slug];
}

/** Unified picker item — covers both ActivitySpot and ClimbLocation rows
 *  so a single dropdown can offer cross-activity spots from either table.
 *  The `kind` discriminator tells the form which FK to set when saving. */
export type SpotPickerItem = {
  id: string;
  kind: "activitySpot" | "climbLocation";
  name: string;
  region: string | null;
  type: string | null;
  /** The activity this spot was originally created under. */
  originSlug: string;
  /** Display label for the origin activity ("Climbing", "Trail Running"). */
  originLabel: string;
  /** True when the spot's origin matches the routine's activity slug —
   *  drives the optgroup split between "your spots" vs "from elsewhere". */
  isOwnActivity: boolean;
};

/** Discriminated selection shape returned by the picker. The form maps
 *  this to either `activitySpotId` or `climbLocationId` on RoutineLog. */
export type SpotSelection =
  | { kind: "activitySpot"; id: string }
  | { kind: "climbLocation"; id: string };

/** Server-side helper used by both the log-data API and the full-page log
 *  route to assemble the dropdown contents. Takes raw rows from each
 *  source table + the routine's own activity slug, returns picker items
 *  with origin metadata + own/cross flag. */
export function buildSpotPickerItems(input: {
  ownActivitySlug: string;
  activitySpots: Array<{
    id: string;
    activitySlug: string;
    name: string;
    type: string | null;
    region: string | null;
  }>;
  climbLocations: Array<{
    id: string;
    name: string;
    type: string;
    region: string | null;
  }>;
}): SpotPickerItem[] {
  const items: SpotPickerItem[] = [];
  for (const spot of input.activitySpots) {
    const entry = getActivityEntry(spot.activitySlug);
    items.push({
      id: spot.id,
      kind: "activitySpot",
      name: spot.name,
      region: spot.region,
      type: spot.type,
      originSlug: spot.activitySlug,
      originLabel: entry?.label ?? spot.activitySlug,
      isOwnActivity: spot.activitySlug === input.ownActivitySlug,
    });
  }
  for (const loc of input.climbLocations) {
    items.push({
      id: loc.id,
      kind: "climbLocation",
      name: loc.name,
      region: loc.region,
      type: loc.type,
      originSlug: "climbing",
      originLabel: "Climbing",
      isOwnActivity: input.ownActivitySlug === "climbing",
    });
  }
  // Own-activity spots first, then alphabetical within each group.
  return items.sort((a, b) => {
    if (a.isOwnActivity !== b.isOwnActivity) return a.isOwnActivity ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
