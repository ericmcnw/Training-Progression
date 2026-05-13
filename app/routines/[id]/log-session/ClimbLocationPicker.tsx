"use client";

// Picker for the structured ClimbLocation tied to a logging session.
//
// What this component owns:
//   - Selecting an existing saved location (gym/crag) from a dropdown
//   - Creating a new location with name + type + optional region + optional
//     coords (auto-grabbed from device GPS, with optional Nominatim
//     reverse-geocode to pre-fill the region label)
//
// Why region + coords are here instead of a separate "Location" text field
// in the parent form:
//   - One source of truth — the ClimbLocation library is reusable across
//     every session at that gym/crag. Typing "Bishop, CA" once vs. every
//     log is a real ergonomic win.
//   - Coords mean the location appears on the climbing map immediately,
//     no separate "place on map" step after the fact.

import { useEffect, useState, useTransition } from "react";
import type { ClimbLocationBasic, ClimbLocationType } from "@/lib/climb-types";
import { inputStyle } from "../log/form-ui";

export type NewClimbLocationDraft = {
  name: string;
  type: ClimbLocationType;
  region: string;
  /** When set, persists alongside the new ClimbLocation so it appears on
   *  the map immediately without a separate placement step. */
  latitude: number | null;
  longitude: number | null;
  /** OSM place identity captured from the autocomplete pick — lets the
   *  server dedup against an existing record before creating a new one. */
  osmType: string | null;
  osmId: string | null;
};

