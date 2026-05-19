"use client";

// Unified spot picker for every log type that records "where it happened."
//
// Replaces the old ActivitySpotPicker + ClimbLocationPicker. One search input
// surfaces three result sources in a single dropdown:
//   1. saved spots — the user's own + cross-activity (e.g. a crag for a
//      trail run there). Matches against name.
//   2. OpenStreetMap — Nominatim autocomplete for unknown places, with
//      OSM-identity dedup against saved spots already in the list.
//   3. create-new — always present as the last row. Falls back when the
//      user is naming a place that doesn't exist anywhere.
//
// Collapsed by default — a single "Add location" affordance keeps the
// log form clean. Expands when tapped; collapses to a chip when a spot
// is picked. The chip tap re-opens the picker for changes.
//
// The picker is domain-neutral in its output. The parent form decides
// whether a "new" spot routes to ActivitySpot or ClimbLocation based on
// its own context (climbing routine vs everything else).

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { COLOR, RADIUS, SHADOW, withAlpha } from "@/lib/design-tokens";
import type {
  ActivitySpotConfig,
  SpotPickerItem,
} from "@/lib/activity-spots";

// Value shape lives in lib/spot-picker-types so log-draft can reference
// it without depending on this React component module.
export type {
  SpotPickerSavedRef,
  SpotPickerNewDraft,
  SpotPickerValue,
} from "@/lib/spot-picker-types";
import type { SpotPickerSavedRef, SpotPickerValue, SpotPickerNewDraft } from "@/lib/spot-picker-types";

// ── Component ─────────────────────────────────────────────────────────────

type RecentSpot = {
  ref: SpotPickerSavedRef;
  name: string;
  region: string | null;
};

