"use client";

// One-tap daily pain reading. A 0–10 chip strip inside the injury panel — tap
// a number and it logs (or corrects) today's reading for the zone, keeping the
// panel and future gates live without a trip to /body. Optimistic: the tapped
// value highlights immediately, then the server refresh confirms it.

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
    <div style={wrap}>
      <span style={label}>
        {selected != null ? "Today's reading" : "Log today"}
        {err ? <span style={errText}> · didn&apos;t save, tap again</span> : null}
      </span>
      <div style={strip} role="group" aria-label="Today's pain reading 0 to 10">
        {Array.from({ length: 11 }, (_, n) => {
          const isSel = selected === n;
          const color = levelColor(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => pick(n)}
              aria-pressed={isSel}
              disabled={pending}
              style={{
                ...chip,
                color: isSel ? "#0b1220" : "rgba(255,255,255,0.72)",
                background: isSel ? color : "rgba(255,255,255,0.04)",
                borderColor: isSel ? color : "rgba(255,255,255,0.12)",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const wrap: CSSProperties = { display: "grid", gap: 6 };

const label: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
};

const errText: CSSProperties = { color: "rgba(248,140,140,0.95)", textTransform: "none", letterSpacing: 0 };

// Wraps on narrow phones; each chip is a comfortable tap target.
const strip: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
};

const chip: CSSProperties = {
  all: "unset",
  cursor: "pointer",
  minWidth: 30,
  height: 32,
  flex: "1 1 auto",
  textAlign: "center",
  lineHeight: "32px",
  borderRadius: 8,
  border: "1px solid",
  fontSize: 13,
  fontWeight: 900,
  boxSizing: "border-box",
};
