"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { logPain } from "@/app/body/actions";
import type { PainContext } from "@/generated/prisma";

type Zone = { slug: string; label: string };

const contextOptions: Array<{ value: PainContext; label: string }> = [
  { value: "GENERAL", label: "General" },
  { value: "AT_REST", label: "At rest" },
  { value: "MORNING", label: "Morning" },
  { value: "AFTER_ACTIVITY", label: "After activity" },
  { value: "DURING_ACTIVITY", label: "During activity" },
];

export default function QuickInjuryPainLog({
  zones,
  onLogged,
}: {
  zones: Zone[];
  onLogged?: () => void;
}) {
  const [levels, setLevels] = useState<Record<string, number>>(() =>
    Object.fromEntries(zones.map((z) => [z.slug, 0]))
  );
  const [context, setContext] = useState<PainContext>("GENERAL");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasAny = zones.some((z) => (levels[z.slug] ?? 0) > 0);

  function submit() {
    if (!hasAny) return;
    startTransition(async () => {
      try {
        await logPain(
          zones
            .filter((z) => (levels[z.slug] ?? 0) > 0)
            .map((z) => ({
              zoneSlug: z.slug,
              level: levels[z.slug] ?? 0,
              context,
              notes: notes.trim() || undefined,
            }))
        );
        setStatus("Logged.");
        setLevels(Object.fromEntries(zones.map((z) => [z.slug, 0])));
        setNotes("");
        onLogged?.();
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Unable to log.");
      }
    });
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.3 }}>Log pain now</div>
      <div style={{ display: "grid", gap: 12 }}>
        {zones.map((z) => {
          const val = levels[z.slug] ?? 0;
          const color = val >= 7 ? "#F87171" : val >= 4 ? "#FBBF24" : "rgba(255,255,255,0.9)";
          return (
            <div key={z.slug} style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14 }}>
                <span>{z.label}</span>
                <span style={{ color }}>{val}/10</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={val}
                onChange={(e) => {
                  setLevels((curr) => ({ ...curr, [z.slug]: Number(e.target.value) }));
                  setStatus(null);
                }}
                style={{ width: "100%", accentColor: "#F87171", minHeight: 44, cursor: "pointer" }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={context}
          onChange={(e) => setContext(e.target.value as PainContext)}
          style={selectStyle}
        >
          {contextOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setStatus(null); }}
          placeholder="Notes — what made it better or worse?"
          style={notesStyle}
        />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          disabled={!hasAny || pending}
          onClick={submit}
          style={btnStyle(hasAny && !pending)}
        >
          {pending ? "Logging..." : "Log pain"}
        </button>
        {status && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{status}</span>}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  border: "1px solid rgba(248,113,113,0.22)",
  borderRadius: 16,
  background: "rgba(248,113,113,0.06)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const selectStyle: React.CSSProperties = {
  flex: "0 0 auto",
  minWidth: 150,
  padding: "10px 12px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.1)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 700,
  minHeight: 42,
};

const notesStyle: React.CSSProperties = {
  flex: "1 1 180px",
  minWidth: 120,
  padding: "10px 12px",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 10,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontSize: 13,
  minHeight: 42,
};

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 20px",
    border: `1px solid rgba(248,113,113,${active ? "0.5" : "0.2"})`,
    borderRadius: 10,
    background: `rgba(248,113,113,${active ? "0.14" : "0.05"})`,
    color: "inherit",
    fontWeight: 900,
    fontSize: 14,
    cursor: active ? "pointer" : "default",
    opacity: active ? 1 : 0.5,
    minHeight: 42,
  };
}
