"use client";

// Title plus the two things you can do to a progression as a whole. Both are
// spelled out rather than hidden behind a menu — tapping the title also works,
// but nobody discovers that on their own.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import { archiveProgression, renameProgression } from "@/app/progressions/actions";
import { title, titleButton, headerRow, headerActions, textAction, dangerAction, rungError } from "@/app/progressions/ui";

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
  const [editing, setEditing] = useState(autoRename);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function save() {
    const next = value.trim();
    setEditing(false);
    if (!next || next === name) {
      setValue(name);
      return;
    }
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
      <div style={headerRow}>
        {editing ? (
          <input
            ref={inputRef}
            style={{ ...inputStyle, fontSize: 20, fontWeight: 900 }}
            value={value}
            autoFocus
            placeholder="Name this progression"
            aria-label="Progression name"
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setValue(name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="progRungText"
            style={{ ...title, ...titleButton }}
            onClick={() => setEditing(true)}
            disabled={pending}
          >
            {name}
          </button>
        )}
      </div>

      {editing ? null : (
        <div style={headerActions}>
          <button type="button" style={textAction} onClick={() => setEditing(true)} disabled={pending}>
            Rename
          </button>
          <button type="button" style={dangerAction} onClick={remove} disabled={pending}>
            Delete
          </button>
        </div>
      )}

      {failed ? <span style={rungError}>Couldn&apos;t save — try again</span> : null}
    </header>
  );
}