export default function SpotPicker({
  config,
  spotNoun,
  savedSpots,
  recentSpots = [],
  value,
  onChange,
  startOpen = false,
}: {
  /** Per-activity config — controls type options + label.
   *  Pass null for climbing (which uses its own GYM/CRAG options below). */
  config: ActivitySpotConfig | null;
  /** Singular noun for what we're picking ("gym", "trail", "spot"). */
  spotNoun: string;
  /** Saved spots already loaded with the form (typically from log-data). */
  savedSpots: SpotPickerItem[];
  /** Recent spots for quick-tap chips. Optional. */
  recentSpots?: RecentSpot[];
  value: SpotPickerValue;
  onChange: (next: SpotPickerValue) => void;
  /** When true, opens directly into the expanded picker on mount instead
   *  of starting collapsed. Useful for surfaces where the spot is the
   *  primary input. Default false = start collapsed (chip if value set,
   *  "Add" affordance otherwise). */
  startOpen?: boolean;
}) {
  // The picker is collapsed by default. A value set with the picker closed
  // shows the chip; no value shows the "Add" affordance.
  const [opened, setOpened] = useState(startOpen);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // When true, the search input renders above the confirmation card —
  // lets the user pick a different spot without clearing the current one
  // first. Triggered by the "Search again" button on the confirmation card.
  const [searchOverlay, setSearchOverlay] = useState(false);
  const [osmResults, setOsmResults] = useState<OsmResult[]>([]);
  const [osmSearching, setOsmSearching] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "locating" | "error">("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [customEditingCoords, setCustomEditingCoords] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Whether to show the inline expansion for editing a "new" spot's
  // optional fields (type buttons, region, GPS). Always shown for source
  // = custom (so the user can opt to add coords); always shown for OSM
  // when the config has types to choose.
  const isNewValue = value?.kind === "new";
  const showInlineExpand = isNewValue && (value.draft.source === "custom" || hasTypeOptions(config));

  // OSM autocomplete for the typed query. Mirrors the debounce pattern
  // from the old pickers.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setOsmResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setOsmSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=5&addressdetails=1`;
        // Browser fetch sets its own User-Agent (which Nominatim requires);
        // overriding it from client code is silently ignored on most browsers
        // and forces a CORS preflight on the rest. Leave it alone.
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        if (res.ok) {
          const data: OsmResult[] = await res.json();
          setOsmResults(data);
        } else {
          setOsmResults([]);
        }
      } catch {
        setOsmResults([]);
      } finally {
        setOsmSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [query]);

  // Saved-spot matches: case-insensitive substring on name, top 6.
  const matchedSaved = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) return [] as SpotPickerItem[];
    return savedSpots
      .filter((s) => s.name.toLowerCase().includes(trimmed))
      .slice(0, 6);
  }, [query, savedSpots]);

  // Filter OSM results: skip places whose OSM identity is already a saved
  // spot (the saved row covers it; showing OSM duplicate just adds noise).
  const savedOsmKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of savedSpots) {
      if (s.osmType && s.osmId) set.add(`${s.osmType}:${s.osmId}`);
    }
    return set;
  }, [savedSpots]);
  const filteredOsm = useMemo(() => {
    return osmResults.filter((r) => !savedOsmKeys.has(`${r.osm_type ?? ""}:${r.osm_id ?? ""}`));
  }, [osmResults, savedOsmKeys]);

  // Recent chips minus the currently-selected saved spot — avoids
  // showing the user's current pick twice when the picker is expanded
  // alongside a confirmation card.
  const filteredRecentSpots = useMemo(() => {
    if (value?.kind !== "saved") return recentSpots;
    const currentKey = `${value.ref.kind}:${value.ref.id}`;
    return recentSpots.filter((r) => `${r.ref.kind}:${r.ref.id}` !== currentKey);
  }, [recentSpots, value]);

  // Show the "Save as new" row unless the typed text exactly matches a
  // saved spot's name (case-insensitive) — exact dupes would route to
  // the existing record server-side anyway, so the UI shouldn't offer
  // both paths.
  const trimmedQuery = query.trim();
  const exactSavedMatch = trimmedQuery.length > 0 && savedSpots.some(
    (s) => s.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCreateRow = trimmedQuery.length >= 2 && !exactSavedMatch;

  // ── Collapsed states ────────────────────────────────────────────────────

  if (value === null && !opened) {
    return (
      <button
        type="button"
        style={addButtonStyle}
        onClick={() => {
          setOpened(true);
          setDropdownOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <span aria-hidden="true">📍</span>
        <span>Add {spotNoun}</span>
      </button>
    );
  }

  if (value !== null && !opened) {
    return (
      <div style={chipRowStyle}>
        <button
          type="button"
          style={chipStyle}
          onClick={() => {
            setOpened(true);
            setQuery("");
            setDropdownOpen(false);
            // Re-opening with a value goes to confirmation card, not
            // the search input — reset any leftover overlay state.
            setSearchOverlay(false);
          }}
          title="Change"
        >
          <span aria-hidden="true">📍</span>
          <span style={chipNameStyle}>{displayNameOf(value)}</span>
          {displayRegionOf(value) && (
            <span style={chipRegionStyle}>· {displayRegionOf(value)}</span>
          )}
          <span style={chipEditHint} aria-hidden="true">✎</span>
        </button>
        <button
          type="button"
          style={chipClearStyle}
          aria-label={`Clear ${spotNoun}`}
          title="Clear"
          onClick={() => {
            onChange(null);
            setQuery("");
            setCustomEditingCoords(false);
            setGeoStatus("idle");
            setGeoError(null);
            setSearchOverlay(false);
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  // ── Expanded picker ─────────────────────────────────────────────────────

  function handleSelectSaved(item: SpotPickerItem) {
    onChange({
      kind: "saved",
      ref: { kind: item.kind, id: item.id },
      display: { name: item.name, region: item.region },
    });
    setQuery("");
    setDropdownOpen(false);
    setSearchOverlay(false);
    // Saved picks are "done" — collapse to chip so the user can move on.
    setOpened(false);
  }

  function handleSelectOsm(r: OsmResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const primaryName = r.display_name.split(",")[0].trim();
    const a = r.address ?? {};
    const place = a.city || a.town || a.village || a.county;
    const region = [place, a.state].filter(Boolean).join(", ") || null;
    const defaultType = config?.spotTypes[0]?.value ?? null;
    onChange({
      kind: "new",
      draft: {
        source: "osm",
        name: primaryName,
        type: defaultType,
        region,
        latitude: lat,
        longitude: lng,
        osmType: r.osm_type ?? null,
        osmId: r.osm_id != null ? String(r.osm_id) : null,
      },
    });
    setQuery("");
    setDropdownOpen(false);
    setSearchOverlay(false);
  }

  function handleSelectCreate() {
    const name = trimmedQuery;
    if (!name) return;
    const defaultType = config?.spotTypes[0]?.value ?? null;
    onChange({
      kind: "new",
      draft: {
        source: "custom",
        name,
        type: defaultType,
        region: null,
        latitude: null,
        longitude: null,
        osmType: null,
        osmId: null,
      },
    });
    setQuery("");
    setDropdownOpen(false);
    setSearchOverlay(false);
  }

  function handlePickRecent(ref: SpotPickerSavedRef, display: { name: string; region: string | null }) {
    onChange({ kind: "saved", ref, display });
    setOpened(false);
    setSearchOverlay(false);
  }

  function patchDraft(patch: Partial<SpotPickerNewDraft>) {
    if (value?.kind !== "new") return;
    onChange({ kind: "new", draft: { ...value.draft, ...patch } });
  }

  function clearAndReset() {
    onChange(null);
    setQuery("");
    setOpened(false);
    setDropdownOpen(false);
    setSearchOverlay(false);
    setCustomEditingCoords(false);
    setGeoStatus("idle");
    setGeoError(null);
  }

  function handleUseMyLocation() {
    if (value?.kind !== "new") return;
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
        patchDraft({ latitude: lat, longitude: lng });
        setGeoStatus("idle");
        if (value.kind === "new" && !value.draft.region) {
          startTransition(async () => {
            try {
              const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=10`;
              const res = await fetch(url, { headers: { "Accept-Language": "en" } });
              if (!res.ok) return;
              const data: { address?: { city?: string; town?: string; village?: string; county?: string; state?: string } } = await res.json();
              const a = data.address ?? {};
              const place = a.city || a.town || a.village || a.county;
              const region = [place, a.state].filter(Boolean).join(", ");
              if (region) patchDraft({ region });
            } catch {
              // Coords still saved; reverse geocode is best-effort.
            }
          });
        }
      },
      (err) => {
        setGeoStatus("error");
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. You can still type a region manually."
            : "Couldn't get your location. Try again or type the region manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const dropdownVisible = dropdownOpen && (
    matchedSaved.length > 0 || filteredOsm.length > 0 || showCreateRow || osmSearching
  );

  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>
        <span style={panelLabelStyle}>
          {value?.kind === "new" ? "New " : ""}
          {capitalize(spotNoun)}
        </span>
        <button
          type="button"
          style={panelCollapseStyle}
          aria-label="Close"
          title="Close"
          onClick={() => {
            // Closing without a value should collapse back to the "Add"
            // affordance. With a value, collapse to the chip. Reset all
            // search-related state so the next open starts clean.
            setOpened(false);
            setQuery("");
            setDropdownOpen(false);
            setSearchOverlay(false);
          }}
        >
          ✕
        </button>
      </div>

      {/* Recent chips — shown alongside the search input whenever the
          search UI is visible (initial entry OR "Search again" overlay).
          The filter strips the currently-selected saved spot so it doesn't
          appear as a quick-swap target for itself. */}
      {filteredRecentSpots.length > 0 && (value === null || searchOverlay) && (
        <div style={recentRowStyle}>
          <span style={recentLabelStyle}>Recent</span>
          <div style={recentChipsStyle}>
            {filteredRecentSpots.slice(0, 5).map((r) => (
              <button
                key={`${r.ref.kind}:${r.ref.id}`}
                type="button"
                style={recentChipStyle}
                onClick={() => handlePickRecent(r.ref, { name: r.name, region: r.region })}
                title={r.region ? `${r.name} · ${r.region}` : r.name}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search input — shown when no value is selected OR when the user
          taps "Search again" on the confirmation card to swap to a
          different spot without clearing the current one first. */}
      {(value === null || searchOverlay) && (
        <div style={searchWrapStyle}>
          <input
            ref={inputRef}
            style={searchInputStyle}
            type="text"
            placeholder={`Search saved ${spotNoun}s, places, or type a name…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => window.setTimeout(() => setDropdownOpen(false), 160)}
          />

          {dropdownVisible && (
            <div style={dropdownStyle}>
              {matchedSaved.length > 0 && (
                <>
                  <div style={dropdownGroupLabel}>Your {spotNoun}s</div>
                  {matchedSaved.map((s) => (
                    <button
                      key={`saved-${s.kind}-${s.id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSaved(s);
                      }}
                      style={dropdownItemStyle}
                      title={savedSpotTitle(s)}
                    >
                      <span aria-hidden="true">💾</span>
                      <span style={dropdownItemMain}>{s.name}</span>
                      {s.region && <span style={dropdownItemMeta}>· {s.region}</span>}
                      {!s.isOwnActivity && (
                        <span style={dropdownItemMeta}>· from {s.originLabel}</span>
                      )}
                    </button>
                  ))}
                </>
              )}

              {filteredOsm.length > 0 && (
                <>
                  <div style={dropdownGroupLabel}>OpenStreetMap</div>
                  {filteredOsm.map((r) => (
                    <button
                      key={`osm-${r.place_id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectOsm(r);
                      }}
                      style={dropdownItemStyle}
                      title={r.display_name}
                    >
                      <span aria-hidden="true">📍</span>
                      <span style={dropdownItemMain}>{r.display_name}</span>
                    </button>
                  ))}
                </>
              )}

              {showCreateRow && (
                <>
                  {(matchedSaved.length > 0 || filteredOsm.length > 0) && (
                    <div style={dropdownDividerStyle} />
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectCreate();
                    }}
                    style={dropdownCreateStyle}
                  >
                    <span aria-hidden="true">✏️</span>
                    <span style={dropdownItemMain}>Save &ldquo;{trimmedQuery}&rdquo; as a new {spotNoun}</span>
                  </button>
                </>
              )}

              {osmSearching && filteredOsm.length === 0 && matchedSaved.length === 0 && !showCreateRow && (
                <div style={dropdownHintStyle}>Searching OpenStreetMap…</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation card — shown when a value is selected and the
          picker is expanded. Lets the user see what they picked and
          edit optional fields on a new spot. */}
      {value !== null && (
        <div style={confirmCardStyle}>
          <div style={confirmHeadStyle}>
            <div style={confirmTitleStyle}>
              <span aria-hidden="true">{value.kind === "saved" ? "💾" : value.kind === "new" && value.draft.source === "osm" ? "📍" : "✏️"}</span>
              <span style={confirmNameStyle}>{displayNameOf(value)}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  setSearchOverlay(true);
                  setQuery("");
                  setDropdownOpen(true);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
                style={confirmActionBtnStyle}
                title="Search for a different spot without clearing this one"
              >
                Search again
              </button>
              <button
                type="button"
                onClick={clearAndReset}
                style={confirmClearStyle}
                aria-label={`Clear ${spotNoun}`}
                title="Clear this spot"
              >
                ✕
              </button>
            </div>
          </div>

          {displayRegionOf(value) && (
            <div style={confirmMetaStyle}>{displayRegionOf(value)}</div>
          )}

          {/* New-spot inline fields — type buttons, region, GPS coords */}
          {value.kind === "new" && showInlineExpand && (
            <div style={inlineFieldsStyle}>
              {hasTypeOptions(config) && (
                <div style={typeButtonsRowStyle}>
                  {config!.spotTypes.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      style={value.draft.type === t.value ? typeButtonActive(t.pinColor) : typeButtonStyle}
                      onClick={() => patchDraft({ type: t.value })}
                    >
                      {t.emoji ? `${t.emoji} ` : ""}{t.label}
                    </button>
                  ))}
                </div>
              )}

              <input
                style={smallInputStyle}
                placeholder="Region (City, State — optional)"
                value={value.draft.region ?? ""}
                onChange={(e) => patchDraft({ region: e.target.value || null })}
              />

              <div style={coordsRowStyle}>
                {value.draft.latitude != null && value.draft.longitude != null && !customEditingCoords ? (
                  <span style={coordsConfirmStyle}>
                    📍 {value.draft.latitude.toFixed(4)}, {value.draft.longitude.toFixed(4)}
                    <button
                      type="button"
                      style={coordsActionBtnStyle}
                      onClick={() => setCustomEditingCoords(true)}
                      title="Edit coords"
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      style={coordsActionBtnStyle}
                      onClick={() => patchDraft({ latitude: null, longitude: null })}
                      aria-label="Clear coords"
                      title="Clear coords"
                    >
                      ✕
                    </button>
                  </span>
                ) : customEditingCoords ? (
                  <ManualCoordsEditor
                    initialLat={value.draft.latitude}
                    initialLng={value.draft.longitude}
                    onSave={(lat, lng) => {
                      patchDraft({ latitude: lat, longitude: lng });
                      setCustomEditingCoords(false);
                    }}
                    onCancel={() => setCustomEditingCoords(false)}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      style={geoBtnStyle}
                      disabled={geoStatus === "locating"}
                      onClick={handleUseMyLocation}
                    >
                      {geoStatus === "locating" ? "📍 Getting location…" : "📍 Use my GPS"}
                    </button>
                    <button
                      type="button"
                      style={geoBtnSecondaryStyle}
                      onClick={() => setCustomEditingCoords(true)}
                    >
                      Enter manually
                    </button>
                  </>
                )}
              </div>

              {geoStatus === "error" && geoError && (
                <div style={geoErrorStyle}>{geoError}</div>
              )}

              {value.draft.latitude != null && (
                <div style={geoHintStyle}>
                  This pin will appear on your activity map after you save.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Manual coords editor ──────────────────────────────────────────────────

function ManualCoordsEditor({
  initialLat,
  initialLng,
  onSave,
  onCancel,
}: {
  initialLat: number | null;
  initialLng: number | null;
  onSave: (lat: number, lng: number) => void;
  onCancel: () => void;
}) {
  const [lat, setLat] = useState(initialLat != null ? String(initialLat) : "");
  const [lng, setLng] = useState(initialLng != null ? String(initialLng) : "");
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  const valid =
    Number.isFinite(latNum) && Math.abs(latNum) <= 90 &&
    Number.isFinite(lngNum) && Math.abs(lngNum) <= 180;

  return (
    <div style={manualCoordsRowStyle}>
      <input
        style={tinyInputStyle}
        placeholder="lat"
        inputMode="decimal"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
      />
      <input
        style={tinyInputStyle}
        placeholder="lng"
        inputMode="decimal"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
      />
      <button
        type="button"
        style={manualCoordsSaveStyle(valid)}
        disabled={!valid}
        onClick={() => valid && onSave(latNum, lngNum)}
      >
        Save
      </button>
      <button
        type="button"
        style={geoBtnSecondaryStyle}
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

type OsmResult = {
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

function displayNameOf(value: NonNullable<SpotPickerValue>): string {
  return value.kind === "saved" ? value.display.name : value.draft.name;
}

function displayRegionOf(value: NonNullable<SpotPickerValue>): string | null {
  return value.kind === "saved" ? value.display.region : value.draft.region;
}

function savedSpotTitle(s: SpotPickerItem): string {
  const base = s.region ? `${s.name} · ${s.region}` : s.name;
  return s.isOwnActivity ? base : `${base} · from ${s.originLabel}`;
}

function hasTypeOptions(config: ActivitySpotConfig | null): boolean {
  return (config?.spotTypes.length ?? 0) > 0;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}


// ── Styles ────────────────────────────────────────────────────────────────

const addButtonStyle: CSSProperties = {
  appearance: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 12px",
  background: withAlpha(COLOR.text, 0.04),
  border: `1px dashed ${COLOR.border}`,
  borderRadius: RADIUS.control,
  color: COLOR.textDim,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const chipRowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const chipStyle: CSSProperties = {
  appearance: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 11px",
  background: withAlpha(COLOR.blue, 0.10),
  border: `1px solid ${withAlpha(COLOR.blue, 0.32)}`,
  borderRadius: RADIUS.pill,
  color: COLOR.text,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  maxWidth: "100%",
  minWidth: 0,
};

const chipNameStyle: CSSProperties = {
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 220,
};

const chipRegionStyle: CSSProperties = {
  color: COLOR.textDim,
  fontWeight: 600,
};

const chipEditHint: CSSProperties = {
  color: COLOR.textFaint,
  fontSize: 11,
  marginLeft: 2,
};

const chipClearStyle: CSSProperties = {
  appearance: "none",
  width: 26,
  height: 26,
  borderRadius: RADIUS.pill,
  background: withAlpha(COLOR.text, 0.05),
  border: `1px solid ${COLOR.border}`,
  color: COLOR.textDim,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const panelStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  borderRadius: RADIUS.inner,
  background: COLOR.panelSoft,
  border: `1px solid ${COLOR.border}`,
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const panelLabelStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};

const panelCollapseStyle: CSSProperties = {
  appearance: "none",
  width: 24,
  height: 24,
  borderRadius: RADIUS.pill,
  border: `1px solid ${COLOR.border}`,
  background: "transparent",
  color: COLOR.textDim,
  fontSize: 11,
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const recentRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const recentLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textFaint,
};

const recentChipsStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const recentChipStyle: CSSProperties = {
  appearance: "none",
  padding: "5px 10px",
  background: withAlpha(COLOR.text, 0.04),
  border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.pill,
  color: COLOR.text,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const searchWrapStyle: CSSProperties = {
  position: "relative",
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: withAlpha(COLOR.text, 0.04),
  border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.control,
  color: COLOR.text,
  fontSize: 13,
  fontWeight: 600,
};

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 4px)",
  left: 0,
  right: 0,
  zIndex: 30,
  background: withAlpha(COLOR.panel, 0.98),
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: `1px solid ${COLOR.borderStrong}`,
  borderRadius: RADIUS.inner,
  padding: 4,
  display: "grid",
  gap: 2,
  maxHeight: 280,
  overflowY: "auto",
  boxShadow: SHADOW.popover,
};

const dropdownGroupLabel: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: COLOR.textFaint,
  padding: "7px 8px 2px",
};

const dropdownItemStyle: CSSProperties = {
  appearance: "none",
  display: "flex",
  alignItems: "center",
  gap: 8,
  textAlign: "left",
  padding: "8px 10px",
  borderRadius: 7,
  border: "none",
  background: "transparent",
  color: COLOR.text,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const dropdownItemMain: CSSProperties = {
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
};

const dropdownItemMeta: CSSProperties = {
  color: COLOR.textDim,
  fontWeight: 500,
  fontSize: 11.5,
};

const dropdownDividerStyle: CSSProperties = {
  height: 1,
  background: COLOR.border,
  margin: "4px 6px",
};

const dropdownCreateStyle: CSSProperties = {
  ...dropdownItemStyle,
  background: withAlpha(COLOR.green, 0.06),
  border: `1px solid ${withAlpha(COLOR.green, 0.18)}`,
};

const dropdownHintStyle: CSSProperties = {
  fontSize: 11,
  color: COLOR.textFaint,
  padding: "6px 10px",
};

const confirmCardStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  background: withAlpha(COLOR.blue, 0.07),
  border: `1px solid ${withAlpha(COLOR.blue, 0.22)}`,
  borderRadius: RADIUS.inner,
};

const confirmHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const confirmTitleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
};

const confirmNameStyle: CSSProperties = {
  fontWeight: 800,
  fontSize: 13.5,
  color: COLOR.text,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const confirmClearStyle: CSSProperties = {
  appearance: "none",
  padding: "5px 10px",
  background: "transparent",
  border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.pill,
  color: COLOR.textDim,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const confirmActionBtnStyle: CSSProperties = {
  appearance: "none",
  padding: "5px 10px",
  background: withAlpha(COLOR.blue, 0.10),
  border: `1px solid ${withAlpha(COLOR.blue, 0.32)}`,
  borderRadius: RADIUS.pill,
  color: COLOR.blueText,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const confirmMetaStyle: CSSProperties = {
  fontSize: 11.5,
  color: COLOR.textDim,
  fontWeight: 600,
};

const inlineFieldsStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  paddingTop: 4,
};

const typeButtonsRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const typeButtonStyle: CSSProperties = {
  appearance: "none",
  flex: "1 1 90px",
  padding: "7px 10px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: withAlpha(COLOR.text, 0.04),
  color: COLOR.text,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

function typeButtonActive(color: string): CSSProperties {
  return {
    ...typeButtonStyle,
    background: withAlpha(color, 0.18),
    borderColor: withAlpha(color, 0.55),
    color: withAlpha(color, 1),
  };
}

const smallInputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  background: withAlpha(COLOR.text, 0.04),
  border: `1px solid ${COLOR.border}`,
  borderRadius: RADIUS.control,
  color: COLOR.text,
  fontSize: 12.5,
  fontWeight: 600,
};

const coordsRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const coordsConfirmStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  background: withAlpha(COLOR.green, 0.08),
  border: `1px solid ${withAlpha(COLOR.green, 0.28)}`,
  borderRadius: RADIUS.pill,
  color: COLOR.green,
  fontSize: 12,
  fontWeight: 700,
};

const coordsActionBtnStyle: CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "none",
  color: "inherit",
  fontSize: 11,
  cursor: "pointer",
  padding: "0 2px",
  fontWeight: 700,
  opacity: 0.7,
};

const geoBtnStyle: CSSProperties = {
  appearance: "none",
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${withAlpha(COLOR.blue, 0.4)}`,
  background: withAlpha(COLOR.blue, 0.12),
  color: COLOR.blueText,
  fontWeight: 800,
  fontSize: 12.5,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const geoBtnSecondaryStyle: CSSProperties = {
  appearance: "none",
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${COLOR.border}`,
  background: withAlpha(COLOR.text, 0.04),
  color: COLOR.textDim,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};

const manualCoordsRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  alignItems: "center",
  width: "100%",
};

const tinyInputStyle: CSSProperties = {
  flex: "1 1 90px",
  minWidth: 80,
  padding: "8px 10px",
  background: withAlpha(COLOR.text, 0.04),
  border: `1px solid ${COLOR.border}`,
  borderRadius: 10,
  color: COLOR.text,
  fontSize: 12,
  fontWeight: 700,
  textAlign: "center",
};

function manualCoordsSaveStyle(valid: boolean): CSSProperties {
  return {
    appearance: "none",
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${valid ? withAlpha(COLOR.green, 0.45) : COLOR.border}`,
    background: valid ? withAlpha(COLOR.green, 0.14) : withAlpha(COLOR.text, 0.03),
    color: valid ? COLOR.green : COLOR.textFaint,
    fontWeight: 800,
    fontSize: 12.5,
    cursor: valid ? "pointer" : "not-allowed",
  };
}

const geoErrorStyle: CSSProperties = {
  fontSize: 11.5,
  padding: "7px 10px",
  borderRadius: 8,
  background: withAlpha(COLOR.red, 0.10),
  border: `1px solid ${withAlpha(COLOR.red, 0.32)}`,
  color: COLOR.red,
};

const geoHintStyle: CSSProperties = {
  fontSize: 11,
  color: COLOR.textFaint,
  fontWeight: 600,
};
