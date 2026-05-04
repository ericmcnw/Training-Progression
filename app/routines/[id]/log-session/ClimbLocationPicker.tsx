"use client";

import { useState } from "react";
import type { ClimbLocationBasic, ClimbLocationType } from "@/lib/climb-types";
import { inputStyle } from "../log/form-ui";

export default function ClimbLocationPicker({
  savedLocations,
  selectedId,
  onSelectId,
  newLocation,
  onNewLocation,
}: {
  savedLocations: ClimbLocationBasic[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  newLocation: { name: string; type: ClimbLocationType } | null;
  onNewLocation: (loc: { name: string; type: ClimbLocationType } | null) => void;
}) {
  const [showNew, setShowNew] = useState(
    savedLocations.length === 0 || (newLocation !== null && !selectedId)
  );

  const gyms = savedLocations.filter((l) => l.type === "GYM");
  const crags = savedLocations.filter((l) => l.type === "CRAG");

  function selectExisting(id: string) {
    onSelectId(id);
    onNewLocation(null);
    setShowNew(false);
  }

  function activateNew() {
    onSelectId(null);
    onNewLocation(newLocation ?? { name: "", type: "GYM" });
    setShowNew(true);
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {savedLocations.length > 0 && (
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={showNew ? "__new__" : (selectedId ?? "")}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              activateNew();
            } else if (e.target.value === "") {
              onSelectId(null);
              onNewLocation(null);
              setShowNew(false);
            } else {
              selectExisting(e.target.value);
            }
          }}
        >
          <option value="">No location</option>
          {gyms.length > 0 && (
            <optgroup label="Gyms">
              {gyms.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </optgroup>
          )}
          {crags.length > 0 && (
            <optgroup label="Crags / Outdoor">
              {crags.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </optgroup>
          )}
          <option value="__new__">+ Add new location…</option>
        </select>
      )}

      {(showNew || savedLocations.length === 0) && (
        <div style={{ display: "grid", gap: 8 }}>
          {savedLocations.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              No saved locations yet. Add one to track which gym or crag you climbed at.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="e.g. Movement RiNo, Eldorado Canyon…"
              value={newLocation?.name ?? ""}
              onChange={(e) =>
                onNewLocation({ name: e.target.value, type: newLocation?.type ?? "GYM" })
              }
            />
            <div style={typeToggleStyle}>
              {(["GYM", "CRAG"] as ClimbLocationType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onNewLocation({ name: newLocation?.name ?? "", type: t })}
                  style={typeToggleBtnStyle(newLocation?.type === t || (!newLocation?.type && t === "GYM"))}
                >
                  {t === "GYM" ? "Gym" : "Crag"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const typeToggleStyle: React.CSSProperties = {
  display: "flex",
  border: "1px solid rgba(128,128,128,0.5)",
  borderRadius: 10,
  overflow: "hidden",
  flexShrink: 0,
};

function typeToggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0 14px",
    height: "100%",
    border: "none",
    background: active ? "rgba(120,190,255,0.2)" : "transparent",
    color: active ? "rgba(120,190,255,1)" : "rgba(255,255,255,0.55)",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  };
}
