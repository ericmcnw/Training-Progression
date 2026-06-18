import type { PrismaClient } from "@/generated/prisma";
import { inferExerciseMetadataSlugs } from "@/lib/metadata";
import {
  clearsFloor,
  computeLoad,
  effectiveEffort,
  effortIntensity,
  musclesForActivity,
} from "@/lib/strain";
import { sportSlugFromRoutineId } from "@/lib/synthetic-sport-routines";
import { TYPE_SLUG_TO_REGISTRY_SLUG } from "@/lib/activities/endurance-palette";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

// Coarse muscle/training tags used on exercises don't match the granular body-
// zone group slugs, so they'd light up nothing on the map. Expand them to the
// zone groups they actually cover. (`back` and `abductors` exist as groups but
// have no zone; `core` is a training group, not a muscle group.)
const ZONE_GROUP_ALIASES: Record<string, string[]> = {
  back: ["upper-back", "lats"],
  core: ["abs", "obliques"],
  abductors: ["glute-medius"],
};

function expandToZoneGroups(slug: string): string[] {
  return ZONE_GROUP_ALIASES[slug] ?? [slug];
}

function summarizeSets(sets: Array<{ reps: number | null; seconds: number | null; weightLb: number | null }>) {
  const setCount = sets.length;
  const heaviest = Math.max(0, ...sets.map((set) => set.weightLb ?? 0));
  const reps = sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  const seconds = sets.reduce((sum, set) => sum + (set.seconds ?? 0), 0);
  const parts = [`${setCount} set${setCount === 1 ? "" : "s"}`];
  if (reps > 0) parts.push(`${reps} reps`);
  if (seconds > 0) parts.push(`${Math.round(seconds / 60)} min`);
  if (heaviest > 0) parts.push(`top ${heaviest.toFixed(1)} lb`);
  return parts.join(" · ");
}

function deriveIntensity(sets: Array<{ reps: number | null; seconds: number | null; weightLb: number | null }>) {
  const heaviest = Math.max(0, ...sets.map((set) => set.weightLb ?? 0));
  const reps = sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  const seconds = sets.reduce((sum, set) => sum + (set.seconds ?? 0), 0);
  if (heaviest <= 0 && reps <= 0 && seconds <= 0) return null;
  if (heaviest >= 100) return "hard";
  if (heaviest >= 50 || reps >= 30 || seconds >= 180) return "moderate";
  return "easy";
}

