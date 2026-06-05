"use client";

import { useEffect, useRef, useState } from "react";

// Tiny draft-persistence hook for the sport-log sheets. Each sheet
// passes a stable key (e.g. "sport-log-draft-climbing"); the hook
// returns a [value, setValue] tuple that auto-syncs to localStorage
// every change. Closing the sheet keeps the draft; the next open
// rehydrates from storage.
//
// Call clearDraft() on successful save to wipe the slot so the next
// open starts blank instead of restoring the just-saved log.

export function useSportLogDraft<T extends Record<string, unknown>>(
  key: string,
  initial: T
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValueRaw] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw) as Partial<T>;
      // Merge over the initial so fields added in a later schema
      // version (e.g. `location`, `extras`, `sessionType`) get
      // sensible defaults instead of being `undefined`. Old drafts
      // saved before those fields existed would otherwise crash the
      // form on the first `.trim()` / property access.
      return { ...initial, ...parsed };
    } catch {
      return initial;
    }
  });

  // Debounce writes so rapid typing doesn't hammer localStorage.
  const writeTimer = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* quota / private-mode — non-fatal */
      }
    }, 250);
    return () => {
      if (writeTimer.current !== null) window.clearTimeout(writeTimer.current);
    };
  }, [key, value]);

  function setValue(next: T | ((prev: T) => T)) {
    setValueRaw(next);
  }
  function clearDraft() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* non-fatal */
    }
  }

  return [value, setValue, clearDraft];
}