type NominatimResult = {
  place_id: number;
  osm_type?: string;
  osm_id?: number | string;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
  };
};

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
  newLocation: NewClimbLocationDraft | null;
  onNewLocation: (loc: NewClimbLocationDraft | null) => void;
}) {
  const [showNew, setShowNew] = useState(
    savedLocations.length === 0 || (newLocation !== null && !selectedId)
  );
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "error">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [nominatimSearching, setNominatimSearching] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const newName = newLocation?.name ?? "";
  useEffect(() => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) { setNominatimResults([]); return; }
    const handle = window.setTimeout(async () => {
      setNominatimSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        if (res.ok) {
          const data: NominatimResult[] = await res.json();
          setNominatimResults(data);
        } else {
          setNominatimResults([]);
        }
      } catch {
        setNominatimResults([]);
      } finally {
        setNominatimSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [newName]);

  const trimmedNewName = newName.trim().toLowerCase();
  const matchingSavedLocations = trimmedNewName.length >= 2
    ? savedLocations.filter((l) => l.name.toLowerCase().includes(trimmedNewName)).slice(0, 5)
    : [];

  // OSM dedup: hide Nominatim suggestions whose place identity is already
  // saved as a ClimbLocation.
  const savedOsmKeys = new Set(
    savedLocations
      .filter((l) => l.osmType && l.osmId)
      .map((l) => `${l.osmType}:${l.osmId}`)
  );
  const filteredNominatimResults = nominatimResults.filter(
    (r) => !savedOsmKeys.has(`${r.osm_type ?? ""}:${r.osm_id ?? ""}`)
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
    onNewLocation(
      newLocation ?? { name: "", type: "GYM", region: "", latitude: null, longitude: null, osmType: null, osmId: null }
    );
    setShowNew(true);
  }

  function patchNew(patch: Partial<NewClimbLocationDraft>) {
    const base: NewClimbLocationDraft = newLocation ?? { name: "", type: "GYM" as ClimbLocationType, region: "", latitude: null, longitude: null, osmType: null, osmId: null };
    onNewLocation({ ...base, ...patch });
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

        // Try to enrich with a region label via OSM Nominatim. This is best-
        // effort — if it fails (rate limit, offline, etc.) we still kept the
        // coords so the location maps correctly. We only auto-fill region if
        // the user hasn't typed one already.
        if (!newLocation?.region?.trim()) {
          startTransition(async () => {
            try {
              const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=10`;
              const res = await fetch(url, { headers: { "Accept-Language": "en" } });
              if (!res.ok) return;
              const data: { address?: { city?: string; town?: string; village?: string; county?: string; state?: string; country_code?: string } } = await res.json();
              const a = data.address ?? {};
              const place = a.city || a.town || a.village || a.county;
              const stateCode = a.state;
              const region = [place, stateCode].filter(Boolean).join(", ");
              if (region) patchNew({ region });
            } catch {
              // best-effort, ignore
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
                <option key={loc.id} value={loc.id}>{labelFor(loc)}</option>
              ))}
            </optgroup>
          )}
          {crags.length > 0 && (
            <optgroup label="Crags / Outdoor">
              {crags.map((loc) => (
                <option key={loc.id} value={loc.id}>{labelFor(loc)}</option>
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

          {/* Name + Type with autocomplete suggestions */}
          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Name (e.g. Movement RiNo, Buttermilks)"
              value={newLocation?.name ?? ""}
              onChange={(e) => { patchNew({ name: e.target.value }); setSuggestionsOpen(true); }}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 150)}
            />
            <div style={typeToggleStyle}>
              {(["GYM", "CRAG"] as ClimbLocationType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => patchNew({ type: t })}
                  style={typeToggleBtnStyle(newLocation?.type === t || (!newLocation?.type && t === "GYM"))}
                >
                  {t === "GYM" ? "Gym" : "Crag"}
                </button>
              ))}
            </div>
            {suggestionsOpen && (matchingSavedLocations.length > 0 || nominatimResults.length > 0 || nominatimSearching) && (
              <div style={suggestionsPanel}>
                {matchingSavedLocations.length > 0 && (
                  <>
                    <div style={suggestionGroupLabel}>Already saved</div>
                    {matchingSavedLocations.map((l) => (
                      <button
                        key={`saved-${l.id}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onSelectId(l.id);
                          onNewLocation(null);
                          setShowNew(false);
                          setSuggestionsOpen(false);
                        }}
                        style={suggestionItem}
                        title={l.region ? `${l.name} · ${l.region}` : l.name}
                      >
                        💾 {l.name}
                        {l.region ? <span style={suggestionMeta}> · {l.region}</span> : null}
                        <span style={suggestionMeta}> · {l.type === "GYM" ? "Gym" : "Crag"}</span>
                      </button>
                    ))}
                  </>
                )}
                {filteredNominatimResults.length > 0 && (
                  <>
                    <div style={suggestionGroupLabel}>From OpenStreetMap</div>
                    {filteredNominatimResults.map((r) => (
                      <button
                        key={`osm-${r.place_id}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const lat = parseFloat(r.lat);
                          const lng = parseFloat(r.lon);
                          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                          const primaryName = r.display_name.split(",")[0].trim();
                          const a = r.address ?? {};
                          const place = a.city || a.town || a.village || a.county;
                          const region = [place, a.state].filter(Boolean).join(", ");
                          patchNew({
                            name: primaryName,
                            latitude: lat,
                            longitude: lng,
                            region: newLocation?.region?.trim() || region,
                            osmType: r.osm_type ?? null,
                            osmId: r.osm_id != null ? String(r.osm_id) : null,
                          });
                          setSuggestionsOpen(false);
                        }}
                        style={suggestionItem}
                        title={r.display_name}
                      >
                        📍 {r.display_name}
                      </button>
                    ))}
                  </>
                )}
                {nominatimSearching && (
                  <div style={suggestionHint}>Searching OpenStreetMap…</div>
                )}
              </div>
            )}
          </div>

          {/* Region — optional broader context */}
          <input
            style={inputStyle}
            placeholder="Region (City, State — e.g. Bishop, CA)"
            value={newLocation?.region ?? ""}
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
            {newLocation?.latitude != null && newLocation?.longitude != null && (
              <span style={geoConfirmStyle}>
                ✓ {newLocation.latitude.toFixed(4)}, {newLocation.longitude.toFixed(4)}
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
          {newLocation?.latitude != null && (
            <div style={{ fontSize: 11, opacity: 0.55 }}>
              This pin will appear on your climbing map as soon as you save the session.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function labelFor(loc: ClimbLocationBasic): string {
  return loc.region ? `${loc.name} · ${loc.region}` : loc.name;
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

const suggestionsPanel: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 20,
  background: "rgba(15,23,42,0.98)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: 4,
  display: "grid",
  gap: 2,
  maxHeight: 260,
  overflowY: "auto",
  boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
};

const suggestionGroupLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
  padding: "6px 8px 2px",
};

const suggestionItem: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 7,
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.92)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  width: "100%",
};

const suggestionMeta: React.CSSProperties = {
  opacity: 0.55,
  fontWeight: 500,
};

const suggestionHint: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  padding: "6px 8px",
};
