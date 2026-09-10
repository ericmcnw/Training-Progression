"use client";

// The title edits the same way a rung does — tap it, type, done. Archiving
// lives behind a confirm because a ladder holds a real record of what was
// ticked and when.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import { archiveProgression, renameProgression } from "@/app/progressions/actions";
import { title, titleButton, headerRow, iconBtn, rungError } from "@/app/progressions/ui";

export default function ProgressionHeader({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

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

  function archive() {
    if (!confirm(`Archive "${name}"? Its ticked steps are kept.`)) return;
    startTransition(async () => {
      try {
        await archiveProgression(id);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <header style={{ display: "grid", gap: 6 }}>
      <div style={headerRow}>
        {editing ? (
          <input
            style={{ ...inputStyle, fontSize: 20, fontWeight: 900 }}
            value={value}
            autoFocus
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
        <button type="button" style={iconBtn} onClick={archive} disabled={pending} aria-label="Archive progression">
          ⋯
        </button>
      </div>
      {failed ? <span style={rungError}>Couldn&apos;t save — try again</span> : null}
    </header>
  );
}
