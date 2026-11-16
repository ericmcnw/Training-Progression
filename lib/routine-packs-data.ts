import { getAppSession } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma-base";
import {
  OWNER_PACK_KEY,
  OWNER_PACK_ROUTINE_NAMES,
  ROUTINE_PACKS,
  type PackRoutine,
  type RoutinePack,
} from "@/lib/routine-packs";

const CATALOG_OWNER_KEY = "default";
const WORKOUT_SUBTYPES = new Set(["STRENGTH", "HYPERTROPHY", "REHAB", "OTHER"]);
const PACK_DOMAINS = new Set(["strength", "mobility", "general"]);

// Reads another profile's routines on purpose, so it goes through basePrisma
// with an explicit profileKey. Only structure is copied: catalog exercises,
// sets, reps and cues. Loads and private exercises stay with their owner.
async function getOwnerPack(): Promise<RoutinePack | null> {
  const [owner, routines] = await Promise.all([
    basePrisma.appProfile.findUnique({ where: { key: CATALOG_OWNER_KEY }, select: { displayName: true } }),
    basePrisma.routine.findMany({
      where: {
        profileKey: CATALOG_OWNER_KEY,
        name: { in: OWNER_PACK_ROUTINE_NAMES },
        kind: "WORKOUT",
        isActive: true,
        isDeleted: false,
        isPlaceholder: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        domain: true,
        subtype: true,
        supportsSports: true,
        exercises: {
          orderBy: { sortOrder: "asc" },
          select: {
            defaultSets: true,
            exercise: { select: { name: true, profileKey: true } },
            prescription: { select: { sets: true, repsMin: true, repsMax: true, seconds: true, cue: true } },
          },
        },
      },
    }),
  ]);
  if (routines.length === 0) return null;

  const packRoutines: PackRoutine[] = OWNER_PACK_ROUTINE_NAMES.flatMap((name) => {
    const routine = routines.find((r) => r.name === name);
    if (!routine) return [];
    return [{
      key: routine.id,
      name: routine.name,
      ...(routine.description ? { description: routine.description } : {}),
      domain: (PACK_DOMAINS.has(routine.domain) ? routine.domain : "general") as PackRoutine["domain"],
      subtype: (routine.subtype && WORKOUT_SUBTYPES.has(routine.subtype) ? routine.subtype : "OTHER") as PackRoutine["subtype"],
      supportsSports: routine.supportsSports,
      exercises: routine.exercises
        .filter((row) => row.exercise.profileKey === null)
        .map((row) => ({
          name: row.exercise.name,
          sets: row.prescription?.sets ?? row.defaultSets,
          ...(row.prescription?.repsMin != null ? { repsMin: row.prescription.repsMin } : {}),
          ...(row.prescription?.repsMax != null ? { repsMax: row.prescription.repsMax } : {}),
          ...(row.prescription?.seconds != null ? { seconds: row.prescription.seconds } : {}),
          ...(row.prescription?.cue ? { cue: row.prescription.cue } : {}),
        })),
    }];
  });

  const ownerName = owner?.displayName?.trim() || "Eric";
  return {
    key: OWNER_PACK_KEY,
    label: `${ownerName}'s workouts`,
    description: `The routines ${ownerName} actually trains with, as they are today. Weights are left for you to find.`,
    routines: packRoutines,
  };
}

export async function getRoutinePacks(): Promise<RoutinePack[]> {
  const { profileKey } = await getAppSession();
  if (profileKey === CATALOG_OWNER_KEY) return ROUTINE_PACKS;
  const ownerPack = await getOwnerPack();
  return ownerPack ? [...ROUTINE_PACKS, ownerPack] : ROUTINE_PACKS;
}
