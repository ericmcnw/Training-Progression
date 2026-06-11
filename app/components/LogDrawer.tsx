"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import LogWorkoutForm from "@/app/routines/[id]/log/ui";
import SessionLogForm from "@/app/routines/[id]/log-session/SessionLogForm";
import LogRunForm from "@/app/routines/[id]/log-cardio/ui";
import GuidedLogForm from "@/app/routines/[id]/log-guided/GuidedLogForm";
import QuickWorkoutLogForm from "@/app/routines/log-workout-quick/QuickWorkoutLogForm";
import { localDateTimeForYmd } from "@/app/routines/[id]/log/date-helpers";
import type { WorkoutBlock, ExerciseOption } from "@/app/routines/[id]/log/WorkoutExerciseEditor";
import type { PainCheckZone } from "@/app/components/log/InlinePainCheck";
import type { SessionMetricDefinitionWithConfig } from "@/lib/session-templates";
import type { GuidedStepKind } from "@/generated/prisma";
import type { ClimbLocationBasic } from "@/lib/climb-types";
import type { SpotPickerItem } from "@/lib/activity-spots";
import type { QuickLogDomain } from "@/lib/quick-log";

// Sentinel routine id for the ad-hoc quick-workout flow. No real routine
// exists until the user saves — the placeholder is find-or-created server-
// side in `logAdHocWorkout`. We piggyback on the drawer's id-keyed cache
// using this constant.
export const QUICK_LOG_ROUTINE_ID = "quick-log";

type WorkoutLogData = {
  kind: "WORKOUT";
  routineId: string;
  routineName: string;
  initialBlocks: WorkoutBlock[];
  availableExercises: ExerciseOption[];
  activePainZones: PainCheckZone[];
};

type SessionLogData = {
  kind: "SESSION";
  routineId: string;
  routineName: string;
  templateKey: string | null;
  templateName: string | null;
  definitions: SessionMetricDefinitionWithConfig[];
  preferredClimbingGrades: string[];
  activePainZones: PainCheckZone[];
  savedClimbLocations?: ClimbLocationBasic[];
  activitySlug?: string | null;
  savedSpots?: SpotPickerItem[];
  availableZones?: Array<{ slug: string; label: string }>;
  defaultZoneSlugs?: string[];
};

type CardioLogData = {
  kind: "CARDIO";
  routineId: string;
  routineName: string;
  activePainZones: PainCheckZone[];
  activitySlug?: string | null;
  savedSpots?: SpotPickerItem[];
  // Endurance type model — present for every CARDIO routine. The synthetic
  // Endurance routine has no preselected type (user must pick); legacy
  // routines preselect from their migrated activityTypeId.
  activityTypes?: ActivityTypeOption[];
  initialActivityTypeId?: string | null;
  routineIsSynthetic?: boolean;
};

export type ActivityTypeOption = {
  id: string;
  slug: string;
  name: string;
  familyId: string;
  familyName: string;
  familySortOrder: number;
  sortOrder: number;
  hasDistance: boolean;
  hasElevation: boolean;
  hasPace: boolean;
  /** When true the cardio form surfaces the structured interval block
   *  (reps, work distance, work time, rest). Set on Interval Run and
   *  Sprint by default; flag-driven so adding future structured types
   *  (hill repeats, swim sets, …) doesn't require form changes. */
  usesIntervals: boolean;
};

type GuidedStep = {
  id: string;
  kind: GuidedStepKind;
  title: string;
  exerciseId: string | null;
  exerciseName: string | null;
  durationSec: number | null;
  restSec: number | null;
  repeatCount: number;
  repCount?: number | null;
  setCount?: number | null;
  sortOrder: number;
};

type GuidedLogData = {
  kind: "GUIDED";
  routineId: string;
  routineName: string;
  steps: GuidedStep[];
  activePainZones: PainCheckZone[];
};

type QuickLogData = {
  kind: "QUICK";
  availableExercises: ExerciseOption[];
  initialBlocks: WorkoutBlock[];
  initialDomain: QuickLogDomain;
  initialSubtype: string;
  domainOptions: ReadonlyArray<{ value: QuickLogDomain; label: string; description: string }>;
  subtypeOptions: ReadonlyArray<{ value: string; label: string }>;
};

