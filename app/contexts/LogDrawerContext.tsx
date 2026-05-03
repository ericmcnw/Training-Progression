"use client";

import { createContext, useCallback, useContext, useState } from "react";

type LogDrawerContextValue = {
  activeRoutineId: string | null;
  isOpen: boolean;
  openDrawer: (routineId: string) => void;
  closeDrawer: () => void;
};

const LogDrawerContext = createContext<LogDrawerContextValue | null>(null);

export function LogDrawerProvider({ children }: { children: React.ReactNode }) {
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openDrawer = useCallback((routineId: string) => {
    setActiveRoutineId(routineId);
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <LogDrawerContext.Provider value={{ activeRoutineId, isOpen, openDrawer, closeDrawer }}>
      {children}
    </LogDrawerContext.Provider>
  );
}

export function useLogDrawer(): LogDrawerContextValue {
  const ctx = useContext(LogDrawerContext);
  if (!ctx) throw new Error("useLogDrawer must be used inside LogDrawerProvider");
  return ctx;
}
