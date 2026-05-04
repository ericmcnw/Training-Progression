"use client";

import { useEffect, useRef, useState } from "react";
import { useLogDrawer } from "@/app/contexts/LogDrawerContext";
import LogWorkoutForm from "@/app/routines/[id]/log/ui";
import SessionLogForm from "@/app/routines/[id]/log-session/SessionLogForm";
import LogRunForm from "@/app/routines/[id]/log-cardio/ui";
import GuidedLogForm from "@/app/routines/[id]/log-guided/GuidedLogForm";
import type { WorkoutBlock, ExerciseOption } from "@/app/routines/[id]/log/WorkoutExerciseEditor";
import type { PainCheckZone } from "@/app/components/pain-log/PostSessionPainCheck";
import type { SessionMetricDefinitionWithConfig } from "@/lib/session-templates";
import type { GuidedStepKind } from "@/generated/prisma";
import type { ClimbLocationBasic } from "@/lib/climb-types";

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
};

type CardioLogData = {
  kind: "CARDIO";
  routineId: string;
  routineName: string;
  activePainZones: PainCheckZone[];
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

type LogData = WorkoutLogData | SessionLogData | CardioLogData | GuidedLogData;

export default function LogDrawer() {
  const { isOpen, activeRoutineId, closeDrawer, isDirty, clearDirty } = useLogDrawer();
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
    fetch(`/api/routines/${activeRoutineId}/log-data`)
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
        setError("Could not load session. Tap the chip to open the full page.");
        setLoading(false);
      });
  }, [isOpen, activeRoutineId]);

  if (!isOpen || !activeRoutineId) return null;

  function handleComplete() {
    if (activeRoutineId) cache.current.delete(activeRoutineId);
    clearDirty();
    closeDrawer();
  }

  function handleCloseAttempt() {
    if (isDirty && !confirm("Close without saving your changes?")) return;
    closeDrawer();
  }

  return (
    <>
      <div className="logDrawerBackdrop" onClick={handleCloseAttempt} />
      <div className="logDrawerSheet">
        <div style={drawerHeaderStyle}>
          <span style={drawerTitleStyle}>{logData?.routineName ?? " "}</span>
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
          {!loading && !error && logData && (
            logData.kind === "WORKOUT" ? (
              <LogWorkoutForm
                key={logData.routineId}
                routineId={logData.routineId}
                routineName={logData.routineName}
                initialBlocks={logData.initialBlocks}
                availableExercises={logData.availableExercises}
                activePainZones={logData.activePainZones}
                onComplete={handleComplete}
                onBack={closeDrawer}
              />
            ) : logData.kind === "SESSION" ? (
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
                onComplete={handleComplete}
                onBack={closeDrawer}
              />
            ) : logData.kind === "CARDIO" ? (
              <LogRunForm
                key={logData.routineId}
                routineId={logData.routineId}
                routineName={logData.routineName}
                activePainZones={logData.activePainZones}
                onComplete={handleComplete}
                onBack={closeDrawer}
              />
            ) : logData.kind === "GUIDED" ? (
              <GuidedLogForm
                key={logData.routineId}
                routineId={logData.routineId}
                routineName={logData.routineName}
                steps={logData.steps}
                availableExercises={[]}
                activePainZones={logData.activePainZones}
                onComplete={handleComplete}
                onBack={closeDrawer}
              />
            ) : null
          )}
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