type LogData = WorkoutLogData | SessionLogData | CardioLogData | GuidedLogData | QuickLogData;
type WorkoutDrawerState = { expandedId: string | null };
type GuidedDrawerState = {
  screen: "entry" | "player" | "review";
  autoPlay: boolean;
  currentSegmentIndex: number;
  completedDurationSec: number;
  skippedStepIds: string[];
  reviewMode: "review" | "log-after";
};

export default function LogDrawer() {
  const {
    isOpen,
    isDirty,
    activeRoutineId,
    closeDrawer,
    clearDirty,
    getDrawerState,
    setDrawerState,
    clearDrawerState,
    getDefaultDate,
  } = useLogDrawer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logData, setLogData] = useState<LogData | null>(null);
  // Bumped via the Retry button — re-running the load effect by invalidating
  // its dep list is simpler than refactoring into an imperative loader.
  const [retryNonce, setRetryNonce] = useState(0);
  const cache = useRef<Map<string, LogData>>(new Map());

  useEffect(() => {
    if (!isOpen || !activeRoutineId) return;
    if (cache.current.has(activeRoutineId)) {
      setLogData(cache.current.get(activeRoutineId)!);
      return;
    }
    setLoading(true);
    setError(null);

    const requestedRoutineId = activeRoutineId;
    const controller = new AbortController();
    let cancelled = false;

    // Quick-log sentinel hits a dedicated endpoint — there is no real
    // routine to fetch yet (the placeholder gets find-or-created on save).
    const url =
      requestedRoutineId === QUICK_LOG_ROUTINE_ID
        ? "/api/quick-log-data"
        : `/api/routines/${requestedRoutineId}/log-data`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<LogData>;
      })
      .then((data) => {
        if (cancelled) return;
        cache.current.set(requestedRoutineId, data);
        setLogData(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setError("Could not load session.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, activeRoutineId, retryNonce]);

  const retry = useCallback(() => setRetryNonce((n) => n + 1), []);

  if (!isOpen || !activeRoutineId) return null;

  function handleComplete() {
    if (activeRoutineId) {
      cache.current.delete(activeRoutineId);
      clearDrawerState(activeRoutineId);
    }
    clearDirty();
    closeDrawer();
  }

  // Backdrop tap shouldn't silently discard an in-progress session. For
  // routine-backed logs the draft auto-persists (WorkoutExerciseEditor
  // writes to localStorage) so minimizing is safe — confirm only when
  // the form has unsaved data without a draft fallback (quick-log mode,
  // which currently doesn't persist drafts).
  function handleBackdropClose() {
    const isQuickLog = activeRoutineId === QUICK_LOG_ROUTINE_ID;
    if (isDirty && isQuickLog) {
      const ok = window.confirm("Discard this quick workout? Unsaved sets will be lost.");
      if (!ok) return;
    }
    closeDrawer();
  }

  function handleCloseAttempt() {
    closeDrawer();
  }

  return (
    <>
      <div className="logDrawerBackdrop" onClick={handleBackdropClose} />
      <div className="logDrawerSheet">
        <div style={drawerHeaderStyle}>
          <span style={drawerTitleStyle}>{drawerTitle(logData)}</span>
          <button type="button" onClick={handleCloseAttempt} style={minimizeBtnStyle} aria-label="Minimize log">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
              <path d="M6 9l6 6 6-6" />
            </svg>
            Minimize
          </button>
        </div>

        <div style={drawerBodyStyle}>
          {loading && <LoadingSkeleton />}
          {error && (
            <div style={errorBlockStyle}>
              <div style={{ color: "rgba(255,140,140,0.95)", fontSize: 14, fontWeight: 700 }}>
                {error}
              </div>
              <button type="button" onClick={retry} style={retryBtnStyle}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && logData && (() => {
            if (logData.kind === "QUICK") {
              return (
                <QuickWorkoutLogForm
                  key={QUICK_LOG_ROUTINE_ID}
                  availableExercises={logData.availableExercises}
                  initialBlocks={logData.initialBlocks}
                  initialDomain={logData.initialDomain}
                  initialSubtype={logData.initialSubtype}
                  domainOptions={logData.domainOptions}
                  subtypeOptions={logData.subtypeOptions}
                  onComplete={handleComplete}
                  onBack={closeDrawer}
                />
              );
            }
            const dateYmd = getDefaultDate(logData.routineId);
            const defaultPerformedAtLocal = dateYmd ? localDateTimeForYmd(dateYmd, 12) : undefined;
            if (logData.kind === "WORKOUT") {
              return (
                <LogWorkoutForm
                  key={logData.routineId}
                  routineId={logData.routineId}
                  routineName={logData.routineName}
                  initialBlocks={logData.initialBlocks}
                  availableExercises={logData.availableExercises}
                  activePainZones={logData.activePainZones}
                  initialExpandedId={getDrawerState<WorkoutDrawerState>(logData.routineId)?.expandedId ?? null}
                  onExpandedIdChange={(expandedId) => {
                    setDrawerState<WorkoutDrawerState>(logData.routineId, { expandedId });
                  }}
                  defaultPerformedAtLocal={defaultPerformedAtLocal}
                  onComplete={handleComplete}
                  onBack={closeDrawer}
                />
              );
            }
            if (logData.kind === "SESSION") {
              return (
                <SessionLogForm
                  key={logData.routineId}
                  routineId={logData.routineId}
                  routineName={logData.routineName}
                  templateKey={logData.templateKey}
                  templateName={logData.templateName}
                  definitions={logData.definitions}
                  preferredClimbingGrades={logData.preferredClimbingGrades}
                  activePainZones={logData.activePainZones}
                  savedClimbLocations={logData.savedClimbLocations ?? []}
                  activitySlug={logData.activitySlug ?? null}
                  savedSpots={logData.savedSpots ?? []}
                  availableZones={logData.availableZones ?? []}
                  defaultZoneSlugs={logData.defaultZoneSlugs ?? []}
                  defaultPerformedAtLocal={defaultPerformedAtLocal}
                  onComplete={handleComplete}
                  onBack={closeDrawer}
                />
              );
            }
            if (logData.kind === "CARDIO") {
              // Type-pill shortcuts (home FAB, schedule picker) stash the
              // tapped activity type in drawer state before opening — it
              // wins over the routine's own initial type so "Trail Run"
              // opens a form already set to Trail Run.
              const presetTypeId = getDrawerState<{ presetActivityTypeId?: string }>(logData.routineId)
                ?.presetActivityTypeId;
              return (
                <LogRunForm
                  // presetTypeId in the key so tapping a DIFFERENT type pill
                  // remounts the form with the new initial type (same
                  // routineId otherwise keeps the old mount's state).
                  key={`${logData.routineId}::${presetTypeId ?? ""}`}
                  routineId={logData.routineId}
                  routineName={logData.routineName}
                  activePainZones={logData.activePainZones}
                  activitySlug={logData.activitySlug ?? null}
                  savedSpots={logData.savedSpots ?? []}
                  activityTypes={logData.activityTypes ?? []}
                  initialActivityTypeId={presetTypeId ?? logData.initialActivityTypeId ?? null}
                  routineIsSynthetic={logData.routineIsSynthetic ?? false}
                  defaultPerformedAtLocal={defaultPerformedAtLocal}
                  onComplete={handleComplete}
                  onBack={closeDrawer}
                />
              );
            }
            if (logData.kind === "GUIDED") {
              return (
                <GuidedLogForm
                  key={logData.routineId}
                  routineId={logData.routineId}
                  routineName={logData.routineName}
                  steps={logData.steps}
                  availableExercises={[]}
                  activePainZones={logData.activePainZones}
                  initialDrawerState={getDrawerState<GuidedDrawerState>(logData.routineId)}
                  onDrawerStateChange={(state) => {
                    setDrawerState<GuidedDrawerState>(logData.routineId, state);
                  }}
                  defaultPerformedAtLocal={defaultPerformedAtLocal}
                  onComplete={handleComplete}
                  onBack={closeDrawer}
                />
              );
            }
            return null;
          })()}
        </div>
      </div>
    </>
  );
}

const drawerHeaderStyle: React.CSSProperties = {
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

const drawerBodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px",
  paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
};

const stateStyle: React.CSSProperties = {
  padding: "40px 0",
  textAlign: "center",
  opacity: 0.65,
  fontSize: 14,
};

function drawerTitle(logData: LogData | null): string {
  if (!logData) return " ";
  if (logData.kind === "QUICK") return "Quick Workout";
  return logData.routineName;
}

// Pulsing skeleton that roughly matches the shape of a log form so the
// drawer never shows a blank frame while the API is in flight. Uses the
// shared `.skeleton` class from globals.css for the shimmer animation.
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

const errorBlockStyle: React.CSSProperties = {
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
