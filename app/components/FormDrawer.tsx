"use client";

import { useEffect, useState } from "react";
import { useFormDrawer } from "@/app/contexts/FormDrawerContext";
import NewRoutineForm from "@/app/routines/new/NewRoutineForm";
import EditRoutineForm from "@/app/routines/[id]/edit/EditRoutineForm";
import GoalForm, { type GoalFormInitial } from "@/app/goals/GoalForm";
import { createGoal, updateGoal } from "@/app/goals/actions";
import { createFrequencyGoal, updateFrequencyGoal } from "@/app/routines/actions";
import type { GoalFormOptions } from "@/lib/goals";
import type { MetadataGroupKind, RoutineFrequencyUnit, RoutineKind } from "@/generated/prisma";

type RoutineFormData =
  | {
      mode: "new";
      metadataGroups: Array<{ id: string; slug: string; label: string; kind: MetadataGroupKind }>;
      sessionTemplates: Array<{
        id: string;
        key: string;
        name: string;
        description: string | null;
        sessionSubtype: string | null;
      }>;
      availableSubstituteRoutines: Array<{ id: string; name: string }>;
    }
  | {
      mode: "edit";
      routine: {
        id: string;
        name: string;
        subtype: string | null;
        domain: string;
        kind: RoutineKind;
        targetFrequencyCount: number | null;
        targetFrequencyUnit: RoutineFrequencyUnit | null;
        targetFrequencyInterval: number | null;
        frequencyGoalEnabled: boolean;
        sessionTemplateId: string | null;
        selectedMetadataGroupIds: string[];
        tags: string[];
      };
      metadataGroups: Array<{ id: string; slug: string; label: string; kind: MetadataGroupKind }>;
      sessionTemplates: Array<{
        id: string;
        name: string;
        description: string | null;
        sessionSubtype: string | null;
      }>;
      availableSubstituteRoutines: Array<{ id: string; name: string }>;
      initialSubstituteRoutineIds: string[];
    };

type GoalFormData =
  | { mode: "new"; options: GoalFormOptions; initial: GoalFormInitial }
  | { mode: "edit"; options: GoalFormOptions; initial: GoalFormInitial }
  | { mode: "edit-group"; options: GoalFormOptions; initial: GoalFormInitial };

export default function FormDrawer() {
  const { mode, isOpen, close } = useFormDrawer();
  const [routineData, setRoutineData] = useState<RoutineFormData | null>(null);
  const [goalData, setGoalData] = useState<GoalFormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset cached data when drawer mode changes — every open is a fresh fetch
  // so values reflect the latest server state.
  useEffect(() => {
    if (!isOpen || !mode) {
      setRoutineData(null);
      setGoalData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        if (mode!.kind === "new-routine") {
          const res = await fetch("/api/routine-form-data", { signal: controller.signal });
          if (!res.ok) throw new Error("load");
          const data = (await res.json()) as RoutineFormData;
          if (!cancelled) setRoutineData(data);
        } else if (mode!.kind === "edit-routine") {
          const res = await fetch(`/api/routine-form-data?id=${encodeURIComponent(mode!.routineId)}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error("load");
          const data = (await res.json()) as RoutineFormData;
          if (!cancelled) setRoutineData(data);
        } else if (mode!.kind === "new-goal") {
          const params = new URLSearchParams();
          if (mode!.prefill?.goalType) params.set("goalType", mode!.prefill.goalType);
          if (mode!.prefill?.routineId) params.set("routineId", mode!.prefill.routineId);
          const qs = params.toString();
          const res = await fetch(`/api/goal-form-data${qs ? `?${qs}` : ""}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error("load");
          const data = (await res.json()) as GoalFormData;
          if (!cancelled) setGoalData(data);
        } else if (mode!.kind === "edit-goal") {
          const res = await fetch(`/api/goal-form-data?goalId=${encodeURIComponent(mode!.goalId)}`, {
            signal: controller.signal,
          });
          if (!res.ok) throw new Error("load");
          const data = (await res.json()) as GoalFormData;
          if (!cancelled) setGoalData(data);
        }
      } catch (e) {
        if (!cancelled && !(e instanceof DOMException && e.name === "AbortError")) {
          setError("Could not load form. Try again or open the full page.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, mode]);

  if (!isOpen || !mode) return null;

  const title =
    mode.kind === "new-routine"
      ? "New Routine"
      : mode.kind === "edit-routine"
        ? "Edit Routine"
        : mode.kind === "new-goal"
          ? "New Goal"
          : "Edit Goal";

  return (
    <>
      <div className="logDrawerBackdrop" onClick={close} />
      <div className="logDrawerSheet">
        <div style={drawerHeaderStyle}>
          <span style={drawerTitleStyle}>{title}</span>
          <button type="button" onClick={close} style={closeBtnStyle} aria-label="Close form">
            Close
          </button>
        </div>
        <div style={drawerBodyStyle}>
          {loading && <div style={stateStyle}>Loading…</div>}
          {error && <div style={{ ...stateStyle, color: "rgba(255,100,100,0.9)" }}>{error}</div>}
          {!loading && !error && (
            <>
              {mode.kind === "new-routine" && routineData?.mode === "new" && (
                <NewRoutineForm
                  metadataGroups={routineData.metadataGroups}
                  sessionTemplates={routineData.sessionTemplates}
                  availableSubstituteRoutines={routineData.availableSubstituteRoutines}
                  inDrawer
                  onSuccess={close}
                />
              )}
              {mode.kind === "edit-routine" && routineData?.mode === "edit" && (
                <EditRoutineForm
                  routine={routineData.routine}
                  metadataGroups={routineData.metadataGroups}
                  sessionTemplates={routineData.sessionTemplates}
                  availableSubstituteRoutines={routineData.availableSubstituteRoutines}
                  initialSubstituteRoutineIds={routineData.initialSubstituteRoutineIds}
                  inDrawer
                  onSuccess={close}
                />
              )}
              {mode.kind === "new-goal" && goalData?.mode === "new" && (
                <GoalForm
                  action={createGoal}
                  groupFrequencyAction={createFrequencyGoal}
                  options={goalData.options}
                  submitLabel="Save Goal"
                  initial={goalData.initial}
                  inDrawer
                  onSuccess={close}
                />
              )}
              {mode.kind === "edit-goal" && goalData?.mode === "edit" && (
                <GoalForm
                  action={updateGoal}
                  options={goalData.options}
                  submitLabel="Update Goal"
                  initial={goalData.initial}
                  inDrawer
                  onSuccess={close}
                />
              )}
              {mode.kind === "edit-goal" && goalData?.mode === "edit-group" && (
                <GoalForm
                  action={updateGoal}
                  groupFrequencyAction={updateFrequencyGoal}
                  options={goalData.options}
                  submitLabel="Update Goal"
                  initial={goalData.initial}
                  inDrawer
                  onSuccess={close}
                />
              )}
            </>
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

const closeBtnStyle: React.CSSProperties = {
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
