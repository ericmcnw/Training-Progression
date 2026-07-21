"use client";

// One-tap daily pain reading. A single segmented 0–10 scale — tap a cell and
// today's reading is logged (or corrected) for the zone. Designed to read as
// one quiet control, not a row of buttons: joined cells inside a pill, the
// selected cell filled with its level color, a subtle gradient hinting the
// scale. Optimistic: the tapped value highlights immediately.

import { useRouter } from "next/navigation";
import { useState, useTransition, type CSSProperties } from "react";
import { logInjuryReading } from "@/app/focus/actions";

function levelColor(level: number): string {
  if (level <= 2) return "#4ade80";
  if (level <= 4) return "#fbbf24";
  if (level <= 6) return "#fb923c";
  return "#f87171";
}

export default function TodayReadingControl({
  zoneId,
  current,
}: {
  zoneId: string | null;
  current: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<number | null>(current);
  const [err, setErr] = useState(false);

  if (!zoneId) return null;

  const selected = optimistic;

  function pick(n: number) {
    if (pending) return;
    setErr(false);
    setOptimistic(n);
    startTransition(async () => {
      try {
        await logInjuryReading(zoneId!, n);
        router.refresh();
      } catch {
        setErr(true);
        setOptimistic(current);
      }
    });
  }

  return (
    <div style={row}>
      <span style={sideLabel}>{selected != null ? "today" : "log today"}</span>
      <div style={scale} role="group" aria-label="Today's pain reading 0 to 10">
        {Array.from({ length: 11 }, (_, n) => {
          const isSel = selected === n;
          const color = levelColor(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              aria-pressed={isSel}
              aria-label={`${n} out of 10`}
              disabled={pending}
              style={{
                ...cell,
                ...(n === 0 ? cellFirst : null),
                ...(n === 10 ? cellLast : null),
                color: isSel ? "#0b1220" : "rgba(255,255,255,0.55)",
                background: isSel ? color : "transparent",
                fontWeight: isSel ? 900 : 700,
                boxShadow: isSel ? `0 0 8px ${color}55` : "none",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {err ? <span style={errText}>tap again</span> : null}
    </div>
  );
}

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const sideLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "rgba(255,255,255,0.4)",
  flexShrink: 0,
  width: 52,
  textAlign: "right",
};

// One joined pill; cells divide it evenly. Height 30 keeps taps comfortable
// while reading as a compact scale, not a button bar.
const scale: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  height: 30,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)",
  overflow: "hidden",
};

const cell: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  flex: 1,
  minWidth: 0,
  textAlign: "center",
  lineHeight: "30px",
  fontSize: 11.5,
  boxSizing: "border-box",
  borderLeft: "1px solid rgba(255,255,255,0.06)",
};

const cellFirst: CSSProperties = { borderLeft: "none" };
const cellLast: CSSProperties = {};

const errText: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "rgba(248,140,140,0.95)",
  flexShrink: 0,
};
