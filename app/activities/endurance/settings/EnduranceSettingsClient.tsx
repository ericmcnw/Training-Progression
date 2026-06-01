"use client";

// Client island for the endurance settings page. Holds the toggle state
// + dispatches server actions. Everything is optimistic to keep the page
// responsive — the dev server's revalidate pass refetches in the
// background so any rare server failure surfaces on the next nav.

import { useState, useTransition } from "react";
import { SectionCard } from "@/app/progress/ui";
import {
  archiveLegacyEnduranceRoutine,
  restoreLegacyEnduranceRoutine,
  setActivityTypeEnabled,
} from "./actions";

export type SettingsTypeRow = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  logCount: number;
  routineCount: number;
};

export type SettingsFamily = {
  id: string;
  slug: string;
  name: string;
  types: SettingsTypeRow[];
};

export type SettingsLegacyRoutine = {
  id: string;
  name: string;
  subtype: string | null;
  isDeleted: boolean;
  activityTypeId: string | null;
  activityTypeName: string | null;
  logCount: number;
};

export type SettingsData = {
  families: SettingsFamily[];
  legacyRoutines: SettingsLegacyRoutine[];
};

export default function EnduranceSettingsClient({ data }: { data: SettingsData }) {
  const [types, setTypes] = useState(() => new Map(data.families.flatMap((f) => f.types.map((t) => [t.id, t]))));
  const [routines, setRoutines] = useState(data.legacyRoutines);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleType(typeId: string, nextEnabled: boolean) {
    // Optimistic update — flip the state immediately.
    setTypes((prev) => {
      const next = new Map(prev);
      const cur = next.get(typeId);
      if (cur) next.set(typeId, { ...cur, enabled: nextEnabled });
      return next;
    });
    setError(null);
    startTransition(async () => {
      try {
        await setActivityTypeEnabled({ activityTypeId: typeId, enabled: nextEnabled });
      } catch (err) {
        // Rollback on failure.
        setTypes((prev) => {
          const next = new Map(prev);
          const cur = next.get(typeId);
          if (cur) next.set(typeId, { ...cur, enabled: !nextEnabled });
          return next;
        });
        setError(err instanceof Error ? err.message : "Couldn't update type");
      }
    });
  }

  function toggleArchive(routineId: string, shouldArchive: boolean) {
    const target = routines.find((r) => r.id === routineId);
    if (!target) return;
    if (shouldArchive && target.logCount > 0) {
      const msg = `Archive "${target.name}"? ${target.logCount} log${target.logCount === 1 ? "" : "s"} stay intact — you'll just hide the routine from your list. Reversible from here.`;
      if (!window.confirm(msg)) return;
    }
    setRoutines((prev) => prev.map((r) => (r.id === routineId ? { ...r, isDeleted: shouldArchive } : r)));
    setError(null);
    startTransition(async () => {
      try {
        if (shouldArchive) {
          await archiveLegacyEnduranceRoutine({ routineId });
        } else {
          await restoreLegacyEnduranceRoutine({ routineId });
        }
      } catch (err) {
        // Rollback.
        setRoutines((prev) => prev.map((r) => (r.id === routineId ? { ...r, isDeleted: !shouldArchive } : r)));
        setError(err instanceof Error ? err.message : "Couldn't update routine");
      }
    });
  }

  const activeLegacy = routines.filter((r) => !r.isDeleted);
  const archivedLegacy = routines.filter((r) => r.isDeleted);

  return (
    <>
      {error && <div style={errorStyle}>{error}</div>}

      {/* Types section */}
      <SectionCard
        title="Activity types"
        subtitle="Disable types you don't track to keep the log picker short. Disabled types stay in your data — logs and stats remain visible."
      >
        <div style={{ display: "grid", gap: 16 }}>
          {data.families.map((fam) => (
            <div key={fam.id} style={{ display: "grid", gap: 6 }}>
              <div style={familyHeaderStyle}>{fam.name}</div>
              <div style={{ display: "grid", gap: 4 }}>
                {fam.types.map((t) => {
                  const live = types.get(t.id) ?? t;
                  return (
                    <div key={t.id} style={typeRowStyle}>
                      <div style={{ display: "grid", gap: 1, flex: 1, minWidth: 0 }}>
                        <span style={typeNameStyle}>{t.name}</span>
                        <span style={typeMetaStyle}>
                          {t.logCount} log{t.logCount === 1 ? "" : "s"} ·{" "}
                          {t.routineCount} routine{t.routineCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleType(t.id, !live.enabled)}
                        disabled={isPending}
                        style={live.enabled ? toggleEnabledStyle : toggleDisabledStyle}
                        aria-pressed={live.enabled}
                      >
                        {live.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Legacy routines — active */}
      <SectionCard
        title="Legacy endurance routines"
        subtitle="Pre-unification routines you can still log against. Archive ones you've stopped using — logs stay; routines just hide from the picker. Reversible."
      >
        {activeLegacy.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.55, padding: "8px 0" }}>
            No active legacy routines. Either you never created any, or they're all archived (see below).
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {activeLegacy.map((r) => (
              <LegacyRow
                key={r.id}
                routine={r}
                isPending={isPending}
                onToggleArchive={() => toggleArchive(r.id, true)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Archived legacy routines */}
      {archivedLegacy.length > 0 && (
        <SectionCard
          title={`Archived (${archivedLegacy.length})`}
          subtitle="Restore any routine to bring it back into the routines list and pickers."
        >
          <div style={{ display: "grid", gap: 6 }}>
            {archivedLegacy.map((r) => (
              <LegacyRow
                key={r.id}
                routine={r}
                isPending={isPending}
                onToggleArchive={() => toggleArchive(r.id, false)}
                archived
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Recovery footer */}
      <div style={footerHintStyle}>
        Need to revert the entire endurance unification?
        See <code style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>memory/project_endurance_unification.md</code>
        {" "}for the rollback steps (tag <code style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>checkpoint/pre-endurance-phase-2</code>).
      </div>
    </>
  );
}

function LegacyRow({
  routine,
  isPending,
  onToggleArchive,
  archived = false,
}: {
  routine: SettingsLegacyRoutine;
  isPending: boolean;
  onToggleArchive: () => void;
  archived?: boolean;
}) {
  return (
    <div style={archived ? legacyRowArchivedStyle : legacyRowStyle}>
      <div style={{ display: "grid", gap: 1, flex: 1, minWidth: 0 }}>
        <span style={typeNameStyle}>{routine.name}</span>
        <span style={typeMetaStyle}>
          {routine.logCount} log{routine.logCount === 1 ? "" : "s"}
          {routine.activityTypeName ? ` · mapped to ${routine.activityTypeName}` : routine.subtype ? ` · ${routine.subtype}` : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={onToggleArchive}
        disabled={isPending}
        style={archived ? restoreBtnStyle : archiveBtnStyle}
      >
        {archived ? "Restore" : "Archive"}
      </button>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const familyHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const typeRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const typeNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
};

const typeMetaStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
};

const toggleEnabledStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 999,
  border: "1px solid rgba(74,222,128,0.45)",
  background: "rgba(74,222,128,0.16)",
  color: "rgba(134,239,172,0.98)",
  fontSize: 11.5,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const toggleDisabledStyle: React.CSSProperties = {
  ...toggleEnabledStyle,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.55)",
};

const legacyRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
};

const legacyRowArchivedStyle: React.CSSProperties = {
  ...legacyRowStyle,
  opacity: 0.65,
  background: "rgba(255,255,255,0.01)",
};

const archiveBtnStyle: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 999,
  border: "1px solid rgba(248,113,113,0.32)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(252,165,165,0.95)",
  fontSize: 11.5,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const restoreBtnStyle: React.CSSProperties = {
  ...archiveBtnStyle,
  border: "1px solid rgba(74,222,128,0.45)",
  background: "rgba(74,222,128,0.12)",
  color: "rgba(134,239,172,0.95)",
};

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "8px 12px",
  borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};

const footerHintStyle: React.CSSProperties = {
  fontSize: 11.5,
  opacity: 0.55,
  textAlign: "center",
  padding: "12px 0 4px",
  lineHeight: 1.6,
};
