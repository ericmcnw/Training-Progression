import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  inferExerciseMetadataSlugs,
  ROUTINE_METADATA_SELECTABLE_KINDS,
} from "@/lib/metadata";
import { routineWithFrequencyTarget } from "@/lib/routine-frequency";

// Loads the data the routine create/edit drawer needs in one round-trip:
//   - metadataGroups: full picker options for routine classification
//   - sessionTemplates: SESSION-kind template list
//   - availableSubstituteRoutines: rows the "covered by" picker shows
//   - routine: current values when editing (omitted in new mode)
//   - initialSubstituteRoutineIds: pre-checked rows for the routine's primary
//     FrequencyGoal at fg_<routineId>
//
// The FormDrawer is the only path users hit to create/edit routines —
// page-mode hosts were deleted 2026-05-18.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim() || null;

  if (id) {
    const routine = await prisma.routine.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subtype: true,
        domain: true,
        kind: true,
        isActive: true,
        frequencyGoalRoutines: {
          include: { goal: true },
        },
        sessionDetails: { select: { templateId: true } },
        metadataGroups: { select: { groupId: true } },
        exercises: {
          select: {
            exercise: {
              select: {
                name: true,
                metadataGroups: { select: { groupId: true } },
              },
            },
          },
        },
        tagAssignments: { select: { tag: { select: { name: true } } } },
      },
    });
    if (!routine) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }
    const withTarget = routineWithFrequencyTarget(routine);

    const derivedExerciseMetadataGroupIds = Array.from(
      new Set(routine.exercises.flatMap((entry) => entry.exercise.metadataGroups.map((g) => g.groupId)))
    );
    const inferredExerciseMetadataSlugs = Array.from(
      new Set(routine.exercises.flatMap((entry) => inferExerciseMetadataSlugs(entry.exercise.name)))
    );

    const [metadataGroups, sessionTemplates, availableSubstituteRoutines, existingSubLinks] = await Promise.all([
      prisma.metadataGroup.findMany({
        where: {
          OR: [
            { appliesToRoutine: true },
            { kind: { in: ROUTINE_METADATA_SELECTABLE_KINDS } },
            ...(inferredExerciseMetadataSlugs.length > 0
              ? [{ slug: { in: inferredExerciseMetadataSlugs } }]
              : []),
          ],
        },
        select: { id: true, slug: true, label: true, kind: true },
        orderBy: [{ kind: "asc" }, { label: "asc" }],
      }),
      prisma.sessionTemplate.findMany({
        where: { isSystem: true },
        select: { id: true, key: true, name: true, description: true, sessionSubtype: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.routine.findMany({
        where: { isActive: true, isDeleted: false, id: { not: id } },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      prisma.frequencyGoalRoutine.findMany({
        where: { goalId: `fg_${id}`, role: "SUBSTITUTE" },
        select: { routineId: true },
      }),
    ]);

    const inferredExerciseMetadataGroupIds = metadataGroups
      .filter((g) => inferredExerciseMetadataSlugs.includes(g.slug))
      .map((g) => g.id);

    return NextResponse.json({
      mode: "edit" as const,
      routine: {
        id: withTarget.id,
        name: withTarget.name,
        subtype: withTarget.subtype,
        domain: withTarget.domain,
        kind: withTarget.kind,
        frequencyGoalEnabled: withTarget.frequencyGoalEnabled ?? false,
        targetFrequencyCount: withTarget.targetFrequencyCount,
        targetFrequencyUnit: withTarget.targetFrequencyUnit,
        targetFrequencyInterval: withTarget.targetFrequencyInterval,
        sessionTemplateId: withTarget.sessionDetails?.templateId ?? null,
        selectedMetadataGroupIds: Array.from(
          new Set([
            ...withTarget.metadataGroups.map((entry) => entry.groupId),
            ...derivedExerciseMetadataGroupIds,
            ...inferredExerciseMetadataGroupIds,
          ])
        ),
        tags: withTarget.tagAssignments.map((entry) => entry.tag.name),
      },
      metadataGroups,
      sessionTemplates,
      availableSubstituteRoutines,
      initialSubstituteRoutineIds: existingSubLinks.map((row) => row.routineId),
    });
  }

  const [metadataGroups, sessionTemplates, availableSubstituteRoutines] = await Promise.all([
    prisma.metadataGroup.findMany({
      where: {
        OR: [{ appliesToRoutine: true }, { kind: { in: ROUTINE_METADATA_SELECTABLE_KINDS } }],
      },
      select: { id: true, slug: true, label: true, kind: true },
      orderBy: [{ kind: "asc" }, { label: "asc" }],
    }),
    prisma.sessionTemplate.findMany({
      where: { isSystem: true },
      select: { id: true, key: true, name: true, description: true, sessionSubtype: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.routine.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  return NextResponse.json({
    mode: "new" as const,
    metadataGroups,
    sessionTemplates,
    availableSubstituteRoutines,
  });
}
