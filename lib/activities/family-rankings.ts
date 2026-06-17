import {
  ACTIVITY_REGISTRY,
  activitiesByFamily,
  getActivityEntry,
  type ActivityFamily,
  type ActivityRegistryEntry,
} from "@/lib/activity-families";
import { effectiveRoutineDomain } from "@/lib/routines";

// Pure aggregation helpers used by the /activities main page (collapsed
// section content) and by per-family dashboards. Inputs are the
// already-loaded routine + log slices — these helpers don't talk to
// Prisma, so they can be reused freely across server components without
// inflating roundtrips.

export type FamilyStats = {
  sessions4w: number;
  activeRoutines: number;
};

export type TopRoutine = {
  id: string;
  name: string;
  sessions4w: number;
  lastSessionAt: Date | null;
};

export type TopActivity = {
  entry: ActivityRegistryEntry;
  sessions4w: number;
  totalDistanceMi: number;
  totalDurationSec: number;
  lastSessionAt: Date | null;
};

// Minimal shape needed from a routine row — keeps callers flexible.
export type RoutineForRanking = {
  id: string;
  name: string;
  subtype: string | null;
  domain: string;
  kind: string;
  isActive: boolean;
  // metadataGroups carries activity tags for endurance/sport classification.
  metadataGroups?: Array<{ group?: { slug?: string | null } | null }> | null;
  // activityType.familyId carries endurance classification for typed routines.
  activityType?: { id: string; familyId?: string | null } | null;
};

export type LogForRanking = {
  id: string;
  routineId: string;
  performedAt: Date;
  distanceMi?: number | null;
  durationSec?: number | null;
  // Activity-type family the log itself carries (post-edit source of
  // truth for typed endurance logs against the synthetic Endurance
  // routine). When absent, classification routes through the log's
  // routine via `routineId`.
  activityType?: { slug: string; familyId?: string | null } | null;
};

// ─── Family classifiers ──────────────────────────────────────────────────────

function isEnduranceRoutine(r: RoutineForRanking): boolean {
  if (r.activityType) return true;
  if (effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "cardio") return true;
  const slugs = (r.metadataGroups ?? [])
    .map((m) => m.group?.slug)
    .filter((s): s is string => Boolean(s));
  return slugs.some((s) => getActivityEntry(s)?.family === "endurance");
}

function isSportRoutine(r: RoutineForRanking): boolean {
  if (effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "sport") return true;
  const slugs = (r.metadataGroups ?? [])
    .map((m) => m.group?.slug)
    .filter((s): s is string => Boolean(s));
  return slugs.some((s) => getActivityEntry(s)?.family === "sports");
}

function isStrengthRoutine(r: RoutineForRanking): boolean {
  return effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "strength";
}

// Body-work is no longer iterated on /activities (mobility + lifestyle have
// their own families now). The classifier kept matching mobility for any
// direct callers that still ask "is this body-work shaped?" — but most code
// should switch to the dedicated mobility/lifestyle classifiers below.
function isBodyWorkRoutine(r: RoutineForRanking): boolean {
  return isMobilityRoutine(r);
}

function isMobilityRoutine(r: RoutineForRanking): boolean {
  return effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "mobility";
}

function isLifestyleRoutine(r: RoutineForRanking): boolean {
  return effectiveRoutineDomain(r.domain, r.kind, r.subtype) === "lifestyle";
}

export function routineBelongsToFamily(r: RoutineForRanking, family: ActivityFamily): boolean {
  switch (family) {
    case "endurance": return isEnduranceRoutine(r);
    case "sports":    return isSportRoutine(r);
    case "strength":  return isStrengthRoutine(r);
    case "body-work": return isBodyWorkRoutine(r);
    case "mobility":  return isMobilityRoutine(r);
    case "lifestyle": return isLifestyleRoutine(r);
  }
}

// ─── Helpers shared across rankings ──────────────────────────────────────────

function logBelongsToRoutineInFamily(
  log: LogForRanking,
  routinesById: Map<string, RoutineForRanking>,
  family: ActivityFamily
): boolean {
  // First check the log's own activityType — post-edit source of truth
  // for typed logs against the synthetic Endurance routine (which has
  // no metadata of its own). Every ActivityType row sits under an
  // EnduranceFamily (slugs like "running" / "walking" / "cycling"),
  // so a typed log is inherently endurance — we don't need to compare
  // against the type's familyId. If the activity-type system ever
  // expands beyond endurance this collapses to a slug check.
  if (log.activityType) {
    return family === "endurance";
  }
  // Otherwise look up via the routine.
  const routine = routinesById.get(log.routineId);
  if (!routine) return false;
  return routineBelongsToFamily(routine, family);
}

// ─── Family stats (the collapsed-section right-side chips) ───────────────────

export function getFamilyStats(
  routines: RoutineForRanking[],
  logs4w: LogForRanking[],
  family: ActivityFamily
): FamilyStats {
  const routinesById = new Map(routines.map((r) => [r.id, r]));
  const familyRoutineIds = new Set(
    routines.filter((r) => routineBelongsToFamily(r, family)).map((r) => r.id)
  );
  const activeRoutines = routines.filter(
    (r) => r.isActive && familyRoutineIds.has(r.id) && !isPlaceholderName(r)
  ).length;
  const sessions4w = logs4w.filter((log) =>
    logBelongsToRoutineInFamily(log, routinesById, family)
  ).length;
  return { sessions4w, activeRoutines };
}

