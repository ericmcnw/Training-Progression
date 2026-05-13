"use client";

// Generic picker for the ActivitySpot library, used by non-climbing log
// forms (sport sessions, outdoor cardio). Counterpart to ClimbLocationPicker
// — same UX patterns (dropdown of saved spots, in-line "add new" form,
// optional GPS button, optional reverse-geocode region) but works against
// the ActivitySpot model and the per-activity spot config.
//
// When a new spot is created here, it persists with whatever coords the
// user supplied (if any), so it appears on /activities/[slug]/map
// immediately after the session is saved — no separate "place on map"
// step needed.

import { useState, useTransition } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import {
  type ActivitySpotBasic,
  type ActivitySpotConfig,
  type NewActivitySpotDraft,
} from "@/lib/activity-spots";

export default function ActivitySpotPicker({
  config,
  savedSpots,
  selectedId,
  onSelectId,
  newSpot,
  onNewSpot,
}: {
  config: ActivitySpotConfig;
  savedSpots: ActivitySpotBasic[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  newSpot: NewActivitySpotDraft | null;
  onNewSpot: (s: NewActivitySpotDraft | null) => void;
}) {
  const [showNew, setShowNew] = useState(
    savedSpots.length === 0 || (newSpot !== null && !selectedId)
  );
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "error">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const defaultType = config.spotTypes[0]?.value ?? null;

  function selectExisting(id: string) {
    onSelectId(id);
    onNewSpot(null);
    setShowNew(false);
  }

  function activateNew() {
    onSelectId(null);
    onNewSpot(
      newSpot ?? { name: "", type: defaultType, region: "", latitude: null, longitude: null }
    );
    setShowNew(true);
  }

  function patchNew(patch: Partial<NewActivitySpotDraft>) {
    const base: NewActivitySpotDraft = newSpot ?? {
      name: "",
      type: defaultType,
      region: "",
      latitude: null,
      longitude: null,
    };
    onNewSpot({ ...base, ...patch });
  }

  function handleUseMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("error");
      setGeoError("This browser doesn't expose location.");
      return;
    }
    setGeoStatus("locating");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        patchNew({ latitude: lat, longitude: lng });
        setGeoStatus("idle");

        // Best-effort reverse-geocode for region label. Same Nominatim flow
        // as ClimbLocationPicker. Only fills region when empty so we never
        // clobber the user's typed input.
        if (!newSpot?.region?.trim()) {
          startTransition(async () => {
            try {
              const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=10`;
              const res = await fetch(url, { headers: { "Accept-Language": "en" } });
              if (!res.ok) return;
              const data: { address?: { city?: string; town?: string; village?: string; county?: string; state?: string } } = await res.json();
              const a = data.address ?? {};
              const place = a.city || a.town || a.village || a.county;
              const stateCode = a.state;
              const region = [place, stateCode].filter(Boolean).join(", ");
              if (region) patchNew({ region });
            } catch {
              // ignore — coords still saved
            }
          });
        }
      },
      (err) => {
        setGeoStatus("error");
        setGeoError(err.code === err.PERMISSION_DENIED
          ? "Location permission denied. You can still type a name and region manually."
          : "Couldn't get your location. Try again or type the region manually.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const hasTypes = config.spotTypes.length > 0;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {savedSpots.length > 0 && (
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={showNew ? "__new__" : (selectedId ?? "")}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              activateNew();
            } else if (e.target.value === "") {
              onSelectId(null);
              onNewSpot(null);
              setShowNew(false);
            } else {
              selectExisting(e.target.value);
            }
          }}
        >
          <option value="">No {config.spotNoun}</option>
          {savedSpots.map((spot) => (
            <option key={spot.id} value={spot.id}>{labelFor(spot)}</option>
          ))}
          <option value="__new__">+ Add new {config.spotNoun}…</option>
        </select>
      )}

      {(showNew || savedSpots.length === 0) && (
        <div style={{ display: "grid", gap: 8 }}>
          {savedSpots.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              No saved {config.spotNoun}s yet. Add one to track where you trained.
            </div>
          )}

          {/* Name (and inline type buttons when the activity has them) */}
          <input
            style={inputStyle}
            placeholder={`Name (e.g. ${exampleNameFor(config.spotNoun)})`}
            value={newSpot?.name ?? ""}
            onChange={(e) => patchNew({ name: e.target.value })}
          />

          {hasTypes && (
            <div style={typeRowStyle}>
              {config.spotTypes.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => patchNew({ type: t.value })}
                  style={(newSpot?.type ?? defaultType) === t.value ? typeBtnActive(t.pinColor) : typeBtnStyle}
                >
                  {t.emoji ? `${t.emoji} ` : ""}{t.label}
                </button>
              ))}
            </div>
          )}

          {/* Region — optional broader area */}
          <input
            style={inputStyle}
            placeholder="Region (City, State — optional)"
            value={newSpot?.region ?? ""}
            onChange={(e) => patchNew({ region: e.target.value })}
          />

          {/* GPS row */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={geoStatus === "locating"}
              style={geoBtnStyle}
            >
              {geoStatus === "locating" ? "📍 Getting location…" : "📍 Use my location"}
            </button>
            {newSpot?.latitude != null && newSpot?.longitude != null && (
              <span style={geoConfirmStyle}>
                ✓ {newSpot.latitude.toFixed(4)}, {newSpot.longitude.toFixed(4)}
                <button
                  type="button"
                  onClick={() => patchNew({ latitude: null, longitude: null })}
                  style={geoClearBtnStyle}
                  aria-label="Clear coords"
                  title="Clear coords"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          {geoStatus === "error" && geoError && (
            <div style={geoErrorStyle}>{geoError}</div>
          )}
          {newSpot?.latitude != null && (
            <div style={{ fontSize: 11, opacity: 0.55 }}>
              This pin will appear on your activity map after you save the session.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function labelFor(spot: ActivitySpotBasic): string {
  if (spot.region) return `${spot.name} · ${spot.region}`;
  return spot.name;
}

function exampleNameFor(noun: string): string {
  switch (noun) {
    case "court": return "LA Fitness #4 court";
    case "trail": return "Buttermilks Approach";
    case "course": return "Pebble Beach";
    case "spot": return "Pipeline";
    case "mountain": return "Mammoth";
    case "park": return "Volcom Skatepark";
    case "route": return "Cherry Creek Loop";
    default: return "Spot name";
  }
}

const typeRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const typeBtnStyle: React.CSSProperties = {
  flex: "1 1 90px",
  padding: "8px 10px",
  borderRadius: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

function typeBtnActive(color: string): React.CSSProperties {
  return {
    ...typeBtnStyle,
    background: color.replace("0.95)", "0.18)"),
    borderColor: color.replace("0.95)", "0.55)"),
    color: color.replace("0.95)", "1)"),
  };
}

const geoBtnStyle: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.4)",
  background: "rgba(120,190,255,0.12)",
  color: "rgba(191,219,254,0.98)",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const geoConfirmStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(74,222,128,0.95)",
  padding: "6px 10px",
  borderRadius: 8,
  background: "rgba(74,222,128,0.08)",
  border: "1px solid rgba(74,222,128,0.28)",
};

const geoClearBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  opacity: 0.65,
  fontSize: 11,
  padding: 0,
  marginLeft: 2,
};

const geoErrorStyle: React.CSSProperties = {
  fontSize: 11.5,
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};
