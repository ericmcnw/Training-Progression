"use client";

// The ladder. Tapping a rung's node ticks it; "current" is derived (first
// ACTIVE by sortOrder) so that one write advances the whole ladder.
//
// The node is the tick target and the text is deliberately left alone — that
// is where edit-in-place lands next, so the two gestures never collide.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markRungMet, reopenRung } from "@/app/progressions/actions";
import type { RungView } from "@/app/progressions/data";
import {
  ACCENT, rungRow, railCol, node, nodeCheck, rail, rungTextCol,
  rungLabel, rungMeta, modifierChip, nowPill, rungError,
} from "@/app/progressions/ui";

export default function ProgressionLadder({
  rungs,
  currentId,
}: {
  rungs: RungView[];
  currentId: string | null;
}) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {rungs.map((rung, i) => (
        <Rung
          key={rung.id}
          rung={rung}
          isCurrent={rung.id === currentId}
          isLast={i === rungs.length - 1}
        />
      ))}
      <style>{`.progRungNode:active { transform: scale(0.92); }`}</style>
    </div>
  );
}

function Rung({
  rung,
  isCurrent,
  isLast,
}: {
  rung: RungView;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const done = rung.status === "ACHIEVED";
  const skipped = rung.status === "SKIPPED";

  function toggle() {
    setFailed(false);
    startTransition(async () => {
      try {
        if (done) await reopenRung(rung.id);
        else await markRungMet(rung.id);
        router.refresh();
      } catch {
        setFailed(true);
      }
    });
  }

  const ringColor = done || isCurrent ? ACCENT : "rgba(255,255,255,0.26)";

  return (
    <div style={rungRow(isCurrent)}>
      <button
        type="button"
        className="progRungNode"
        onClick={toggle}
        disabled={pending || skipped}
        style={railCol}
        aria-label={done ? `Reopen ${rung.label}` : `Mark ${rung.label} done`}
        aria-pressed={done}
      >
        <span
          style={{
            ...node,
            borderColor: ringColor,
            background: done ? ACCENT : "transparent",
            opacity: pending ? 0.5 : 1,
          }}
        >
          {done ? <span style={nodeCheck}>✓</span> : null}
        </span>
        {!isLast ? (
          <span style={{ ...rail, background: done ? ACCENT : "rgba(255,255,255,0.12)" }} />
        ) : null}
      </button>

      <div style={rungTextCol}>
        <span style={rungLabel(done, skipped, isCurrent)}>
          {rung.label}
          {rung.modifier ? <span style={modifierChip}>{rung.modifier}</span> : null}
          {isCurrent ? <span style={nowPill}>now</span> : null}
        </span>
        {rung.targetText ? <span style={rungMeta}>{rung.targetText}</span> : null}
        {failed ? <span style={rungError}>Couldn&apos;t save — tap again</span> : null}
      </div>
    </div>
  );
}
