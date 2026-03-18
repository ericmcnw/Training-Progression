import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isGuidedKind } from "@/lib/routines";
import GuidedTemplateEditor from "./GuidedTemplateEditor";

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
            sortOrder: true,
            exerciseId: true,
            exercise: { select: { name: true } },
          },
        },
      },
    }),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true, supportsWeight: true },
    }),
  ]);
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (!isGuidedKind(routine.kind)) return <div style={{ padding: 20 }}>This page is for GUIDED routines only.</div>;

  return (
    <div className="mobileGuidedTemplatePage" style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <div className="mobileGuidedTemplateTopRow" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Guided Flow Template: {routine.name}</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routine.category}</div>
        </div>
        <div className="mobileGuidedTemplateActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/routines/${routineId}/edit`} style={linkBtn}>
            Back To Edit
          </Link>
          <Link href={`/routines/${routineId}/log-guided`} style={linkBtn}>
            Run Guided Flow
          </Link>
        </div>
      </div>

      <GuidedTemplateEditor
        routineId={routineId}
        exercises={exercises}
        steps={routine.guidedSteps.map((step) => ({
          id: step.id,
          kind: step.kind,
          title: step.title,
          durationSec: step.durationSec,
          restSec: step.restSec,
          repeatCount: step.repeatCount,
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
