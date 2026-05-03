"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  type LogDraft,
  clearDraftFromStorage,
  loadAllDraftsFromStorage,
  saveDraftToStorage,
} from "@/lib/log-draft";

type LogDraftContextValue = {
  allDrafts: LogDraft[];
  getDraft: (routineId: string) => LogDraft | null;
  saveDraft: (draft: LogDraft) => void;
  clearDraft: (routineId: string) => void;
};

const LogDraftContext = createContext<LogDraftContextValue | null>(null);

export function LogDraftProvider({ children }: { children: React.ReactNode }) {
  const [drafts, setDrafts] = useState<Map<string, LogDraft>>(new Map());
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const all = loadAllDraftsFromStorage();
    if (all.length > 0) setDrafts(new Map(all.map((d) => [d.routineId, d])));
  }, []);

  const saveDraft = useCallback((draft: LogDraft) => {
    saveDraftToStorage(draft);
    setDrafts((prev) => new Map(prev).set(draft.routineId, draft));
  }, []);

  const clearDraft = useCallback((routineId: string) => {
    clearDraftFromStorage(routineId);
    setDrafts((prev) => {
      const next = new Map(prev);
      next.delete(routineId);
      return next;
    });
  }, []);

  const getDraft = useCallback(
    (routineId: string): LogDraft | null => drafts.get(routineId) ?? null,
    [drafts]
  );

  return (
    <LogDraftContext.Provider value={{ allDrafts: Array.from(drafts.values()), getDraft, saveDraft, clearDraft }}>
      {children}
    </LogDraftContext.Provider>
  );
}

export function useLogDraft(): LogDraftContextValue {
  const ctx = useContext(LogDraftContext);
  if (!ctx) throw new Error("useLogDraft must be used inside LogDraftProvider");
  return ctx;
}
