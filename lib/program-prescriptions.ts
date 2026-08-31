import { getAppSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PrescriptionShape } from "@/lib/prescription";

export type ProgramPlanRef = {
  programId?: string | null;
  blockItemId?: string | null;
  plannedSessionId?: string | null;
};

export type ResolvedProgramWorkoutContext = {
  programId: string;
  stageId: string | null;
  blockItemId: string | null;
  plannedSessionId: string | null;
  weekNumber: number;
  prescriptionsByExerciseId: Map<string, PrescriptionShape>;
  snapshot: {
    version: 1;
    ymd: string;
    weekNumber: number;
    exercises: Array<{
      routineExerciseId: string;
      exerciseId: string;
      prescription: PrescriptionShape;
    }>;
  };
};

const PRESCRIPTION_FIELDS = {
  sets: true,
  repsMin: true,
  repsMax: true,
  seconds: true,
  load: true,
  loadUnit: true,
  tempo: true,
  restSec: true,
  cue: true,
} as const;

/**
 * Resolve the exact targets a Program contributes to a workout. Routine
 * defaults are the base; block-item week 0 and the matching week override
 * only the fields they define. ProgramBlock remains an internal compatibility
 * layer while the UI presents its items directly as current-phase work.
 */
export async function resolveProgramWorkoutContext(
  routineId: string,
  ymd: string,
  ref: ProgramPlanRef,
): Promise<ResolvedProgramWorkoutContext | null> {
  const requested = Boolean(ref.programId || ref.blockItemId || ref.plannedSessionId);
  if (!requested) return null;

  const session = await getAppSession();
  const planned = ref.plannedSessionId
    ? await prisma.plannedSession.findFirst({
        where: {
          id: ref.plannedSessionId,
          routineId,
          program: { profileKey: session.profileKey },
        },
        select: { id: true, programId: true, blockItemId: true, currentYmd: true },
      })
    : null;
  if (ref.plannedSessionId && !planned) throw new Error("This planned session is no longer available.");

  const programId = planned?.programId ?? ref.programId ?? null;
  const blockItemId = planned?.blockItemId ?? ref.blockItemId ?? null;
  if (!programId) throw new Error("Program context is incomplete.");

  const [program, routineExercises, item] = await Promise.all([
    prisma.focus.findFirst({
      where: { id: programId, profileKey: session.profileKey },
      select: { id: true, routineLinks: { where: { routineId }, select: { id: true } } },
    }),
    prisma.routineExercise.findMany({
      where: { routineId },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        exerciseId: true,
        prescription: { select: PRESCRIPTION_FIELDS },
      },
    }),
    blockItemId
      ? prisma.programBlockItem.findFirst({
          where: { id: blockItemId, routineId, block: { programId } },
          select: {
            id: true,
            block: { select: { stageId: true, startYmd: true } },
            prescriptions: {
              orderBy: { weekNumber: "asc" },
              select: {
                weekNumber: true,
                routineExerciseId: true,
                sets: true,
                repsMin: true,
                repsMax: true,
                seconds: true,
                loadValue: true,
                loadUnit: true,
                tempo: true,
                restSec: true,
                cue: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!program) throw new Error("Program not found.");
  if (blockItemId && !item) throw new Error("This Program work item is no longer available.");
  if (!blockItemId && program.routineLinks.length === 0) {
    throw new Error("This routine is no longer connected to the Program.");
  }

  const effectiveYmd = planned?.currentYmd ?? ymd;
  const weekNumber = item?.block.startYmd
    ? Math.max(1, Math.floor((ymdDayNumber(effectiveYmd) - ymdDayNumber(item.block.startYmd)) / 7) + 1)
    : 0;
  const prescriptionsByRoutineExerciseId = new Map<string, PrescriptionShape>();

  for (const exercise of routineExercises) {
    prescriptionsByRoutineExerciseId.set(exercise.id, toPrescription(exercise.prescription));
  }
  for (const override of item?.prescriptions.filter((row) => row.weekNumber === 0) ?? []) {
    const base = prescriptionsByRoutineExerciseId.get(override.routineExerciseId);
    if (base) prescriptionsByRoutineExerciseId.set(override.routineExerciseId, mergePrescription(base, override));
  }
  if (weekNumber > 0) {
    for (const override of item?.prescriptions.filter((row) => row.weekNumber === weekNumber) ?? []) {
      const base = prescriptionsByRoutineExerciseId.get(override.routineExerciseId);
      if (base) prescriptionsByRoutineExerciseId.set(override.routineExerciseId, mergePrescription(base, override));
    }
  }

  const exercises = routineExercises.map((exercise) => ({
    routineExerciseId: exercise.id,
    exerciseId: exercise.exerciseId,
    prescription: prescriptionsByRoutineExerciseId.get(exercise.id)!,
  }));

  return {
    programId,
    stageId: item?.block.stageId ?? null,
    blockItemId: item?.id ?? null,
    plannedSessionId: planned?.id ?? null,
    weekNumber,
    prescriptionsByExerciseId: new Map(exercises.map((exercise) => [exercise.exerciseId, exercise.prescription])),
    snapshot: { version: 1, ymd: effectiveYmd, weekNumber, exercises },
  };
}

function toPrescription(value: {
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  seconds: number | null;
  load: number | null;
  loadUnit: PrescriptionShape["loadUnit"];
  tempo: string | null;
  restSec: number | null;
  cue: string | null;
} | null): PrescriptionShape {
  return value ?? {
    sets: null,
    repsMin: null,
    repsMax: null,
    seconds: null,
    load: null,
    loadUnit: "LB",
    tempo: null,
    restSec: null,
    cue: null,
  };
}

function mergePrescription(
  base: PrescriptionShape,
  override: {
    sets: number | null;
    repsMin: number | null;
    repsMax: number | null;
    seconds: number | null;
    loadValue: number | null;
    loadUnit: PrescriptionShape["loadUnit"] | null;
    tempo: string | null;
    restSec: number | null;
    cue: string | null;
  },
): PrescriptionShape {
  return {
    sets: override.sets ?? base.sets,
    repsMin: override.repsMin ?? base.repsMin,
    repsMax: override.repsMax ?? base.repsMax,
    seconds: override.seconds ?? base.seconds,
    load: override.loadValue ?? base.load,
    loadUnit: override.loadUnit ?? base.loadUnit,
    tempo: override.tempo ?? base.tempo,
    restSec: override.restSec ?? base.restSec,
    cue: override.cue ?? base.cue,
  };
}

function ymdDayNumber(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}
