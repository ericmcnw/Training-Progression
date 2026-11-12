"use client";

import { useEffect, useState } from "react";
import type { LogPlanLine } from "@/lib/program-plan";

const TONE_COLOR: Record<LogPlanLine["tone"], string> = {
  up: "#7ce8aa",
  held: "#f5c46a",
  same: "rgba(255,255,255,0.7)",
  done: "rgba(255,255,255,0.55)",
};

// What a program asks of this sport this week. Fetched on open because the
// sport sheets render client-side with no server data load of their own.
export default function SportPlanLine({ sportSlug }: { sportSlug: string }) {
  const [lines, setLines] = useState<LogPlanLine[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/plan-lines?sport=${encodeURIComponent(sportSlug)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { lines: [] }))
      .then((data: { lines?: LogPlanLine[] }) => setLines(Array.isArray(data.lines) ? data.lines : []))
      .catch(() => {});
    return () => controller.abort();
  }, [sportSlug]);

  if (lines.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: 4, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
      {lines.map((line) => (
        <span key={line.text} style={{ fontSize: 13, fontWeight: 800, color: TONE_COLOR[line.tone] }}>
          Plan · {line.text}
        </span>
      ))}
    </div>
  );
}
