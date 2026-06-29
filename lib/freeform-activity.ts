// Freeform "Activity" log — the catch-all for mixed/casual movement that
// fits no structured sport, workout, or endurance type (a beach day of
// swimming + jumping + walking, messing around in the pool, a wander
// around town). Its first job is to kill the false "rest day": any log
// against it marks an active day. See [[project-bodymap-activity-redesign]].
//
// It rides the synthetic-sport rails (one placeholder SESSION routine,
// domain=sport) but is a pinned catch-all, NOT a selectable sport — it's
// excluded from the add/remove sport picker and surfaced via its own
// always-present entry points (the /log tile + the FAB).
//
// This module is client-safe (no prisma) so the log sheet can import the
// tag/duration vocab. The routine upsert lives server-side in
// app/log/activity-actions.ts.

export const FREEFORM_ACTIVITY_SLUG = "activity";

// Reuses the `sports-{slug}-synthetic` id shape so existing sport-aware
// code paths (zone-activities slug extraction, person-pool scans) treat it
// uniformly without special-casing.
export const FREEFORM_ACTIVITY_ROUTINE_ID = "sports-activity-synthetic";

export function isFreeformActivityRoutineId(id: string): boolean {
  return id === FREEFORM_ACTIVITY_ROUTINE_ID;
}

export type ActivityTag = { key: string; label: string };

// What you did — labels, not muscles. Multi-select; a single beach day is
// swim + walk + jump in one log. Body-part involvement is a separate,
// optional step (Phase 1b) — tags never auto-light the body map.
export const ACTIVITY_TAGS: ActivityTag[] = [
  { key: "walk", label: "Walk" },
  { key: "run", label: "Run" },
  { key: "swim", label: "Swim" },
  { key: "hike", label: "Hike" },
  { key: "bike", label: "Bike" },
  { key: "paddle", label: "Paddle" },
  { key: "surf", label: "Surf" },
  { key: "jump", label: "Jump" },
  { key: "play", label: "Play" },
  { key: "ball", label: "Ball sport" },
  { key: "climb", label: "Climb" },
  { key: "lift", label: "Lift" },
  { key: "stretch", label: "Stretch" },
];

const TAG_LABEL = new Map(ACTIVITY_TAGS.map((t) => [t.key, t.label]));

/** Human label for a stored tag key, or the key itself if unknown. */
export function activityTagLabel(key: string): string {
  return TAG_LABEL.get(key) ?? key;
}

export type DurationBucket = { key: string; label: string; minutes: number; hint: string };

// Casual duration buckets — one tap fills a representative duration so the
// log still carries minutes (needed for stats/active-day) without demanding
// precision. An exact-minutes input sits alongside for when it's known.
export const DURATION_BUCKETS: DurationBucket[] = [
  { key: "bit", label: "A bit", minutes: 20, hint: "~20 min" },
  { key: "while", label: "A while", minutes: 60, hint: "~1 hr" },
  { key: "day", label: "Most of the day", minutes: 180, hint: "~3 hr" },
];

export type BodyPartOption = { key: string; label: string };

// Coarse, user-facing body parts for the optional "what felt worked" picker.
// User-asserted (we never auto-guess muscles for freeform movement). Each key
// expands to the granular muscle-group slugs that map to BodyZones — see
// BODY_PART_ZONE_GROUPS. Tagging a part writes a MANUAL ZoneActivity that
// lights the body map's "recently worked" view.
export const BODY_PART_OPTIONS: BodyPartOption[] = [
  { key: "back", label: "Back" },
  { key: "shoulders", label: "Shoulders" },
  { key: "chest", label: "Chest" },
  { key: "arms", label: "Arms" },
  { key: "core", label: "Core" },
  { key: "lower-back", label: "Lower back" },
  { key: "glutes", label: "Glutes" },
  { key: "hips", label: "Hips" },
  { key: "quads", label: "Quads" },
  { key: "hamstrings", label: "Hamstrings" },
  { key: "calves", label: "Calves" },
  { key: "neck", label: "Neck" },
];

// Coarse part → granular muscle-group slugs (must match BodyZone.metadataGroupSlug,
// per prisma/seed-body-zones.mjs). Unmatched slugs simply light nothing.
export const BODY_PART_ZONE_GROUPS: Record<string, string[]> = {
  back: ["upper-back", "lats"],
  shoulders: ["shoulders"],
  chest: ["chest"],
  arms: ["biceps", "triceps", "forearms"],
  core: ["abs", "obliques"],
  "lower-back": ["lower-back"],
  glutes: ["glutes", "glute-medius"],
  hips: ["hip-flexors", "adductors"],
  quads: ["quads"],
  hamstrings: ["hamstrings"],
  calves: ["calves"],
  neck: ["neck"],
};

/** Flatten a set of body-part keys to the granular zone-group slugs they cover. */
export function bodyPartsToZoneGroups(keys: string[]): string[] {
  const out = new Set<string>();
  for (const key of keys) {
    for (const slug of BODY_PART_ZONE_GROUPS[key] ?? []) out.add(slug);
  }
  return Array.from(out);
}

const PART_LABEL = new Map(BODY_PART_OPTIONS.map((p) => [p.key, p.label]));

/** Human label for a stored body-part key. */
export function bodyPartLabel(key: string): string {
  return PART_LABEL.get(key) ?? key;
}

/** Safely read the validated body-part keys off a freeform log's sportData blob. */
export function freeformBodyPartsFromSportData(sportData: unknown): string[] {
  if (!sportData || typeof sportData !== "object" || Array.isArray(sportData)) return [];
  const parts = (sportData as Record<string, unknown>).bodyParts;
  if (!Array.isArray(parts)) return [];
  return parts.filter(
    (p): p is string => typeof p === "string" && BODY_PART_ZONE_GROUPS[p] !== undefined,
  );
}
