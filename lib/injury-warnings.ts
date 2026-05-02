import { prisma } from "@/lib/prisma";

export type PainCheckZone = { slug: string; label: string };

export type RoutineInjuryWarning = {
  zoneLabels: string[];
  exercises: Array<{ id: string; name: string; zoneLabels: string[] }>;
};

export async function getActiveInjuryZoneContext() {
  const rows = await prisma.injuryZone.findMany({
    where: { injury: { status: { in: ["ACTIVE", "FLARED"] } } },
    include: {
      zone: { select: { label: true, metadataGroupSlug: true, region: true } },
    },
  });
  const labelsBySlug = new Map<string, Set<string>>();
  for (const row of rows) {
    const slug = row.zone.metadataGroupSlug ?? row.zone.region;
    const labels = labelsBySlug.get(slug) ?? new Set<string>();
    labels.add(row.zone.label);
    labelsBySlug.set(slug, labels);
  }
  return labelsBySlug;
}

export async function getRoutineInjuryLoadWarning(routineId: string): Promise<RoutineInjuryWarning | null> {
  const injuryLabelsBySlug = await getActiveInjuryZoneContext();
  if (injuryLabelsBySlug.size === 0) return null;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      exercises: {
        select: {
          exercise: {
            select: {
              id: true,
              name: true,
              metadataGroups: { include: { group: { select: { slug: true, kind: true } } } },
            },
          },
        },
      },
    },
  });
  if (!routine) return null;

  const exercises = routine.exercises
    .map((entry) => {
      const labels = new Set<string>();
      for (const groupEntry of entry.exercise.metadataGroups) {
        if (groupEntry.group.kind !== "MUSCLE_GROUP") continue;
        for (const label of injuryLabelsBySlug.get(groupEntry.group.slug) ?? []) labels.add(label);
      }
      return { id: entry.exercise.id, name: entry.exercise.name, zoneLabels: Array.from(labels) };
    })
    .filter((entry) => entry.zoneLabels.length > 0);

  if (exercises.length === 0) return null;
  return {
    zoneLabels: Array.from(new Set(exercises.flatMap((exercise) => exercise.zoneLabels))),
    exercises,
  };
}

/**
 * Returns the injury zones that are relevant to a specific routine.
 * Used to decide whether to show a post-log pain check.
 * Checks routine-level metadata groups, exercise groups, and guided step groups.
 */
export async function getRoutinePainCheckZones(routineId: string): Promise<PainCheckZone[]> {
  const injuryZoneRows = await prisma.injuryZone.findMany({
    where: { injury: { status: { in: ["ACTIVE", "FLARED"] } } },
    distinct: ["zoneId"],
    include: {
      zone: { select: { slug: true, label: true, metadataGroupSlug: true, region: true } },
    },
  });
  if (injuryZoneRows.length === 0) return [];

  const zonesByGroupSlug = new Map<string, PainCheckZone[]>();
  for (const row of injuryZoneRows) {
    const key = row.zone.metadataGroupSlug ?? row.zone.region;
    if (!key) continue;
    const bucket = zonesByGroupSlug.get(key) ?? [];
    bucket.push({ slug: row.zone.slug, label: row.zone.label });
    zonesByGroupSlug.set(key, bucket);
  }

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      metadataGroups: { include: { group: { select: { slug: true, kind: true } } } },
      exercises: {
        select: {
          exercise: {
            select: {
              metadataGroups: { include: { group: { select: { slug: true, kind: true } } } },
            },
          },
        },
      },
      guidedSteps: {
        select: {
          metadataGroups: { include: { group: { select: { slug: true, kind: true } } } },
          exercise: {
            select: {
              metadataGroups: { include: { group: { select: { slug: true, kind: true } } } },
            },
          },
        },
      },
    },
  });
  if (!routine) return [];

  const muscleGroupSlugs = new Set<string>();

  for (const { group } of routine.metadataGroups) {
    if (group.kind === "MUSCLE_GROUP") muscleGroupSlugs.add(group.slug);
  }
  for (const { exercise } of routine.exercises) {
    for (const { group } of exercise.metadataGroups) {
      if (group.kind === "MUSCLE_GROUP") muscleGroupSlugs.add(group.slug);
    }
  }
  for (const step of routine.guidedSteps) {
    for (const { group } of step.metadataGroups) {
      if (group.kind === "MUSCLE_GROUP") muscleGroupSlugs.add(group.slug);
    }
    if (step.exercise) {
      for (const { group } of step.exercise.metadataGroups) {
        if (group.kind === "MUSCLE_GROUP") muscleGroupSlugs.add(group.slug);
      }
    }
  }

  if (muscleGroupSlugs.size === 0) return [];

  const result: PainCheckZone[] = [];
  const seen = new Set<string>();
  for (const slug of muscleGroupSlugs) {
    for (const zone of zonesByGroupSlug.get(slug) ?? []) {
      if (!seen.has(zone.slug)) {
        seen.add(zone.slug);
        result.push(zone);
      }
    }
  }
  return result;
}

export async function getExerciseInjuryWarnings(exerciseIds: string[]) {
  const injuryLabelsBySlug = await getActiveInjuryZoneContext();
  if (injuryLabelsBySlug.size === 0 || exerciseIds.length === 0) return new Map<string, string>();
  const exercises = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: {
      id: true,
      metadataGroups: { include: { group: { select: { slug: true, kind: true } } } },
    },
  });
  return new Map(
    exercises
      .map((exercise) => {
        const labels = new Set<string>();
        for (const groupEntry of exercise.metadataGroups) {
          if (groupEntry.group.kind !== "MUSCLE_GROUP") continue;
          for (const label of injuryLabelsBySlug.get(groupEntry.group.slug) ?? []) labels.add(label);
        }
        return [exercise.id, Array.from(labels).join(", ")] as const;
      })
      .filter(([, label]) => label.length > 0)
  );
}
