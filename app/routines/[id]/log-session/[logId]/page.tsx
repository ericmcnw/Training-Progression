import { prisma } from "@/lib/prisma";
import { isSessionKind } from "@/lib/routines";
import type { Prisma } from "@/generated/prisma";
import { withSessionMetricConfig } from "@/lib/session-templates";
import EditSessionLogForm from "./EditSessionLogForm";

export const dynamic = "force-dynamic";

type Params = { id: string; logId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function preferredClimbingGrades(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const raw = (value as Record<string, unknown>).preferredClimbingGrades;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export default async function EditSessionLogPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const routineId = params?.id;
  const logId = params?.logId;
  const returnToRaw = String(getParam(searchParams, "returnTo") || "").trim();
  const defaultReturnTo = `/routines/${routineId}/log-session`;
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : defaultReturnTo;
  if (!routineId || !logId) return <div style={{ padding: 20 }}>Missing routine/log id.</div>;

  const routine = await prisma.routine.findUnique({
    where: { id: routineId },
    select: {
      name: true,
      category: true,
      kind: true,
      sessionDetails: {
        select: {
          templateConfig: true,
          template: {
            include: {
              metricDefinitions: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!routine) return <div style={{ padding: 20 }}>Routine not found.</div>;
  if (!isSessionKind(routine.kind)) return <div style={{ padding: 20 }}>This routine is not a session routine.</div>;

  const log = await prisma.routineLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      routineId: true,
      performedAt: true,
      durationSec: true,
      location: true,
      notes: true,
      sessionMetricValues: {
        include: {
          metricDefinition: true,
        },
      },
    },
  });
  if (!log || log.routineId !== routineId) return <div style={{ padding: 20 }}>Log not found for this routine.</div>;
  const definitions = routine.sessionDetails?.template?.metricDefinitions.map(withSessionMetricConfig) ?? [];
  const currentClimbingGrades = Array.from(
    new Set(
      log.sessionMetricValues
        .map((value) => withSessionMetricConfig(value.metricDefinition).config?.gradeBucket)
        .filter((value): value is string => Boolean(value))
    )
  );
  const initialValues = Object.fromEntries(
    log.sessionMetricValues.map((value) => [
      value.metricDefinitionId,
      {
        numberValue: value.numberValue !== null && value.numberValue !== undefined ? String(value.numberValue) : undefined,
        textValue: value.textValue ?? undefined,
        booleanValue: value.booleanValue ?? undefined,
      },
    ])
  );

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{routine.name} - Edit Session Log</h1>
      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{routine.category}</div>
      <div style={{ marginTop: 16, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "rgba(128,128,128,0.14)", borderBottom: "1px solid rgba(128,128,128,0.25)", fontWeight: 900 }}>
          SESSION LOG
        </div>
        <div style={{ padding: 14 }}>
          <EditSessionLogForm
            routineId={routineId}
            logId={log.id}
            returnTo={returnTo}
            initialDurationSec={log.durationSec ?? 0}
            initialLocation={log.location ?? ""}
            initialNotes={log.notes ?? ""}
            initialPerformedAt={log.performedAt}
            templateKey={routine.sessionDetails?.template?.key ?? null}
            templateName={routine.sessionDetails?.template?.name ?? null}
            definitions={definitions}
            initialValues={initialValues}
            preferredClimbingGrades={currentClimbingGrades.length > 0 ? currentClimbingGrades : preferredClimbingGrades(routine.sessionDetails?.templateConfig)}
          />
        </div>
      </div>
    </div>
  );
}
