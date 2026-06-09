import type React from "react";
import Link from "next/link";
import HistoryBackButton from "@/app/components/HistoryBackButton";
import {
  exerciseLibraryWhereForKinds,
  isMissingExerciseLibraryKindError,
  withDerivedExerciseLibraryKind,
  workoutLibraryKinds,
} from "@/lib/exercise-library";
import { exerciseUnitLabel } from "@/lib/exercises";
import { prisma } from "@/lib/prisma";
import { moveRoutineExercise, removeRoutineExercise } from "../template/actions";
import ExercisePicker from "../template/ExercisePicker";
import TemplateMetricControl from "../template/TemplateMetricControl";
import DefaultSetsControl from "../template/DefaultSetsControl";
import RoutineInjuryWarningBanner from "@/app/components/injuries/RoutineInjuryWarningBanner";
import { getRoutineInjuryLoadWarning } from "@/lib/injury-warnings";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function RoutineTemplatePage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const routineId = params?.id;

  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
  });

  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (routine.kind !== "WORKOUT") {
    return (
      <div style={{ padding: 20 }}>
        This page is for WORKOUT routines only. <Link href="/log">Back</Link>
      </div>
    );
  }

  const attached = await prisma.routineExercise.findMany({
    where: { routineId },
    orderBy: [{ sortOrder: "asc" }],
    include: { exercise: true },
  });

  const allExercises = await (async () => {
    try {
      return await prisma.exercise.findMany({
        where: exerciseLibraryWhereForKinds(workoutLibraryKinds()),
        orderBy: [{ name: "asc" }],
      });
    } catch (error) {
      if (!isMissingExerciseLibraryKindError(error)) throw error;
      return withDerivedExerciseLibraryKind(
        await prisma.exercise.findMany({
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            name: true,
            unit: true,
            supportsWeight: true,
          },
        })
      ).filter((exercise) => workoutLibraryKinds().includes(exercise.libraryKind));
    }
  })();

  const attachedIds = new Set(attached.map((x) => x.exerciseId));
  const available = allExercises.filter((x) => !attachedIds.has(x.id));
  const injuryWarning = await getRoutineInjuryLoadWarning(routineId);

  return (
    <div className="mobileRoutineTemplatePage" style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      {/* Header */}
      <div className="mobileRoutineTemplateTopRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Template: {routine.name}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>
            Attach exercises and set default sets per exercise.
          </div>
        </div>
        <div className="mobileRoutineTemplateActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/exercises" style={linkBtn}>Exercises</Link>
          <Link href={`/routines/${routineId}/edit`} style={linkBtn}>Edit Routine</Link>
          <HistoryBackButton fallbackHref="/log" label="← Back" style={linkBtn} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <RoutineInjuryWarningBanner warning={injuryWarning} />
      </div>

      {/* Add Exercise */}
      <div style={{ marginTop: 16, border: border, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: bgBar, borderBottom: border }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>ADD EXERCISE</div>
        </div>
        <div style={{ padding: 14 }}>
          <ExercisePicker routineId={routineId} available={available} />
        </div>
      </div>

      {/* Exercise list */}
      <div style={{ marginTop: 16, border: border, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: bgBar, borderBottom: border }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>
            EXERCISES IN THIS ROUTINE
            {attached.length > 0 && (
              <span style={{ fontWeight: 500, opacity: 0.65, marginLeft: 8, fontSize: 12 }}>
                ({attached.length})
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {attached.map((re, i) => (
            <div key={re.id} style={exerciseCard}>
              {/* Order column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                <form action={moveRoutineExercise}>
                  <input type="hidden" name="routineId" value={routineId} />
                  <input type="hidden" name="routineExerciseId" value={re.id} />
                  <input type="hidden" name="dir" value="up" />
                  <button type="submit" style={arrowBtn} title="Move up">↑</button>
                </form>
                <form action={moveRoutineExercise}>
                  <input type="hidden" name="routineId" value={routineId} />
                  <input type="hidden" name="routineExerciseId" value={re.id} />
                  <input type="hidden" name="dir" value="down" />
                  <button type="submit" style={arrowBtn} title="Move down">↓</button>
                </form>
              </div>

              {/* Exercise info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>
                  {i + 1}. {re.exercise.name}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3 }}>
                  {exerciseUnitLabel(re.exercise.unit)}{re.exercise.supportsWeight ? " · Weighted" : ""}
                </div>
              </div>

              {/* Controls */}
              <div className="mobileRoutineTemplateActions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
                <TemplateMetricControl
                  routineId={routineId}
                  routineExerciseId={re.id}
                  initialUnit={re.exercise.unit}
                />
                <DefaultSetsControl
                  routineId={routineId}
                  routineExerciseId={re.id}
                  initialValue={re.defaultSets}
                />
                <form action={removeRoutineExercise}>
                  <input type="hidden" name="routineId" value={routineId} />
                  <input type="hidden" name="routineExerciseId" value={re.id} />
                  <button type="submit" style={removeBtn} title="Remove exercise">✕</button>
                </form>
              </div>
            </div>
          ))}

          {attached.length === 0 && (
            <div style={{ opacity: 0.65, fontSize: 13, padding: "4px 2px" }}>No exercises attached yet. Add one above.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const border = "1px solid rgba(128,128,128,0.35)";
const bgBar = "rgba(128,128,128,0.14)";

const exerciseCard: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 12,
  padding: "10px 12px",
  background: "rgba(128,128,128,0.05)",
};

const arrowBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid rgba(128,128,128,0.45)",
  borderRadius: 7,
  background: "rgba(128,128,128,0.1)",
  color: "inherit",
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
  lineHeight: 1,
};

const removeBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid rgba(220,38,38,0.4)",
  borderRadius: 8,
  background: "rgba(220,38,38,0.08)",
  color: "inherit",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};
