"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormDrawer } from "@/app/contexts/FormDrawerContext";
import NewRoutineForm from "@/app/routines/new/NewRoutineForm";
import EditRoutineForm from "@/app/routines/[id]/edit/EditRoutineForm";
import GoalForm, { type GoalFormInitial } from "@/app/goals/GoalForm";
import GoalCreatorEntry from "@/app/goals/GoalCreatorEntry";
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
        description?: string | null;
        selectedMetadataGroupIds: string[];
        tags: string[];
        supportsSports?: string[];
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
  const [retryNonce, setRetryNonce] = useState(0);
  // Set true the first time the user types/edits/clicks anything inside the
  // form body. Drives the "Discard changes?" prompt on backdrop tap so an
  // accidental tap outside the sheet doesn't wipe a half-filled form.
  const dirtyRef = useRef(false);

  // Reset cached data when drawer mode changes — every open is a fresh fetch
  // so values reflect the latest server state.
  useEffect(() => {
    if (!isOpen || !mode) {
      setRoutineData(null);
      setGoalData(null);
      setError(null);
      dirtyRef.current = false;
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
  }, [isOpen, mode, retryNonce]);

  const retry = useCallback(() => setRetryNonce((n) => n + 1), []);

  const handleSuccess = useCallback(() => {
    dirtyRef.current = false;
    close();
  }, [close]);

  const handleBackdropClose = useCallback(() => {
    if (dirtyRef.current) {
      const ok = window.confirm("Discard changes? Anything you've typed will be lost.");
      if (!ok) return;
    }
    dirtyRef.current = false;
    close();
  }, [close]);

  // Escape-key close — mobile sheets hide the backdrop, so without this the
  // user is one mis-tap on the X button away from being stuck. Re-checks
  // the dirty prompt the same as the X button / backdrop.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleBackdropClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, handleBackdropClose]);

  function markDirty() {
    dirtyRef.current = true;
  }

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
      <div className="logDrawerBackdrop" onClick={handleBackdropClose} />
      <div className="logDrawerSheet">
        <div style={drawerHeaderStyle}>
          <span style={drawerTitleStyle}>{title}</span>
          <button type="button" onClick={handleBackdropClose} style={closeBtnStyle} aria-label="Close form">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div
          style={drawerBodyStyle}
          onInput={markDirty}
          onChange={markDirty}
        >
          {loading && <FormSkeleton />}
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
          {!loading && !error && (
            <>
              {mode.kind === "new-routine" && routineData?.mode === "new" && (
                <NewRoutineForm
                  metadataGroups={routineData.metadataGroups}
                  sessionTemplates={routineData.sessionTemplates}
                  availableSubstituteRoutines={routineData.availableSubstituteRoutines}
                  inDrawer
                  onSuccess={handleSuccess}
                  presetDomain={mode.presetDomain}
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
                  onSuccess={handleSuccess}
                />
              )}
              {/* Fresh creates go through the guided subject-first entry;
                  prefilled creates ("add a goal for THIS routine") keep the
                  direct form so contextual flows stay one step. */}
              {mode.kind === "new-goal" && goalData?.mode === "new" && (
                mode.prefill?.routineId || mode.prefill?.goalType ? (
                  <GoalForm
                    action={createGoal}
                    groupFrequencyAction={createFrequencyGoal}
                    options={goalData.options}
                    submitLabel="Save Goal"
                    initial={goalData.initial}
                    inDrawer
                    onSuccess={handleSuccess}
                  />
                ) : (
                  <GoalCreatorEntry
                    options={goalData.options}
                    defaultInitial={goalData.initial}
                    createAction={createGoal}
                    createFrequencyAction={createFrequencyGoal}
                    onSuccess={handleSuccess}
                  />
                )
              )}
              {mode.kind === "edit-goal" && goalData?.mode === "edit" && (
                <GoalForm
                  action={updateGoal}
                  options={goalData.options}
                  submitLabel="Update Goal"
                  initial={goalData.initial}
                  inDrawer
                  onSuccess={handleSuccess}
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
                  onSuccess={handleSuccess}
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
  padding: "8px 12px 8px 16px",
  minHeight: 56,
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
  justifyContent: "center",
  width: 44,
  height: 44,
  padding: 0,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 999,
  color: "rgba(255,255,255,0.85)",
  cursor: "pointer",
  flexShrink: 0,
  touchAction: "manipulation",
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

// Pulsing skeleton mirroring a typical routine/goal form layout — header,
// 3-4 short fields, a fat field, and a primary action — so the drawer
// never shows a blank frame while /api/*-form-data loads.
function FormSkeleton() {
  return (
    <div style={{ display: "grid", gap: 14, paddingTop: 4 }}>
      <div className="skeleton" style={{ height: 24, width: "45%" }} />
      <div className="skeleton" style={{ height: 44 }} />
      <div className="skeleton" style={{ height: 44 }} />
      <div className="skeleton" style={{ height: 100 }} />
      <div className="skeleton" style={{ height: 44 }} />
      <div className="skeleton" style={{ height: 44, width: "35%", marginTop: 6 }} />
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
