"use client";

import { createContext, useCallback, useContext, useState } from "react";

type DrawerUiState = Record<string, unknown>;

function shallowEqualDrawerState(left: DrawerUiState | undefined, right: DrawerUiState) {
  if (left === right) return true;
  if (!left) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.is(left[key], right[key]));
}

export type OpenDrawerOptions = {
  /** When set, the drawer-launched form pre-fills its performed-at date with
   *  this YYYY-MM-DD value (default time of day = noon). Used by back-date
   *  entry points (heatmap, WaG detail card) to keep the floating-drawer
   *  flow even when logging retroactively. */
  defaultDate?: string;
};

type LogDrawerContextValue = {
  activeRoutineId: string | null;
  isOpen: boolean;
  isDirty: boolean;
  openDrawer: (routineId: string, options?: OpenDrawerOptions) => void;
  closeDrawer: () => void;
  markDirty: () => void;
  clearDirty: () => void;
  getDrawerState: <T extends DrawerUiState>(routineId: string) => T | null;
  setDrawerState: <T extends DrawerUiState>(routineId: string, state: T) => void;
  clearDrawerState: (routineId: string) => void;
  /** Default date passed to the currently-open drawer. Form-side code uses
   *  this to seed `performedAtLocal` when there's no existing draft. */
  getDefaultDate: (routineId: string) => string | null;
};

const LogDrawerContext = createContext<LogDrawerContextValue | null>(null);

export function LogDrawerProvider({ children }: { children: React.ReactNode }) {
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [drawerStates, setDrawerStates] = useState<Record<string, DrawerUiState>>({});
  // Per-routine defaultDate (one-shot — cleared when the routine's draft is
  // cleared elsewhere, but otherwise persists so re-opening keeps the date).
  const [defaultDates, setDefaultDates] = useState<Record<string, string>>({});

  const openDrawer = useCallback((routineId: string, options?: OpenDrawerOptions) => {
    setActiveRoutineId(routineId);
    setIsOpen(true);
    setIsDirty(false);
    if (options?.defaultDate) {
      setDefaultDates((prev) => ({ ...prev, [routineId]: options.defaultDate! }));
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
    setIsDirty(false);
  }, []);

  const markDirty = useCallback(() => setIsDirty(true), []);
  const clearDirty = useCallback(() => setIsDirty(false), []);
  const getDrawerState = useCallback(
    <T extends DrawerUiState>(routineId: string) => (drawerStates[routineId] as T | undefined) ?? null,
    [drawerStates]
  );
  const setDrawerState = useCallback(
    <T extends DrawerUiState>(routineId: string, state: T) => {
      setDrawerStates((current) => {
        if (shallowEqualDrawerState(current[routineId], state)) return current;
        return { ...current, [routineId]: state };
      });
    },
    []
  );
  const clearDrawerState = useCallback((routineId: string) => {
    setDrawerStates((current) => {
      if (!(routineId in current)) return current;
      const next = { ...current };
      delete next[routineId];
      return next;
    });
    setDefaultDates((current) => {
      if (!(routineId in current)) return current;
      const next = { ...current };
      delete next[routineId];
      return next;
    });
  }, []);
  const getDefaultDate = useCallback(
    (routineId: string) => defaultDates[routineId] ?? null,
    [defaultDates]
  );

  return (
    <LogDrawerContext.Provider
      value={{
        activeRoutineId,
        isOpen,
        isDirty,
        openDrawer,
        closeDrawer,
        markDirty,
        clearDirty,
        getDrawerState,
        setDrawerState,
        clearDrawerState,
        getDefaultDate,
      }}
    >
      {children}
    </LogDrawerContext.Provider>
  );
}

export function useLogDrawer(): LogDrawerContextValue {
  const ctx = useContext(LogDrawerContext);
  if (!ctx) throw new Error("useLogDrawer must be used inside LogDrawerProvider");
  return ctx;
}

export function useOptionalLogDrawer(): LogDrawerContextValue | null {
  return useContext(LogDrawerContext);
}
