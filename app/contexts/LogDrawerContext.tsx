"use client";

import { createContext, useCallback, useContext, useState } from "react";

type LogDrawerContextValue = {
  activeRoutineId: string | null;
  isOpen: boolean;
  isDirty: boolean;
  openDrawer: (routineId: string) => void;
  closeDrawer: () => void;
  markDirty: () => void;
  clearDirty: () => void;
};

const LogDrawerContext = createContext<LogDrawerContextValue | null>(null);

export function LogDrawerProvider({ children }: { children: React.ReactNode }) {
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

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

  return (
    <LogDrawerContext.Provider value={{ activeRoutineId, isOpen, isDirty, openDrawer, closeDrawer, markDirty, clearDirty }}>
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