function isPlaceholderName(r: RoutineForRanking): boolean {
  // Heuristic — Routine model has isPlaceholder flag but we keep the
  // input shape minimal. Callers that include isPlaceholder can filter
  // before passing; if name starts with "Quick Workout · " we treat as
  // placeholder. Cheap belt-and-suspenders.
  return r.name.startsWith("Quick Workout · ");
}

// ─── Top routines (the expanded-section "Top routines" stripe) ──────────────

export function getTopRoutinesForFamily(
  routines: RoutineForRanking[],
  logs4w: LogForRanking[],
  family: ActivityFamily,
  limit = 6
): TopRoutine[] {
  const routinesById = new Map(routines.map((r) => [r.id, r]));
  const familyActiveRoutines = routines.filter(
    (r) => r.isActive && routineBelongsToFamily(r, family) && !isPlaceholderName(r)
  );
  const familyRoutineIds = new Set(familyActiveRoutines.map((r) => r.id));

  const counts = new Map<string, { sessions: number; last: Date | null }>();
  for (const r of familyActiveRoutines) counts.set(r.id, { sessions: 0, last: null });

  for (const log of logs4w) {
    if (!familyRoutineIds.has(log.routineId)) continue;
    const slot = counts.get(log.routineId);
    if (!slot) continue;
    slot.sessions += 1;
    if (!slot.last || log.performedAt > slot.last) slot.last = log.performedAt;
  }

  return Array.from(counts.entries())
    .map(([id, { sessions, last }]) => {
      const routine = routinesById.get(id);
      return {
        id,
        name: routine?.name ?? id,
        sessions4w: sessions,
        lastSessionAt: last,
      };
    })
    .filter((r) => r.sessions4w > 0)
    .sort((a, b) =>
      b.sessions4w - a.sessions4w ||
      (b.lastSessionAt?.getTime() ?? 0) - (a.lastSessionAt?.getTime() ?? 0)
    )
    .slice(0, limit);
}

// ─── Top activities (the expanded-section "Top activities" stripe) ──────────
//
// Only meaningful for endurance + sports — strength + body-work don't have
// activity granularity. Callers should skip the strip for those families.

// activity-type slug → registry slug mapping. Lifted from
// app/activities/page.tsx so typed logs against the synthetic Endurance
// routine credit the same registry buckets as legacy metadata-tagged
// routines.
const TYPE_SLUG_TO_REGISTRY_SLUG: Record<string, string> = {
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

export function getTopActivitiesForFamily(
  routines: RoutineForRanking[],
  logs4w: LogForRanking[],
  family: "endurance" | "sports",
  limit = 6
): TopActivity[] {
  // Build routine → activity-slug set (most-specific child preferred).
  const routineSlugs = new Map<string, Set<string>>();
  for (const r of routines) {
    const slugs = new Set<string>();
    for (const m of r.metadataGroups ?? []) {
      const slug = m.group?.slug;
      if (!slug) continue;
      if (getActivityEntry(slug)?.family === family) slugs.add(slug);
    }
    if (slugs.size > 0) routineSlugs.set(r.id, slugs);
  }

  // Initialize all registered family activities so the result includes
  // zero-session entries when the caller wants to render them.
  const stats = new Map<string, TopActivity>();
  for (const entry of activitiesByFamily(family)) {
    stats.set(entry.slug, {
      entry,
      sessions4w: 0,
      totalDistanceMi: 0,
      totalDurationSec: 0,
      lastSessionAt: null,
    });
  }

  for (const log of logs4w) {
    // Synthetic per-sport routines (sports-<slug>-synthetic) carry the slug
    // in their id and have NO metadata groups, so credit them directly —
    // otherwise every sport-tile log is dropped from the stripe.
    const synthSportSlug =
      family === "sports" &&
      log.routineId.startsWith("sports-") &&
      log.routineId.endsWith("-synthetic")
        ? log.routineId.slice("sports-".length, -"-synthetic".length)
        : undefined;
    // Prefer the log's activityType when present — same priority order as
    // app/activities/page.tsx aggregator.
    const typedSlug = log.activityType
      ? TYPE_SLUG_TO_REGISTRY_SLUG[log.activityType.slug]
      : undefined;
    const slugs: Iterable<string> | undefined = synthSportSlug
      ? [synthSportSlug]
      : typedSlug
        ? [typedSlug]
        : routineSlugs.get(log.routineId);
    if (!slugs) continue;

    for (const slug of slugs) {
      const slot = stats.get(slug);
      if (!slot) continue;
      slot.sessions4w += 1;
      slot.totalDistanceMi += log.distanceMi ?? 0;
      slot.totalDurationSec += log.durationSec ?? 0;
      if (!slot.lastSessionAt || log.performedAt > slot.lastSessionAt) {
        slot.lastSessionAt = log.performedAt;
      }
    }
  }

  return Array.from(stats.values())
    .filter((a) => a.sessions4w > 0)
    .sort((a, b) =>
      b.sessions4w - a.sessions4w ||
      b.totalDistanceMi - a.totalDistanceMi ||
      a.entry.label.localeCompare(b.entry.label)
    )
    .slice(0, limit);
}

// Re-export so callers don't need a second import.
export { ACTIVITY_REGISTRY };
