"use client";

// Floating pain-log sheet — opens over the body page (or anywhere) for a
// single zone you've already picked. Replaces the navigate-to-a-page flow:
// tap a zone → Log pain → quick slider + when + notes → save, no page change.
// Reuses the shared Popover primitive (bottom sheet on mobile, centered modal
// on desktop).

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Popover from "@/app/_home/Popover";
import { logPain } from "@/app/body/actions";
import FactorSearchField from "@/app/components/injuries/FactorSearchField";
import { todayAppYmd } from "@/lib/dates";
import type { PainContext } from "@/generated/prisma";

const CONTEXTS: Array<{ value: PainContext; label: string }> = [
  { value: "AT_REST", label: "At rest" },
  { value: "DURING_ACTIVITY", label: "During activity" },
  { value: "AFTER_ACTIVITY", label: "After activity" },
  { value: "MORNING", label: "Morning" },
  { value: "GENERAL", label: "General" },
];

function painColor(level: number) {
  if (level >= 7) return "#F87171";
  if (level >= 4) return "#FBBF24";
  return "rgba(255,255,255,0.92)";
}

export default function PainLogSheet({
  zone,
  onClose,
  factorSuggestions = [],
}: {
  zone: { slug: string; label: string } | null;
  onClose: () => void;
  factorSuggestions?: string[];
}) {
  const today = todayAppYmd();
  const [level, setLevel] = useState(3);
  const [context, setContext] = useState<PainContext>("GENERAL");
  const [notes, setNotes] = useState("");
  const [factors, setFactors] = useState<string[]>([]);
  const [when, setWhen] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    // Reset for the next open.
    setLevel(3);
    setContext("GENERAL");
    setNotes("");
    setFactors([]);
    setWhen(today);
    setError(null);
    onClose();
  }

  function submit() {
    if (!zone || level <= 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await logPain([{ zoneSlug: zone.slug, level, context, notes: notes.trim() || undefined, aggravatingFactors: factors, loggedAtYmd: when }]);
        close();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't log pain.");
      }
    });
  }

  return (
    <Popover open={Boolean(zone)} onClose={close} title={`Log pain${zone ? ` · ${zone.label}` : ""}`} desktopWidth={420}>
      {zone ? (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Backdating — catch up on days you missed. Capped at today. */}
          <div style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabel}>Date</span>
            <input
              type="date"
              value={when}
              max={today}
              onChange={(e) => setWhen(e.target.value)}
              style={input}
              aria-label="Day this reading is for"
            />
            {when !== today ? (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(251,191,36,0.9)" }}>
                Backdating to {when}
              </span>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={fieldLabel}>How bad?</span>
            <span style={{ fontSize: 30, fontWeight: 900, color: painColor(level), lineHeight: 1 }}>
              {level}
              <span style={{ fontSize: 15, fontWeight: 700, opacity: 0.5 }}>/10</span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            style={{ width: "100%", accentColor: painColor(level), minHeight: 44, cursor: "pointer" }}
            aria-label="Pain level"
          />

          <div style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabel}>Context</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CONTEXTS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setContext(c.value)}
                  style={context === c.value ? chipActive : chip}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabel}>What aggravates it?</span>
            <FactorSearchField value={factors} onChange={setFactors} suggestions={factorSuggestions} />
          </div>

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            style={input}
          />

          {error ? <div style={errorStyle}>{error}</div> : null}

          <button type="button" disabled={pending || level <= 0} onClick={submit} style={submitBtn}>
            {pending ? "Logging…" : "Log pain"}
          </button>
        </div>
      ) : null}
    </Popover>
  );
}

const fieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.6,
};

const chip: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  minHeight: 38,
};

const chipActive: CSSProperties = {
  ...chip,
  border: "1px solid rgba(251,113,133,0.45)",
  background: "rgba(251,113,133,0.14)",
  color: "#FECACA",
};

// fontSize 16 — iOS zoom guard.
const input: CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
  minHeight: 44,
};

const submitBtn: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid rgba(248,113,113,0.5)",
  background: "rgba(248,113,113,0.14)",
  color: "#FECACA",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
  minHeight: 46,
};

const errorStyle: CSSProperties = {
  fontSize: 12,
  padding: "8px 11px",
  borderRadius: 10,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};
