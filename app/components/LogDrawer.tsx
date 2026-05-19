"use client";

import { useEffect, useRef, useState } from "react";
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
  const cache = useRef<Map<string, LogData>>(new Map());

  useEffect(() => {
    if (!isOpen || !activeRoutineId) return;
    if (cache.current.has(activeRoutineId)) {
      setLogData(cache.current.get(activeRoutineId)!);
      return;
    }
    setLoading(true);
    setError(null);
    // Quick-log sentinel hits a dedicated endpoint — there is no real
    // routine to fetch yet (the placeholder gets find-or-created on save).
    const url =
      activeRoutineId === QUICK_LOG_ROUTINE_ID
        ? "/api/quick-log-data"
        : `/api/routines/${activeRoutineId}/log-data`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json() as Promise<LogData>;
      })
      .then((data) => {
        cache.current.set(activeRoutineId, data);
        setLogData(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load session.");
        setLoading(false);
      });
  }, [isOpen, activeRoutineId]);

  if (!isOpen || !activeRoutineId) return null;

  function handleComplete() {
    if (activeRoutineId) {
      cache.current.delete(activeRoutineId);
      clearDrawerState(activeRoutineId);
    }
    clearDirty();
    closeDrawer();
  }

  function handleCloseAttempt() {
    closeDrawer();
  }

  return (
    <>
      <div className="logDrawerBackdrop" onClick={handleCloseAttempt} />
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
          {loading && <div style={stateStyle}>Loading session…</div>}
          {error && <div style={{ ...stateStyle, color: "rgba(255,100,100,0.9)" }}>{error}</div>}
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
              return (
                <LogRunForm
                  key={logData.routineId}
                  routineId={logData.routineId}
                  routineName={logData.routineName}
                  activePainZones={logData.activePainZones}
                  activitySlug={logData.activitySlug ?? null}
                  savedSpots={logData.savedSpots ?? []}
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
