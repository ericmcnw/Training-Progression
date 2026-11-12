"use client";

// Steps you have already earned, brought to you instead of waiting on
// /progressions. A ladder nobody revisits goes stale no matter how good its
// editor is — this is the fix for that, and it renders nothing at all when
// there is nothing to tick.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markRungMet } from "@/app/progressions/actions";
import { markMilestoneMet } from "@/app/focus/actions";
import type { ReadyRung } from "@/app/progressions/data";
import {
  readySection, readyHead, readyTitle, readyRow, readyText,
  readyStep, readyWhy, readyTickBtn, rungError,
} from "@/app/progressions/ui";

const UNITS = { WEIGHT: "lb", REPS: "reps", SECONDS: "sec" } as const;

export default function HomeProgressionsSection({ ready }: { ready: ReadyRung[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const shown = ready.filter((r) => !dismissed.includes(r.id));
  if (shown.length === 0) return null;

  // The two ladder surfaces keep separate ownership guards on purpose, so the
  // tick goes to whichever one owns this step.
  function tick(rung: ReadyRung) {
    setDismissed((prev) => [...prev, rung.id]);
    setFailed(false);
    startTransition(async () => {
      try {
        if (rung.ownerKind === "FOCUS") await markMilestoneMet(rung.id);
        else await markRungMet(rung.id);
        router.refresh();
      } catch {
        setDismissed((prev) => prev.filter((x) => x !== rung.id));
        setFailed(true);
      }
    });
  }

  return (
    <section style={readySection}>
      <div style={readyHead}>
        <span style={readyTitle}>
          {shown.length === 1 ? "A step looks done" : `${shown.length} steps look done`}
        </span>
      </div>

      {shown.map((rung) => (
        <div key={rung.id} style={readyRow}>
          <span style={readyText}>
            <span style={readyStep}>{rung.label || "Untitled step"}</span>
            <Link href={rung.ownerHref} style={{ ...readyWhy, textDecoration: "none" }}>
              {rung.ownerName} · you hit {rung.best} {UNITS[rung.metric]} in{" "}
              {rung.exerciseName}, target was {rung.value}
            </Link>
          </span>
          <button type="button" style={readyTickBtn} onClick={() => tick(rung)} disabled={pending}>
            Tick it
          </button>
        </div>
      ))}

      {failed ? <span style={rungError}>Couldn&apos;t save — try again</span> : null}
    </section>
  );
}
