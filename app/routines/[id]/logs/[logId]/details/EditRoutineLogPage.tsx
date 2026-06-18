import { getLogEditData } from "@/lib/log-edit-data";
import EditWorkoutLogForm from "../../../log/[logId]/EditWorkoutLogForm";
import EditRunLogForm from "../../../log-cardio/[logId]/EditRunLogForm";
import EditGuidedLogForm from "../../../log-guided/[logId]/EditGuidedLogForm";
import EditSessionLogForm from "../../../log-session/[logId]/EditSessionLogForm";
import EditCompletionLogForm from "../../../log-check/[logId]/EditCompletionLogForm";
import EditSportLogForm from "./EditSportLogForm";

export const dynamic = "force-dynamic";

type Params = { id: string; logId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function EditRoutineLogPage(props: {
  params: Promise<Params> | Params;
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = await Promise.resolve(props.params);
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const routineId = params?.id;
  const logId = params?.logId;
  const returnToRaw = String(getParam(searchParams, "returnTo") || "").trim();
  const defaultReturnTo = `/routines/${routineId}/log`;
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : defaultReturnTo;
  if (!routineId || !logId) return <div style={{ padding: 20 }}>Missing routine/log id.</div>;

  const data = await getLogEditData(logId);
  if (!data || data.routineId !== routineId) {
    return <div style={{ padding: 20 }}>Log not found for this routine.</div>;
  }

  const kindLabel =
    data.kind === "WORKOUT" ? "Workout"
    : data.kind === "CARDIO" ? "Cardio"
    : data.kind === "GUIDED" ? "Guided"
    : data.kind === "SESSION" ? "Session"
    : data.kind === "SPORT" ? "Sport"
    : "Completion";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
        {data.routineName} - Edit {kindLabel} Log
      </h1>
      <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>{data.routineName}</div>
      <div style={{ marginTop: 16, border: "1px solid rgba(128,128,128,0.35)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", background: "rgba(128,128,128,0.14)", borderBottom: "1px solid rgba(128,128,128,0.25)", fontWeight: 900 }}>
          {kindLabel.toUpperCase()} LOG
        </div>
        <div style={{ padding: 14 }}>
          {data.kind === "WORKOUT" ? (
            <EditWorkoutLogForm
              routineId={data.routineId}
              logId={data.logId}
              returnTo={returnTo}
              initialNotes={data.initialNotes}
              initialPerformedAt={data.initialPerformedAt}
              initialExercises={data.initialExercises}
              availableExercises={data.availableExercises}
            />
          ) : data.kind === "CARDIO" ? (
            <EditRunLogForm
              routineId={data.routineId}
              logId={data.logId}
              returnTo={returnTo}
              initialDistanceMi={data.initialDistanceMi}
              initialElevationGainFt={data.initialElevationGainFt}
              initialDurationSec={data.initialDurationSec}
              initialNotes={data.initialNotes}
              initialPerformedAt={data.initialPerformedAt}
              activitySlug={data.activitySlug}
              savedSpots={data.savedSpots}
              initialSpot={data.initialSpot}
              availableActivityTypes={data.availableActivityTypes}
              initialActivityTypeId={data.initialActivityTypeId}
              initialIntervals={data.initialIntervals}
              initialEffort={data.initialEffort}
            />
          ) : data.kind === "GUIDED" ? (
            <EditGuidedLogForm
              routineId={data.routineId}
              logId={data.logId}
              returnTo={returnTo}
              initialDurationSec={data.initialDurationSec}
              initialNotes={data.initialNotes}
              initialPerformedAt={data.initialPerformedAt}
              availableExercises={data.availableExercises}
              steps={data.steps}
            />
          ) : data.kind === "SESSION" ? (
            <EditSessionLogForm
              routineId={data.routineId}
              logId={data.logId}
              returnTo={returnTo}
              initialDurationSec={data.initialDurationSec}
              initialNotes={data.initialNotes}
              initialPerformedAt={data.initialPerformedAt}
              templateKey={data.templateKey}
              templateName={data.templateName}
              definitions={data.definitions}
              initialValues={data.initialValues}
              preferredClimbingGrades={data.preferredClimbingGrades}
              activitySlug={data.activitySlug}
              savedSpots={data.savedSpots}
              savedClimbLocations={data.savedClimbLocations}
              initialSpot={data.initialSpot}
              initialClimbAttempts={data.initialClimbAttempts}
              climbDefaultDiscipline={data.climbDefaultDiscipline}
              initialEffort={data.initialEffort}
            />
          ) : data.kind === "SPORT" ? (
            <EditSportLogForm
              routineId={data.routineId}
              logId={data.logId}
              sportSlug={data.sportSlug}
              initialPerformedAt={data.initialPerformedAt}
              initialDurationSec={data.initialDurationSec}
              initialNotes={data.initialNotes}
              initialSpot={data.initialSpot}
              savedSpots={data.savedSpots}
              activitySlug={data.activitySlug}
              sportData={data.sportData}
              initialEffort={data.initialEffort}
              returnTo={returnTo}
            />
          ) : (
            <EditCompletionLogForm
              routineId={data.routineId}
              logId={data.logId}
              returnTo={returnTo}
              initialCompletionCount={data.initialCompletionCount}
              initialNotes={data.initialNotes}
              initialPerformedAt={data.initialPerformedAt}
            />
          )}
        </div>
      </div>
    </div>
  );
}
