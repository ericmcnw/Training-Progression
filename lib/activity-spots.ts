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
