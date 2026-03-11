import { prisma } from "@/lib/prisma";
import { isCompletionKind } from "@/lib/routines";
import EditCompletionLogForm from "./EditCompletionLogForm";

export const dynamic = "force-dynamic";

type Params = { id: string; logId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function EditCompletionLogPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const routineId = params?.id;
  const logId = params?.logId;
  const returnToRaw = String(getParam(searchParams, "returnTo") || "").trim();
  const defaultReturnTo = "/manual-log";
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : defaultReturnTo;
  if (!routineId || !logId) return <div style={{ padding: 20 }}>Missing routine/log id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: { id: true, name: true, category: true, kind: true },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (!isCompletionKind(routine.kind)) return <div style={{ padding: 20 }}>This routine is not a completion routine.</div>;

  const log = await prisma.routineLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      notes: true,
      completionCount: true,
      distanceMi: true,
      durationSec: true,
      location: true,
      guidedSteps: { select: { id: true } },
      metrics: { select: { id: true } },
      exercises: { select: { id: true } },
    },
  });
  if (!log || log.routineId !== routineId) return <div style={{ padding: 20 }}>Log not found for this routine.</div>;
  if (
    log.distanceMi !== null ||
    log.durationSec !== null ||
    log.location !== null ||
    log.exercises.length > 0 ||
    log.guidedSteps.length > 0 ||
    log.metrics.length > 0
  ) {
    return <div style={{ padding: 20 }}>This log is not a completion log.</div>;
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{routine.name} - Edit Completion Log</h1>
      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routine.category}</div>
      <div style={{ marginTop: 16, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "rgba(128,128,128,0.14)", borderBottom: "1px solid rgba(128,128,128,0.25)", fontWeight: 900 }}>
          COMPLETION LOG
        </div>
        <div style={{ padding: 14 }}>
          <EditCompletionLogForm
            routineId={routineId}
            logId={log.id}
            returnTo={returnTo}
            initialCompletionCount={log.completionCount}
            initialNotes={log.notes ?? ""}
            initialPerformedAt={log.performedAt}
          />
        </div>
      </div>
    </div>
  );
}
