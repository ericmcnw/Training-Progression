"use client";

// The name is just a field. No Rename button, no edit mode — type in it and it
// saves when you leave it, the same way every step on the ladder behaves.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { archiveProgression, renameProgression } from "@/app/progressions/actions";
import { titleInput, headerActions, dangerAction, rungError } from "@/app/progressions/ui";

export default function ProgressionHeader({
  id,
  name,
  autoRename,
}: {
  id: string;
  name: string;
  autoRename: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  // Arriving from "Build your own" — the placeholder name is selected so the
  // first keystroke replaces it.
  useEffect(() => {
    if (autoRename) inputRef.current?.select();
  }, [autoRename]);

  function save() {
    const next = value.trim();
    if (!next) {
      setValue(name);
      return;
    }
    if (next === name) return;
    setFailed(false);
    startTransition(async () => {
      try {
        await renameProgression(id, next);
        router.refresh();
      } catch {
        setValue(name);
        setFailed(true);
      }
    });
  }

  function remove() {
    if (!confirm(`Delete "${name}"? This removes it from your list.`)) return;
    startTransition(async () => {
      try {
        await archiveProgression(id);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <header style={{ display: "grid", gap: 8 }}>
      <input
        ref={inputRef}
        style={titleInput}
        value={value}
        autoFocus={autoRename}
        placeholder="Name this progression"
        aria-label="Progression name"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setValue(name);
          }
        }}
      />

      <div style={headerActions}>
        <button type="button" style={dangerAction} onClick={remove} disabled={pending}>
          Delete progression
        </button>
      </div>

      {failed ? <span style={rungError}>Couldn&apos;t save — try again</span> : null}
    </header>
  );
}
