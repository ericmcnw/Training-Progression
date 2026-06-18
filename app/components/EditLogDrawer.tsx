"use client";

// Drawer-mounted editor for an existing log. Mirrors the same sheet shell
// the LogDrawer / ViewLogDrawer use (.logDrawerBackdrop + .logDrawerSheet)
// so it inherits the responsive sheet-on-mobile / modal-on-desktop CSS
// for free. Fetches the per-kind edit data from /api/logs/[logId]/edit-data
// and dispatches to the matching EditXxxForm.
//
// Each Edit form was extended with optional onComplete / onCancel callbacks.
// We wire them up here so saving from the drawer closes the drawer +
// refreshes the dashboard, instead of the form's default
// `window.location.href = returnTo` navigation.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditLogDrawer } from "@/app/contexts/EditLogDrawerContext";
import EditRunLogForm from "@/app/routines/[id]/log-cardio/[logId]/EditRunLogForm";
import EditWorkoutLogForm from "@/app/routines/[id]/log/[logId]/EditWorkoutLogForm";
import EditSessionLogForm from "@/app/routines/[id]/log-session/[logId]/EditSessionLogForm";
import EditGuidedLogForm from "@/app/routines/[id]/log-guided/[logId]/EditGuidedLogForm";
import EditCompletionLogForm from "@/app/routines/[id]/log-check/[logId]/EditCompletionLogForm";
import EditSportLogForm from "@/app/routines/[id]/logs/[logId]/details/EditSportLogForm";
import type { LogEditData } from "@/lib/log-edit-data";

// API serializes Date → ISO string. Same shape otherwise, so this type alias
// just substitutes the date fields.
type WireDate<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K];
};
type WireLogEditData =
  | WireDate<Extract<LogEditData, { kind: "WORKOUT" }>>
  | WireDate<Extract<LogEditData, { kind: "CARDIO" }>>
  | WireDate<Extract<LogEditData, { kind: "GUIDED" }>>
  | WireDate<Extract<LogEditData, { kind: "SESSION" }>>
  | WireDate<Extract<LogEditData, { kind: "SPORT" }>>
  | WireDate<Extract<LogEditData, { kind: "COMPLETION" }>>;

type FetchState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: LogEditData };

export default function EditLogDrawer() {
  const { isOpen, activeLogId, title, closeEditDrawer } = useEditLogDrawer();
  if (!isOpen || !activeLogId) return null;
  return (
    <EditLogDrawerInner
      key={activeLogId}
      logId={activeLogId}
      title={title}
      closeEditDrawer={closeEditDrawer}
    />
  );
}

function EditLogDrawerInner({
  logId,
  title,
  closeEditDrawer,
}: {
  logId: string;
  title: string | null;
  closeEditDrawer: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetch(`/api/logs/${encodeURIComponent(logId)}/edit-data`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<WireLogEditData>;
      })
      .then((data) => {
        if (cancelled) return;
        // Hydrate Date fields — the API serialized them as ISO strings.
        setState({ kind: "ready", data: hydrate(data) });
      })
      .catch((err) => {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setState({ kind: "error", message: "Could not load log." });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [logId, retryNonce]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeEditDrawer();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeEditDrawer]);

  function handleComplete() {
    closeEditDrawer();
    router.refresh();
  }

  function handleCancel() {
    closeEditDrawer();
  }

  const headerTitle =
    title ?? (state.kind === "ready" ? state.data.routineName : "Edit log");

  return (
    <>
      <div className="logDrawerBackdrop" onClick={closeEditDrawer} />
      <div className="logDrawerSheet">
        <div style={headerStyle}>
          <span style={drawerTitleStyle}>{headerTitle}</span>
          <button
            type="button"
            onClick={closeEditDrawer}
            style={minimizeBtnStyle}
            aria-label="Minimize edit"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              width={16}
              height={16}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            Minimize
          </button>
        </div>

        <div style={bodyStyle}>
          {state.kind === "loading" && <LoadingSkeleton />}
          {state.kind === "error" && (
            <div style={errorBlock}>
              <div style={{ color: "rgba(255,140,140,0.95)", fontSize: 14, fontWeight: 700 }}>
                {state.message}
              </div>
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                style={retryBtnStyle}
              >
                Retry
              </button>
            </div>
          )}
          {state.kind === "ready" && (
            <FormForKind data={state.data} onComplete={handleComplete} onCancel={handleCancel} />
          )}
        </div>
      </div>
    </>
  );
}

function FormForKind({
  data,
  onComplete,
  onCancel,
}: {
  data: LogEditData;
  onComplete: () => void;
  onCancel: () => void;
}) {
  // returnTo is a fallback only — the drawer always intercepts via
  // onComplete / onCancel. Pointing at "/" keeps the address bar sensible
  // if anything unexpected falls through to window.location nav.
  const returnTo = "/";

  if (data.kind === "WORKOUT") {
    return (
      <EditWorkoutLogForm
        routineId={data.routineId}
        logId={data.logId}
        returnTo={returnTo}
        initialNotes={data.initialNotes}
        initialPerformedAt={data.initialPerformedAt}
        initialExercises={data.initialExercises}
        availableExercises={data.availableExercises}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }
  if (data.kind === "CARDIO") {
    return (
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
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }
  if (data.kind === "GUIDED") {
    return (
      <EditGuidedLogForm
        routineId={data.routineId}
        logId={data.logId}
        returnTo={returnTo}
        initialDurationSec={data.initialDurationSec}
        initialNotes={data.initialNotes}
        initialPerformedAt={data.initialPerformedAt}
        availableExercises={data.availableExercises}
        steps={data.steps}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }
  if (data.kind === "SESSION") {
    return (
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
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }
  if (data.kind === "SPORT") {
    return (
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
        returnTo={returnTo}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }
  return (
    <EditCompletionLogForm
      routineId={data.routineId}
      logId={data.logId}
      returnTo={returnTo}
      initialCompletionCount={data.initialCompletionCount}
      initialNotes={data.initialNotes}
      initialPerformedAt={data.initialPerformedAt}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}

function hydrate(data: WireLogEditData): LogEditData {
  return {
    ...data,
    initialPerformedAt: new Date(data.initialPerformedAt as unknown as string),
  } as LogEditData;
}

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
      <div className="skeleton" style={{ height: 22, width: "55%" }} />
      <div className="skeleton" style={{ height: 44 }} />
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 44, width: "40%", marginTop: 4 }} />
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0 16px",
  height: 52,
  borderBottom: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.03)",
  flexShrink: 0,
};

const drawerTitleStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const minimizeBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 12px",
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  color: "rgba(255,255,255,0.7)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 0,
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 16,
  paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
};

const errorBlock: React.CSSProperties = {
  padding: "32px 16px",
  textAlign: "center",
  display: "grid",
  gap: 14,
  justifyItems: "center",
};

const retryBtnStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "8px 18px",
  border: "1px solid rgba(129,140,248,0.5)",
  borderRadius: 10,
  background: "rgba(129,140,248,0.12)",
  color: "rgb(199,210,254)",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};
