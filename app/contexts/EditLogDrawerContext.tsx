"use client";

// State for the edit-log drawer. Separate from LogDrawerContext (which is
// new-log only) and ViewLogDrawerContext (which is read-only). Opens with
// a single logId; the drawer fetches the appropriate edit data via the
// /api/logs/[logId]/edit-data endpoint.

import { createContext, useCallback, useContext, useState } from "react";

type EditLogDrawerContextValue = {
  isOpen: boolean;
  activeLogId: string | null;
  /** Optional title override (e.g. routine name). Falls back to a default. */
  title: string | null;
  openEditDrawer: (logId: string, options?: { title?: string }) => void;
  closeEditDrawer: () => void;
};

const EditLogDrawerContext = createContext<EditLogDrawerContextValue | null>(null);

export function EditLogDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);

  const openEditDrawer = useCallback((logId: string, options?: { title?: string }) => {
    if (!logId) return;
    setActiveLogId(logId);
    setTitle(options?.title ?? null);
    setIsOpen(true);
  }, []);

  const closeEditDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <EditLogDrawerContext.Provider value={{ isOpen, activeLogId, title, openEditDrawer, closeEditDrawer }}>
      {children}
    </EditLogDrawerContext.Provider>
  );
}

export function useEditLogDrawer(): EditLogDrawerContextValue {
  const ctx = useContext(EditLogDrawerContext);
  if (!ctx) throw new Error("useEditLogDrawer must be used inside EditLogDrawerProvider");
  return ctx;
}
