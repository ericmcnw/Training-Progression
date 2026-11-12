"use client";

import { useTransition } from "react";
import { toggleArchiveRoutine } from "./actions";

export default function ArchiveRoutineButton({ routineId }: { routineId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await toggleArchiveRoutine(routineId); })}
      style={{
        minHeight: 32,
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.72)",
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
        cursor: isPending ? "default" : "pointer",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      {isPending ? "Archiving…" : "Archive"}
    </button>
  );
}
