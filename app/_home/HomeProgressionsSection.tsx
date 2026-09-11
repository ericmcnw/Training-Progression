"use client";

// Steps you have already earned, brought to you instead of waiting on
// /progressions. A ladder nobody revisits goes stale no matter how good its
// editor is — this is the fix for that, and it renders nothing at all when
// there is nothing to tick.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markRungMet } from "@/app/progressions/actions";
import type { ReadyRung } from "@/app/progressions/data";
import {
  readySection, readyHead, readyTitle, readyAll, readyRow, readyText,
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

  function tick(id: string) {
    setDismissed((prev) => [...prev, id]);
    setFailed(false);
    startTransition(async () => {
      try {
        await markRungMet(id);
        router.refresh();
      } catch {
        setDismissed((prev) => prev.filter((x) => x !== id));
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
        <Link href="/progressions" style={readyAll}>Progressions →</Link>
      </div>

      {shown.map((rung) => (
        <div key={rung.id} style={readyRow}>
          <span style={readyText}>
            <span style={readyStep}>{rung.label || "Untitled step"}</span>
            <span style={readyWhy}>
              {rung.progressionName} · you hit {rung.best} {UNITS[rung.metric]} in{" "}
              {rung.exerciseName}, target was {rung.value}
            </span>
          </span>
          <button type="button" style={readyTickBtn} onClick={() => tick(rung.id)} disabled={pending}>
            Tick it
          </button>
        </div>
      ))}

      {failed ? <span style={rungError}>Couldn&apos;t save — try again</span> : null}
    </section>
  );
}
