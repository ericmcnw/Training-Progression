"use client";

// Separate from LogDrawerContext on purpose: the log drawer is for editing
// (active routine id, dirty state, draft cache); the view drawer is read-only
// and operates over a list of log ids. Keeping these isolated avoids a 50%
// larger LogDrawer trying to be two things at once.

import { createContext, useCallback, useContext, useState } from "react";

type ViewLogDrawerContextValue = {
  isOpen: boolean;
  /** Log ids the modal is currently showing, ordered most-recent first. */
  activeLogIds: string[];
  /** Optional title override (e.g. routine name). Falls back to a generic. */
  title: string | null;
  openViewer: (logIds: string[], options?: { title?: string }) => void;
  closeViewer: () => void;
  /** Called by the modal after a successful delete so other consumers
   *  (e.g. a future "fresh fetch" trigger) can react. Currently a no-op
   *  but reserved so the API doesn't change later. */
  notifyDeleted: (logId: string) => void;
};

const ViewLogDrawerContext = createContext<ViewLogDrawerContextValue | null>(null);

export function ViewLogDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLogIds, setActiveLogIds] = useState<string[]>([]);
  const [title, setTitle] = useState<string | null>(null);

  const openViewer = useCallback((logIds: string[], options?: { title?: string }) => {
    if (logIds.length === 0) return;
    setActiveLogIds(logIds);
    setTitle(options?.title ?? null);
    setIsOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const notifyDeleted = useCallback((logId: string) => {
    // Reserved for future expansion (e.g. cache invalidation hooks).
    void logId;
  }, []);

  return (
    <ViewLogDrawerContext.Provider
      value={{ isOpen, activeLogIds, title, openViewer, closeViewer, notifyDeleted }}
    >
      {children}
    </ViewLogDrawerContext.Provider>
  );
}

export function useViewLogDrawer(): ViewLogDrawerContextValue {
  const ctx = useContext(ViewLogDrawerContext);
  if (!ctx) throw new Error("useViewLogDrawer must be used inside ViewLogDrawerProvider");
  return ctx;
}
