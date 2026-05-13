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

import { useEffect, useState, useTransition } from "react";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import {
  type ActivitySpotConfig,
  type NewActivitySpotDraft,
  type SpotPickerItem,
  type SpotSelection,
} from "@/lib/activity-spots";

type NominatimResult = {
  place_id: number;
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

const NEW_OPTION = "__new__";
const NONE_OPTION = "";

function optionValueFor(item: SpotPickerItem): string {
  // Encode kind so we can decode on change without an O(n) lookup.
  return `${item.kind}:${item.id}`;
}

function decodeOptionValue(value: string): SpotSelection | null {
  if (value === NEW_OPTION || value === NONE_OPTION) return null;
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if ((kind === "activitySpot" || kind === "climbLocation") && id) {
    return { kind, id };
  }
  return null;
}

function valueForSelection(sel: SpotSelection | null): string {
  if (!sel) return NONE_OPTION;
  return `${sel.kind}:${sel.id}`;
}

export default function ActivitySpotPicker({
  config,
  savedSpots,
  selected,
  onSelect,
  newSpot,
  onNewSpot,
}: {
  config: ActivitySpotConfig;
  savedSpots: SpotPickerItem[];
  selected: SpotSelection | null;
  onSelect: (sel: SpotSelection | null) => void;
  newSpot: NewActivitySpotDraft | null;
  onNewSpot: (s: NewActivitySpotDraft | null) => void;
}) {
  const [showNew, setShowNew] = useState(
    savedSpots.length === 0 || (newSpot !== null && !selected)
  );
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "error">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [nominatimSearching, setNominatimSearching] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // Debounced OpenStreetMap search as the user types in the new-spot name
  // input. Surfaces towns/parks/streets/POIs so the user doesn't have to
  // know exact coords or even the exact name.
  const newName = newSpot?.name ?? "";
  useEffect(() => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      setNominatimResults([]);
      return;
    }
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

  const defaultType = config.spotTypes[0]?.value ?? null;
  const ownSpots = savedSpots.filter((s) => s.isOwnActivity);
  const crossSpots = savedSpots.filter((s) => !s.isOwnActivity);

  // Saved-spot matches against the typed name — surfaced above Nominatim
  // hits so the user re-uses an existing record instead of duplicating.
  const trimmedNewName = newName.trim().toLowerCase();
  const matchingSavedSpots = trimmedNewName.length >= 2
    ? savedSpots.filter((s) => s.name.toLowerCase().includes(trimmedNewName)).slice(0, 5)
    : [];

  function selectExisting(value: string) {
    const decoded = decodeOptionValue(value);
    if (!decoded) return;
    onSelect(decoded);
    onNewSpot(null);
    setShowNew(false);
  }

  function activateNew() {
    onSelect(null);
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
          value={showNew ? NEW_OPTION : valueForSelection(selected)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === NEW_OPTION) {
              activateNew();
            } else if (v === NONE_OPTION) {
              onSelect(null);
              onNewSpot(null);
              setShowNew(false);
            } else {
              selectExisting(v);
            }
          }}
        >
          <option value={NONE_OPTION}>No {config.spotNoun}</option>
          {ownSpots.length > 0 && (
            <optgroup label={`Your ${config.spotNoun}s`}>
              {ownSpots.map((spot) => (
                <option key={optionValueFor(spot)} value={optionValueFor(spot)}>
                  {labelFor(spot, false)}
                </option>
              ))}
            </optgroup>
          )}
          {crossSpots.length > 0 && (
            <optgroup label="From other activities">
              {crossSpots.map((spot) => (
                <option key={optionValueFor(spot)} value={optionValueFor(spot)}>
                  {labelFor(spot, true)}
                </option>
              ))}
            </optgroup>
          )}
          <option value={NEW_OPTION}>+ Add new {config.spotNoun}…</option>
        </select>
      )}

      {(showNew || savedSpots.length === 0) && (
        <div style={{ display: "grid", gap: 8 }}>
          {savedSpots.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              No saved {config.spotNoun}s yet. Add one to track where you trained.
            </div>
          )}

          {/* Name input with autocomplete — shows matching saved spots
              first so the user can re-use, then OpenStreetMap suggestions
              for towns/parks/streets/etc. with auto-filled coords. */}
          <div style={{ position: "relative" }}>
            <input
              style={inputStyle}
              placeholder={`Name (e.g. ${exampleNameFor(config.spotNoun)})`}
              value={newSpot?.name ?? ""}
              onChange={(e) => { patchNew({ name: e.target.value }); setSuggestionsOpen(true); }}
              onFocus={() => setSuggestionsOpen(true)}
              // Delay close so a click on a suggestion can register before
              // the dropdown unmounts.
              onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 150)}
            />
            {suggestionsOpen && (matchingSavedSpots.length > 0 || nominatimResults.length > 0 || nominatimSearching) && (
              <div style={suggestionsPanel}>
                {matchingSavedSpots.length > 0 && (
                  <>
                    <div style={suggestionGroupLabel}>Already saved</div>
                    {matchingSavedSpots.map((s) => (
                      <button
                        key={`saved-${s.kind}-${s.id}`}
                        type="button"
                        // onMouseDown fires before onBlur, so we still have
                        // the click target when blur tries to close us.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          onSelect({ kind: s.kind, id: s.id });
                          onNewSpot(null);
                          setShowNew(false);
                          setSuggestionsOpen(false);
                        }}
                        style={suggestionItem}
                        title={s.region ? `${s.name} · ${s.region}` : s.name}
                      >
                        💾 {s.name}
                        {s.region ? <span style={suggestionMeta}> · {s.region}</span> : null}
                        {!s.isOwnActivity ? <span style={suggestionMeta}> · from {s.originLabel}</span> : null}
                      </button>
                    ))}
                  </>
                )}
                {nominatimResults.length > 0 && (
                  <>
                    <div style={suggestionGroupLabel}>From OpenStreetMap</div>
                    {nominatimResults.map((r) => (
                      <button
                        key={`osm-${r.place_id}`}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const lat = parseFloat(r.lat);
                          const lng = parseFloat(r.lon);
                          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                          // Trim to first comma-segment so "Paugussett State Forest, Connecticut, USA"
                          // becomes just "Paugussett State Forest" as the spot name.
                          const primaryName = r.display_name.split(",")[0].trim();
                          const a = r.address ?? {};
                          const place = a.city || a.town || a.village || a.county;
                          const region = [place, a.state].filter(Boolean).join(", ");
                          patchNew({
                            name: primaryName,
                            latitude: lat,
                            longitude: lng,
                            region: newSpot?.region?.trim() || region,
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

function labelFor(spot: SpotPickerItem, includeOriginTag: boolean): string {
  const region = spot.region ? ` · ${spot.region}` : "";
  const origin = includeOriginTag ? ` · from ${spot.originLabel}` : "";
  return `${spot.name}${region}${origin}`;
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