export async function syncRoutineLogZoneActivityDates(tx: Tx, routineLogId: string) {
  const log = await tx.routineLog.findUnique({
    where: { id: routineLogId },
    select: { id: true, performedAt: true },
  });
  if (!log) return;

  await tx.zoneActivity.updateMany({
    where: { routineLogId: log.id },
    data: { performedAt: log.performedAt },
  });
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

// Distance-only cardio (a logged walk/run with no duration) still needs a
// duration to size its load + floor check. Estimate from distance at a blended
// ~10 min/mile; fall back to a default session length when neither is known.
function estimateDurationMin(durationSec: number | null, distanceMi: number | null): number {
  if (durationSec && durationSec > 0) return durationSec / 60;
  if (distanceMi && distanceMi > 0) return distanceMi * 10;
  return 30;
}

function activityLabel(
  log: { activityType: { name: string } | null; routine: { name: string } | null; distanceMi: number | null; durationSec: number | null },
  registrySlug: string,
): string {
  const base = log.activityType?.name ?? log.routine?.name ?? humanizeSlug(registrySlug);
  const bits: string[] = [];
  if (log.distanceMi && log.distanceMi > 0) bits.push(`${log.distanceMi} mi`);
  if (log.durationSec && log.durationSec > 0) bits.push(`${Math.round(log.durationSec / 60)} min`);
  return bits.length > 0 ? `${base} · ${bits.join(" · ")}` : base;
}

// Body-map zone activities for cardio + sport logs. Unlike the EXERCISE path
// (which reads sets/metadata), this maps the activity's REGISTRY slug to muscle
// groups via ACTIVITY_MUSCLE_MAP and stamps each lit zone with the session's
// effort-derived intensity. Idempotent: clears this log's prior SPORT_TAG rows
// first, so editing effort (or dropping below the load floor) recomputes them.
export async function createActivityZoneActivitiesForLog(tx: Tx, routineLogId: string) {
  const log = await tx.routineLog.findUnique({
    where: { id: routineLogId },
    select: {
      id: true,
      performedAt: true,
      effort: true,
      durationSec: true,
      distanceMi: true,
      routineId: true,
      activityType: { select: { name: true, slug: true } },
      routine: { select: { name: true } },
    },
  });
  if (!log) return;

  // Always clear prior rows for this log so edits recompute cleanly (and a
  // log that drops below the floor on edit loses its zones).
  await tx.zoneActivity.deleteMany({ where: { routineLogId: log.id, source: "SPORT_TAG" } });

  // Registry slug: sport synthetic routine id → sport slug; otherwise a cardio
  // activity type → its registry slug.
  const sportSlug = sportSlugFromRoutineId(log.routineId);
  const registrySlug =
    sportSlug ??
    (log.activityType?.slug ? TYPE_SLUG_TO_REGISTRY_SLUG[log.activityType.slug] ?? null : null);
  if (!registrySlug) return;

  const muscles = musclesForActivity(registrySlug);
  if (muscles.length === 0) return;

  const durationMin = estimateDurationMin(log.durationSec, log.distanceMi);
  const effort = effectiveEffort(log.effort, durationMin);
  const load = computeLoad(effort, durationMin);
  // Recovery-tier sessions (a 1-mi stroll) stay under the floor and light
  // nothing — keeps the body map meaningful.
  if (!clearsFloor(load, registrySlug)) return;

  const intensity = effortIntensity(effort);

  const allMuscleGroups = await tx.metadataGroup.findMany({
    where: { kind: "MUSCLE_GROUP" },
    select: { slug: true },
  });
  const muscleGroupSlugs = new Set(allMuscleGroups.map((group) => group.slug));
  const zoneGroupSlugs = Array.from(
    new Set(muscles.flatMap(expandToZoneGroups).filter((slug) => muscleGroupSlugs.has(slug)))
  );
  if (zoneGroupSlugs.length === 0) return;

  const zones = await tx.bodyZone.findMany({
    where: { metadataGroupSlug: { in: zoneGroupSlugs } },
    select: { id: true },
  });
  if (zones.length === 0) return;

  const label = activityLabel(log, registrySlug);
  await tx.zoneActivity.createMany({
    data: zones.map((zone) => ({
      zoneId: zone.id,
      routineLogId: log.id,
      performedAt: log.performedAt,
      source: "SPORT_TAG" as const,
      label,
      intensity,
    })),
    skipDuplicates: true,
  });
}

export async function createExerciseZoneActivitiesForLog(tx: Tx, routineLogId: string) {
  const log = await tx.routineLog.findUnique({
    where: { id: routineLogId },
    select: {
      id: true,
      performedAt: true,
      routine: {
        select: {
          name: true,
          metadataGroups: {
            include: { group: { select: { slug: true, kind: true } } },
          },
        },
      },
      exercises: {
        include: {
          sets: { orderBy: { setNumber: "asc" } },
          exercise: {
            select: {
              name: true,
              isUnilateral: true,
              metadataGroups: {
                include: { group: { select: { slug: true, kind: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!log) return;

  await tx.zoneActivity.deleteMany({ where: { routineLogId: log.id, source: "EXERCISE" } });
  await syncRoutineLogZoneActivityDates(tx, log.id);

  // ── Collect muscle group slugs from exercises ─────────────────────────────
  const allMuscleGroups = await tx.metadataGroup.findMany({
    where: { kind: "MUSCLE_GROUP" },
    select: { slug: true },
  });
  const muscleGroupSlugs = new Set(allMuscleGroups.map((group) => group.slug));
  // A slug is usable if it's a real muscle group OR an aliasable coarse tag
  // (back / core / abductors) that expands to zone groups.
  const isMappable = (slug: string) => muscleGroupSlugs.has(slug) || Boolean(ZONE_GROUP_ALIASES[slug]);
  const toZoneGroups = (slugs: string[]) =>
    Array.from(new Set(slugs.flatMap(expandToZoneGroups).filter((slug) => muscleGroupSlugs.has(slug))));
  const exerciseMuscleSlugs = (entry: (typeof log.exercises)[number]) => {
    const direct = entry.exercise.metadataGroups
      .map((g) => g.group.slug)
      .filter(isMappable);
    if (direct.length > 0) return toZoneGroups(direct);
    return toZoneGroups(inferExerciseMetadataSlugs(entry.exercise.name).filter(isMappable));
  };

  const exerciseGroupSlugs = new Set(log.exercises.flatMap((entry) => exerciseMuscleSlugs(entry)));

  // ── Collect muscle group slugs from the routine itself ────────────────────
  const routineGroupSlugs = toZoneGroups(
    log.routine.metadataGroups.map((g) => g.group.slug).filter(isMappable)
  );

  // Routine groups that aren't already covered per-exercise get their own entries
  const routineOnlySlugs = routineGroupSlugs.filter((slug) => !exerciseGroupSlugs.has(slug));

  const allSlugs = Array.from(new Set([...exerciseGroupSlugs, ...routineOnlySlugs]));
  if (allSlugs.length === 0) return;

  // ── Fetch body zones for all slugs ────────────────────────────────────────
  const zones = await tx.bodyZone.findMany({
    where: { metadataGroupSlug: { in: allSlugs } },
    select: { id: true, metadataGroupSlug: true },
  });
  const zonesBySlug = new Map<string, typeof zones>();
  for (const zone of zones) {
    const current = zonesBySlug.get(zone.metadataGroupSlug ?? "") ?? [];
    current.push(zone);
    zonesBySlug.set(zone.metadataGroupSlug ?? "", current);
  }

  // ── Per-exercise zone activities ──────────────────────────────────────────
  const exerciseData = log.exercises.flatMap((entry) => {
    const groupSlugs = exerciseMuscleSlugs(entry);
    const label = `${entry.exercise.name} ${summarizeSets(entry.sets)}`;
    const intensity = deriveIntensity(entry.sets);
    return groupSlugs.flatMap((slug) =>
      (zonesBySlug.get(slug) ?? []).map((zone) => ({
        zoneId: zone.id,
        routineLogId: log.id,
        performedAt: log.performedAt,
        source: "EXERCISE" as const,
        label,
        intensity,
      }))
    );
  });

  // ── Routine-level zone activities (groups not covered by any exercise) ────
  const routineData = routineOnlySlugs.flatMap((slug) =>
    (zonesBySlug.get(slug) ?? []).map((zone) => ({
      zoneId: zone.id,
      routineLogId: log.id,
      performedAt: log.performedAt,
      source: "EXERCISE" as const,
      label: log.routine.name,
      intensity: null as string | null,
    }))
  );

  const data = [...exerciseData, ...routineData];
  if (data.length > 0) {
    await tx.zoneActivity.createMany({ data, skipDuplicates: true });
  }
}
