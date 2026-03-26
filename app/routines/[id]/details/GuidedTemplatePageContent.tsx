import Link from "next/link";
import {
  guidedPreferredLibraryKinds,
  isMissingExerciseLibraryKindError,
  orderExercisesForLibraryContext,
  withDerivedExerciseLibraryKind,
} from "@/lib/exercise-library";
import { prisma } from "@/lib/prisma";
import { formatRoutineTypeLabel, isGuidedKind } from "@/lib/routines";
import GuidedTemplateEditor from "../guided/GuidedTemplateEditor";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function GuidedTemplatePage(props: { params: Promise<Params> | Params }) {
  const params = await Promise.resolve(props.params);
  const routineId = params?.id;
  if (!routineId) return <div style={{ padding: 20 }}>Missing routine id.</div>;

  const [routine, exercises] = await Promise.all([
    prisma.routine.findUnique({
      where: { id: routineId },
      select: {
        id: true,
        name: true,
        kind: true,
        category: true,
        guidedSteps: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            kind: true,
            title: true,
            durationSec: true,
            restSec: true,
            repeatCount: true,
            repCount: true,
            setCount: true,
            sortOrder: true,
            exerciseId: true,
            exercise: { select: { name: true } },
          },
        },
      },
    }),
    (async () => {
      try {
        return await prisma.exercise.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, unit: true, supportsWeight: true, libraryKind: true },
        });
      } catch (error) {
        if (!isMissingExerciseLibraryKindError(error)) throw error;
        return withDerivedExerciseLibraryKind(
          await prisma.exercise.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true, unit: true, supportsWeight: true },
          })
        );
      }
    })(),
  ]);
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (!isGuidedKind(routine.kind)) return <div style={{ padding: 20 }}>This page is only for guided routines.</div>;

  return (
    <div className="mobileGuidedTemplatePage" style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div
        className="mobileGuidedTemplateTopRow"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
          padding: 18,
          border: "1px solid rgba(128,128,128,0.3)",
          borderRadius: 16,
          background: "linear-gradient(180deg, rgba(128,128,128,0.12), rgba(128,128,128,0.04))",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", opacity: 0.65 }}>
            Guided Flow Builder
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Step Template: {routine.name}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={metaPill}>{routine.category}</span>
            <span style={metaPill}>{formatRoutineTypeLabel(routine.kind)}</span>
            <span style={metaPill}>{routine.guidedSteps.length} items</span>
          </div>
        </div>
        <div className="mobileGuidedTemplateActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/routines/${routineId}/edit`} style={linkBtn}>
            Back To Edit
          </Link>
          <Link href={`/routines/${routineId}/log`} style={linkBtn}>
            Run Guided Flow
          </Link>
        </div>
      </div>

      <GuidedTemplateEditor
        routineId={routineId}
        exercises={orderExercisesForLibraryContext(exercises, guidedPreferredLibraryKinds())}
        steps={routine.guidedSteps.map((step) => ({
          id: step.id,
          kind: step.kind,
          title: step.title,
          durationSec: step.durationSec,
          restSec: step.restSec,
          repeatCount: step.repeatCount,
          repCount: step.repCount,
          setCount: step.setCount,
          sortOrder: step.sortOrder,
          exerciseId: step.exerciseId,
          exerciseName: step.exercise?.name ?? null,
        }))}
      />
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.8)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.12)",
};

const metaPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(128,128,128,0.12)",
  border: "1px solid rgba(128,128,128,0.22)",
  fontSize: 12,
  fontWeight: 800,
};
