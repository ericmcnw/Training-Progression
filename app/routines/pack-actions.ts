"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { revalidateAllLogSurfaces } from "@/lib/revalidate-helpers";
import { getRoutinePacks } from "@/lib/routine-packs-data";

// Adds one routine from a pack, or the whole pack when no routineKey is sent.
// A routine the account already has by that name is left alone.
export async function addPackRoutines(formData: FormData) {
  const packKey = String(formData.get("packKey") ?? "");
  const routineKey = String(formData.get("routineKey") ?? "");

  const pack = (await getRoutinePacks()).find((p) => p.key === packKey);
  if (!pack) throw new Error("That pack isn't available.");
  const wanted = routineKey ? pack.routines.filter((r) => r.key === routineKey) : pack.routines;

  const existing = await prisma.routine.findMany({
    where: { isDeleted: false, isActive: true, name: { in: wanted.map((r) => r.name) } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((r) => r.name));

  for (const routine of wanted) {
    if (existingNames.has(routine.name)) continue;

    const exercises = await prisma.exercise.findMany({
      where: { name: { in: routine.exercises.map((e) => e.name) } },
      orderBy: { profileKey: { sort: "desc", nulls: "last" } },
      select: { id: true, name: true },
    });
    const exerciseIdByName = new Map<string, string>();
    for (const exercise of exercises) {
      if (!exerciseIdByName.has(exercise.name)) exerciseIdByName.set(exercise.name, exercise.id);
    }

    const rows = routine.exercises.flatMap((item) => {
      const exerciseId = exerciseIdByName.get(item.name);
      return exerciseId ? [{ item, exerciseId }] : [];
    });

    await prisma.routine.create({
      data: {
        name: routine.name,
        description: routine.description ?? null,
        domain: routine.domain,
        kind: "WORKOUT",
        subtype: routine.subtype,
        supportsSports: routine.supportsSports ?? [],
        exercises: {
          create: rows.map(({ item, exerciseId }, index) => ({
            exerciseId,
            sortOrder: index,
            defaultSets: item.sets,
            prescription: {
              create: {
                sets: item.sets,
                repsMin: item.repsMin ?? null,
                repsMax: item.repsMax ?? null,
                seconds: item.seconds ?? null,
                cue: item.cue ?? null,
              },
            },
          })),
        },
      },
    });
  }

  revalidateAllLogSurfaces();
  redirect("/log?mode=packs&added=" + encodeURIComponent(packKey));
}
