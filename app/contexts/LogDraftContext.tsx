"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  type LogDraft,
  clearDraftFromStorage,
  loadAllDraftsFromStorage,
  loadDraftFromStorage,
  purgeUnscopedDrafts,
  saveDraftToStorage,
} from "@/lib/log-draft";

type LogDraftContextValue = {
  allDrafts: LogDraft[];
  getDraft: (routineId: string) => LogDraft | null;
  /** Reads straight from storage — for a form restoring on mount, before the
   *  provider's own state has been consulted. */
  loadStoredDraft: (routineId: string) => LogDraft | null;
  saveDraft: (draft: LogDraft) => void;
  clearDraft: (routineId: string) => void;
};

const LogDraftContext = createContext<LogDraftContextValue | null>(null);

export function LogDraftProvider({
  profileKey,
  children,
}: {
  /** Whose drafts these are. Everything stored is keyed by it, so an admin
   *  logging through view-as can't resume those drafts on their own account. */
  profileKey: string;
  children: React.ReactNode;
}) {
  const [drafts, setDrafts] = useState<Map<string, LogDraft>>(new Map());
  const loadedFor = useRef<string | null>(null);

  // localStorage can only be read after mount — reading it during render would
  // hydrate a tray the server rendered empty.
  useEffect(() => {
    if (loadedFor.current === profileKey) return;
    const switchedProfile = loadedFor.current !== null;
    if (!switchedProfile) purgeUnscopedDrafts();
    loadedFor.current = profileKey;
    const all = loadAllDraftsFromStorage(profileKey);
    if (all.length > 0 || switchedProfile) {
      setDrafts(new Map(all.map((d) => [d.routineId, d])));
    }
  }, [profileKey]);

  const saveDraft = useCallback(
    (draft: LogDraft) => {
      saveDraftToStorage(profileKey, draft);
      setDrafts((prev) => new Map(prev).set(draft.routineId, draft));
    },
    [profileKey]
  );

  const clearDraft = useCallback(
    (routineId: string) => {
      clearDraftFromStorage(profileKey, routineId);
      setDrafts((prev) => {
        const next = new Map(prev);
        next.delete(routineId);
        return next;
      });
    },
    [profileKey]
  );

  const getDraft = useCallback(
    (routineId: string): LogDraft | null => drafts.get(routineId) ?? null,
    [drafts]
  );

  const loadStoredDraft = useCallback(
    (routineId: string): LogDraft | null => loadDraftFromStorage(profileKey, routineId),
    [profileKey]
  );

  return (
    <LogDraftContext.Provider
      value={{ allDrafts: Array.from(drafts.values()), getDraft, loadStoredDraft, saveDraft, clearDraft }}
    >
      {children}
    </LogDraftContext.Provider>
  );
}

export function useLogDraft(): LogDraftContextValue {
  const ctx = useContext(LogDraftContext);
  if (!ctx) throw new Error("useLogDraft must be used inside LogDraftProvider");
  return ctx;
}

/** Variant that returns null instead of throwing when the form is rendered
 *  outside the provider (e.g. full-page log routes that don't yet wrap the
 *  provider, or storybook-style isolated mounts). */
export function useOptionalLogDraft(): LogDraftContextValue | null {
  return useContext(LogDraftContext);
}
