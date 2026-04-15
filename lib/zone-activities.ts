import type { PrismaClient } from "@/generated/prisma";
import { inferExerciseMetadataSlugs } from "@/lib/metadata";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

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

  // ── Collect muscle group slugs from exercises ─────────────────────────────
  const allMuscleGroups = await tx.metadataGroup.findMany({
    where: { kind: "MUSCLE_GROUP" },
    select: { slug: true },
  });
  const muscleGroupSlugs = new Set(allMuscleGroups.map((group) => group.slug));
  const exerciseMuscleSlugs = (entry: (typeof log.exercises)[number]) => {
    const direct = entry.exercise.metadataGroups
      .filter((g) => g.group.kind === "MUSCLE_GROUP")
      .map((g) => g.group.slug);
    if (direct.length > 0) return Array.from(new Set(direct));
    return Array.from(new Set(inferExerciseMetadataSlugs(entry.exercise.name).filter((slug) => muscleGroupSlugs.has(slug))));
  };

  const exerciseGroupSlugs = new Set(log.exercises.flatMap((entry) => exerciseMuscleSlugs(entry)));

  // ── Collect muscle group slugs from the routine itself ────────────────────
  const routineGroupSlugs = log.routine.metadataGroups
    .filter((g) => g.group.kind === "MUSCLE_GROUP")
    .map((g) => g.group.slug);

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
