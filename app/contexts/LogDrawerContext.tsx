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

type LogDrawerContextValue = {
  activeRoutineId: string | null;
  isOpen: boolean;
  isDirty: boolean;
  openDrawer: (routineId: string) => void;
  closeDrawer: () => void;
  markDirty: () => void;
  clearDirty: () => void;
  getDrawerState: <T extends DrawerUiState>(routineId: string) => T | null;
  setDrawerState: <T extends DrawerUiState>(routineId: string, state: T) => void;
  clearDrawerState: (routineId: string) => void;
};

const LogDrawerContext = createContext<LogDrawerContextValue | null>(null);

export function LogDrawerProvider({ children }: { children: React.ReactNode }) {
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [drawerStates, setDrawerStates] = useState<Record<string, DrawerUiState>>({});

  const openDrawer = useCallback((routineId: string) => {
    setActiveRoutineId(routineId);
    setIsOpen(true);
    setIsDirty(false);
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
  }, []);

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
