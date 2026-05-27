"use client";

// Destructive / management actions for a single location. Collapsed by
// default — these aren't day-to-day controls and the visual weight matches
// that. Operations:
//   - Rename location
//   - Change type (gym ↔ crag)
//   - Merge into another location (folds attempts/problems/media into target)
//   - Delete (only when no logs exist; the server enforces this too)
//
// Each destructive action has a confirm step (window.confirm on mobile is
// the native bottom sheet, matches the rest of the app's confirm pattern).

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ClimbLocationType } from "@/lib/climb-types";
import {
  deleteClimbLocationIfEmpty,
  mergeClimbLocations,
  renameClimbLocation,
  updateClimbLocationType,
} from "./actions";

type SiblingLocation = {
  id: string;
  name: string;
  type: ClimbLocationType;
};

export default function LocationDangerZone({
  locationId,
  locationName,
  locationType,
  logCount,
  siblings,
}: {
  locationId: string;
  locationName: string;
  locationType: ClimbLocationType;
  logCount: number;
  siblings: SiblingLocation[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(locationName);
  const [editingName, setEditingName] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const canDelete = logCount === 0;

  function saveName() {
    if (!nameDraft.trim() || nameDraft.trim() === locationName) {
      setEditingName(false);
      setNameDraft(locationName);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await renameClimbLocation({ id: locationId, name: nameDraft });
        setEditingName(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't rename");
      }
    });
  }

  function flipType() {
    const next: ClimbLocationType = locationType === "GYM" ? "CRAG" : "GYM";
    if (!window.confirm(`Change type to ${next === "GYM" ? "Gym" : "Crag"}?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateClimbLocationType({ id: locationId, type: next });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't change type");
      }
    });
  }

  function handleMerge() {
    if (!mergeTargetId) {
      setError("Pick a destination first");
      return;
    }
    const target = siblings.find((s) => s.id === mergeTargetId);
    if (!target) return;
    if (
      !window.confirm(
        `Merge "${locationName}" into "${target.name}"?\n\nAll climbs, problems, and photos at "${locationName}" will be moved over. "${locationName}" will be deleted afterward. This can't be undone.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await mergeClimbLocations({ sourceId: locationId, targetId: mergeTargetId });
        router.push(`/activities/climbing/locations/${result.targetId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Merge failed");
      }
    });
  }

  function handleDelete() {
    if (!canDelete) return;
    if (!window.confirm(`Delete "${locationName}"? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteClimbLocationIfEmpty({ id: locationId });
        router.push("/activities/climbing/map");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={collapsedTriggerStyle}>
        ⚠️ Location management & danger zone →
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={panelHeader}>
        <span>⚠️ Location management</span>
        <button type="button" onClick={() => setOpen(false)} style={closeBtn} aria-label="Collapse">
          ✕
        </button>
      </div>

      {/* Rename */}
      <div style={rowStyle}>
        <div style={labelStyle}>Name</div>
        {editingName ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              style={inputStyle}
              autoFocus
            />
            <button type="button" onClick={saveName} disabled={isPending} style={primaryBtn}>
              {isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingName(false);
                setNameDraft(locationName);
              }}
              style={ghostBtn}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{locationName}</span>
            <button type="button" onClick={() => setEditingName(true)} style={ghostBtn}>
              ✎ Rename
            </button>
          </div>
        )}
      </div>

      {/* Type */}
      <div style={rowStyle}>
        <div style={labelStyle}>Type</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>
            {locationType === "GYM" ? "🏠 Gym (indoor)" : "🪨 Crag (outdoor)"}
          </span>
          <button type="button" onClick={flipType} disabled={isPending} style={ghostBtn}>
            Switch to {locationType === "GYM" ? "Crag" : "Gym"}
          </button>
        </div>
      </div>

      {/* Merge */}
      <div style={rowStyle}>
        <div style={labelStyle}>Merge into another location</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            style={selectStyle}
            disabled={siblings.length === 0}
          >
            <option value="">{siblings.length === 0 ? "No other locations" : "Choose a destination…"}</option>
            {siblings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type === "GYM" ? "🏠" : "🪨"} {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleMerge}
            disabled={isPending || !mergeTargetId}
            style={warnBtn}
          >
            {isPending ? "Merging…" : "Merge"}
          </button>
        </div>
        <div style={hintStyle}>
          All climbs, problems, and photos move to the destination. Problem name collisions concatenate beta notes
          so nothing is lost. This can&apos;t be undone.
        </div>
      </div>

      {/* Delete */}
      <div style={rowStyle}>
        <div style={labelStyle}>Delete location</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={handleDelete} disabled={!canDelete || isPending} style={canDelete ? dangerBtn : disabledBtn}>
            {isPending ? "Deleting…" : "Delete forever"}
          </button>
          <span style={hintStyle}>
            {canDelete
              ? "Available — no climbs are logged here."
              : `${logCount} log${logCount === 1 ? "" : "s"} reference this location. Merge into another spot first.`}
          </span>
        </div>
      </div>

      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const collapsedTriggerStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  background: "transparent",
  border: "1px dashed rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.85)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};

const panelStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 14,
  borderRadius: 12,
  background: "rgba(248,113,113,0.04)",
  border: "1px solid rgba(248,113,113,0.18)",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "rgba(252,165,165,0.95)",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.55)",
  cursor: "pointer",
  fontSize: 14,
  padding: 4,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  opacity: 0.6,
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 600,
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  flex: "1 1 200px",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 600,
  outline: "none",
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.18)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "rgba(255,255,255,0.85)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const warnBtn: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(251,191,36,0.45)",
  background: "rgba(251,191,36,0.12)",
  color: "rgba(251,191,36,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const dangerBtn: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.45)",
  background: "rgba(248,113,113,0.12)",
  color: "rgba(252,165,165,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const disabledBtn: React.CSSProperties = {
  ...dangerBtn,
  opacity: 0.4,
  cursor: "not-allowed",
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  lineHeight: 1.4,
};

const errorStyle: React.CSSProperties = {
  fontSize: 11.5,
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};
