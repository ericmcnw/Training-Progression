// Canonical endurance palette shared by every chart that splits by
// activity type — bar chart, pace chart, future overlays. Centralized
// so a Trail Run is the same purple everywhere it appears.

// Activity-type slug → registry slug, so typed logs against the
// synthetic Endurance routine credit the same palette buckets the
// legacy metadata-tagged routines already do.
export const TYPE_SLUG_TO_REGISTRY_SLUG: Record<string, string> = {
  "run": "running",
  "trail-run": "trail-running",
  "long-run": "running",
  "tempo-run": "running",
  "easy-run": "running",
  "interval-run": "running",
  "sprint": "running",
  "walk": "walking",
  "hike": "hiking",
  "bike": "biking",
  "mtb": "mountain-biking",
  "road-bike": "road-cycling",
  "gravel-bike": "gravel-cycling",
  "swim": "swimming",
  "open-water-swim": "open-water-swimming",
  "row": "rowing",
  "erg-row": "rowing",
};

export const ENDURANCE_ACTIVITY_COLORS: Record<string, string> = {
  running:                "rgba(59,130,246,0.9)",
  "road-running":         "rgba(30,64,175,0.9)",
  "trail-running":        "rgba(168,85,247,0.9)",
  walking:                "rgba(244,114,182,0.9)",
  biking:                 "rgba(250,204,21,0.9)",
  cycling:                "rgba(250,204,21,0.9)",
  "road-cycling":         "rgba(249,115,22,0.9)",
  "mountain-biking":      "rgba(194,65,12,0.9)",
  "gravel-cycling":       "rgba(214,188,138,0.9)",
  swimming:               "rgba(6,182,212,0.9)",
  "pool-swimming":        "rgba(103,232,249,0.9)",
  "open-water-swimming":  "rgba(14,116,144,0.9)",
  rowing:                 "rgba(239,68,68,0.9)",
  hiking:                 "rgba(34,197,94,0.9)",
  backpacking:            "rgba(132,204,120,0.9)",
};

export const ENDURANCE_FALLBACK_COLORS = [
  "rgba(236,72,153,0.9)",
  "rgba(245,158,11,0.9)",
  "rgba(167,139,250,0.9)",
];

// Picks the right color for an activity-type label + its slug. Returns
// null when no palette match exists — caller can fall back to a rotating
// palette so consistency across charts is preserved.
export function colorForActivity(label: string, typeSlug: string | null | undefined): string | null {
  if (typeSlug) {
    const mapped = TYPE_SLUG_TO_REGISTRY_SLUG[typeSlug];
    if (mapped && ENDURANCE_ACTIVITY_COLORS[mapped]) return ENDURANCE_ACTIVITY_COLORS[mapped];
  }
  const labelSlug = label.toLowerCase().replace(/\s+/g, "-");
  return ENDURANCE_ACTIVITY_COLORS[labelSlug] ?? null;
}
