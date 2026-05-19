"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type FormDrawerMode =
  | { kind: "new-routine" }
  | { kind: "edit-routine"; routineId: string }
  | { kind: "new-goal"; prefill?: { goalType?: string; routineId?: string } }
  | { kind: "edit-goal"; goalId: string };

type FormDrawerContextValue = {
  mode: FormDrawerMode | null;
  isOpen: boolean;
  openRoutineNew: () => void;
  openRoutineEdit: (routineId: string) => void;
  openGoalNew: (prefill?: { goalType?: string; routineId?: string }) => void;
  openGoalEdit: (goalId: string) => void;
  close: () => void;
};

const FormDrawerContext = createContext<FormDrawerContextValue | null>(null);

export function FormDrawerProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<FormDrawerMode | null>(null);
  const isOpen = mode !== null;

  const openRoutineNew = useCallback(() => setMode({ kind: "new-routine" }), []);
  const openRoutineEdit = useCallback((routineId: string) => setMode({ kind: "edit-routine", routineId }), []);
  const openGoalNew = useCallback(
    (prefill?: { goalType?: string; routineId?: string }) => setMode({ kind: "new-goal", prefill }),
    []
  );
  const openGoalEdit = useCallback((goalId: string) => setMode({ kind: "edit-goal", goalId }), []);
  const close = useCallback(() => setMode(null), []);

  return (
    <FormDrawerContext.Provider
      value={{ mode, isOpen, openRoutineNew, openRoutineEdit, openGoalNew, openGoalEdit, close }}
    >
      {children}
    </FormDrawerContext.Provider>
  );
}

export function useFormDrawer(): FormDrawerContextValue {
  const ctx = useContext(FormDrawerContext);
  if (!ctx) throw new Error("useFormDrawer must be used inside FormDrawerProvider");
  return ctx;
}

export function useOptionalFormDrawer(): FormDrawerContextValue | null {
  return useContext(FormDrawerContext);
}
