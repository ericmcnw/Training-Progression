import type { PrismaClient } from "@/generated/prisma";

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

function deriveIntensity(sets: Array<{ weightLb: number | null }>) {
  const heaviest = Math.max(0, ...sets.map((set) => set.weightLb ?? 0));
  if (heaviest <= 0) return null;
  if (heaviest >= 100) return "hard";
  if (heaviest >= 50) return "moderate";
  return "easy";
}

export async function createExerciseZoneActivitiesForLog(tx: Tx, routineLogId: string) {
  const log = await tx.routineLog.findUnique({
    where: { id: routineLogId },
    select: {
      id: true,
      performedAt: true,
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

  const slugs = Array.from(
    new Set(
      log.exercises.flatMap((entry) =>
        entry.exercise.metadataGroups
          .filter((groupEntry) => groupEntry.group.kind === "MUSCLE_GROUP")
          .map((groupEntry) => groupEntry.group.slug)
      )
    )
  );
  if (slugs.length === 0) return;

  const zones = await tx.bodyZone.findMany({
    where: { metadataGroupSlug: { in: slugs } },
    select: { id: true, metadataGroupSlug: true, side: true },
  });
  const zonesBySlug = new Map<string, typeof zones>();
  for (const zone of zones) {
    const current = zonesBySlug.get(zone.metadataGroupSlug ?? "") ?? [];
    current.push(zone);
    zonesBySlug.set(zone.metadataGroupSlug ?? "", current);
  }

  const data = log.exercises.flatMap((entry) => {
    const groupSlugs = Array.from(
      new Set(
        entry.exercise.metadataGroups
          .filter((groupEntry) => groupEntry.group.kind === "MUSCLE_GROUP")
          .map((groupEntry) => groupEntry.group.slug)
      )
    );
    const label = `${entry.exercise.name} ${summarizeSets(entry.sets)}`;
    const intensity = deriveIntensity(entry.sets);
    return groupSlugs.flatMap((slug) =>
      (zonesBySlug.get(slug) ?? [])
        .filter((zone) => !entry.exercise.isUnilateral || zone.side === "BILATERAL" || zone.side === "CENTRAL")
        .map((zone) => ({
          zoneId: zone.id,
          routineLogId: log.id,
          performedAt: log.performedAt,
          source: "EXERCISE" as const,
          label,
          intensity,
        }))
    );
  });

  if (data.length > 0) {
    await tx.zoneActivity.createMany({ data, skipDuplicates: true });
  }
}
