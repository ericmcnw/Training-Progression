"use client";

// Generic activity-spots map view. Modeled on ClimbingMapView (which has a
// dedicated route + bespoke ClimbLocation schema) but works against the
// shared ActivitySpot model and the per-activity config from
// lib/activity-spots. Shares the .spotsMap* responsive sidebar CSS in
// globals.css with ClimbingMapView and the global GlobalMapView.
//
// Differences vs the climbing flow worth knowing:
// - `type` is a free string (or null), not an enum. Type buttons render
//   only when config.spotTypes is non-empty.
// - Pin color comes from config (per-type or default), not a hardcoded
//   GYM/CRAG palette.
// - The deep-link footer is omitted — there's no generic "browse spots"
//   page yet (Phase 2b territory). Selecting a pin still focuses the map.
//
// Also fixes the stale-closure bug from ClimbingMapView: the marker click
// handler reads its current LngLat from the marker itself instead of the
// captured loc props, so dragging then clicking flies to the new position.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createActivitySpotOnMap,
  updateActivitySpotCoords,
  updateActivitySpotMeta,
  clearActivitySpotCoords,
} from "./actions";
import { spotTypeColor, type ActivitySpotConfig } from "@/lib/activity-spots";

export type MapSpot = {
  id: string;
  name: string;
  type: string | null;
  latitude: number | null;
  longitude: number | null;
  visitCount: number;
};

type PendingPin =
  | { mode: "create"; lat: number; lng: number; name: string; type: string | null }
  | { mode: "place-existing"; lat: number; lng: number; spotId: string };

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const PENDING_COLOR = "rgba(251,191,36,0.95)";
const SELECTED_RING = "rgba(255,255,255,0.95)";

const MAP_STYLE = {
  version: 8 as const,
  projection: { type: "globe" as const },
  sources: {
    "osm-raster": {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm-raster-layer", type: "raster" as const, source: "osm-raster" }],
};

export default function SpotMapView({
  activitySlug,
  config,
  initialSpots,
}: {
  activitySlug: string;
  config: ActivitySpotConfig;
  initialSpots: MapSpot[];
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const pendingMarkerRef = useRef<Marker | null>(null);

  const [spots, setSpots] = useState<MapSpot[]>(initialSpots);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const [filter, setFilter] = useState<string>("all"); // "all" | "uncoorded" | type-value
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const defaultType = config.spotTypes[0]?.value ?? null;

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.4,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    map.on("click", (e) => {
      setError(null);
      setPendingPin((current) => {
        if (current?.mode === "place-existing") {
          return { ...current, lat: e.lngLat.lat, lng: e.lngLat.lng };
        }
        return {
          mode: "create",
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          name: current?.mode === "create" ? current.name : "",
          type: current?.mode === "create" ? current.type : defaultType,
        };
      });
      setSheetOpen(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [defaultType]);

  // ── Sync coord-bearing spots to map markers ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    for (const spot of spots) {
      if (spot.latitude == null || spot.longitude == null) continue;
      seen.add(spot.id);
      let marker = markersRef.current.get(spot.id);
      const color = spotTypeColor(config, spot.type);

      if (!marker) {
        const el = buildMarkerElement(color, spot.type, config, spot.id === selectedId);
        marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" })
          .setLngLat([spot.longitude, spot.latitude])
          .addTo(map);

        marker.on("dragend", () => {
          const lngLat = marker!.getLngLat();
          startTransition(async () => {
            try {
              const updated = await updateActivitySpotCoords({
                id: spot.id,
                latitude: lngLat.lat,
                longitude: lngLat.lng,
              });
              setSpots((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to update pin");
              if (spot.latitude != null && spot.longitude != null) {
                marker!.setLngLat([spot.longitude, spot.latitude]);
              }
            }
          });
        });

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedId(spot.id);
          setSheetOpen(true);
          // Stale-closure fix: read current coords from the marker, not the
          // captured spot props (which go stale after a drag).
          const current = marker!.getLngLat();
          map.flyTo({ center: [current.lng, current.lat], zoom: Math.max(map.getZoom(), 10), speed: 1.2 });
        });

        markersRef.current.set(spot.id, marker);
      } else {
        marker.setLngLat([spot.longitude, spot.latitude]);
        const el = marker.getElement();
        updateMarkerSelection(el, spot.id === selectedId);
        updateMarkerColor(el, color);
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [spots, selectedId, config]);

  // ── Pending marker ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }
    if (!pendingPin) return;

    const el = buildMarkerElement(PENDING_COLOR, null, config, true, true);
    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" })
      .setLngLat([pendingPin.lng, pendingPin.lat])
      .addTo(map);

    marker.on("dragend", () => {
      const ll = marker.getLngLat();
      setPendingPin((prev) => (prev ? { ...prev, lat: ll.lat, lng: ll.lng } : prev));
    });

    pendingMarkerRef.current = marker;
  }, [pendingPin, config]);

  // ── Nominatim search ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=8`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        if (!res.ok) throw new Error("Search failed");
        const data: NominatimResult[] = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  // ── Sidebar list (filter + sort) ──────────────────────────────────────────
  const sidebarList = useMemo(() => {
    const base = spots.filter((spot) => {
      if (filter === "all") return true;
      if (filter === "uncoorded") return spot.latitude == null || spot.longitude == null;
      return spot.type === filter;
    });
    return [...base].sort((a, b) => {
      const aHas = a.latitude != null && a.longitude != null;
      const bHas = b.latitude != null && b.longitude != null;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [spots, filter]);

  // ── Action handlers ───────────────────────────────────────────────────────

  function flyTo(lat: number, lng: number, zoom = 12) {
    mapRef.current?.flyTo({ center: [lng, lat], zoom, speed: 1.5 });
  }

  function focusSpot(spot: MapSpot) {
    setSelectedId(spot.id);
    if (spot.latitude != null && spot.longitude != null) {
      flyTo(spot.latitude, spot.longitude, Math.max(mapRef.current?.getZoom() ?? 1, 10));
    } else {
      setPendingPin({ mode: "place-existing", spotId: spot.id, lat: 0, lng: 0 });
    }
    setSheetOpen(true);
  }

  function handleNominatimPick(result: NominatimResult) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    flyTo(lat, lng, 13);
    setPendingPin({
      mode: "create",
      lat,
      lng,
      name: result.display_name.split(",")[0].trim(),
      type: defaultType,
    });
    setSearchResults([]);
    setSearchQuery("");
  }

  function handlePasteCoords() {
    const parsed = parseCoords(pasteValue);
    if (!parsed) {
      setError("Couldn't parse those coordinates. Try '44.367, -121.139' or a Google Maps URL.");
      return;
    }
    setError(null);
    flyTo(parsed.lat, parsed.lng, 14);
    setPendingPin({ mode: "create", lat: parsed.lat, lng: parsed.lng, name: "", type: defaultType });
    setPasteValue("");
    setPasteOpen(false);
  }

  function commitCreate() {
    if (!pendingPin || pendingPin.mode !== "create") return;
    const { lat, lng, name, type } = pendingPin;
    if (!name.trim()) {
      setError(`Give the ${config.spotNoun} a name first`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createActivitySpotOnMap({
          activitySlug,
          name,
          type,
          latitude: lat,
          longitude: lng,
        });
        setSpots((prev) => [...prev, { ...created, visitCount: 0 }]);
        setPendingPin(null);
        setSelectedId(created.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create spot");
      }
    });
  }

  function commitPlaceExisting() {
    if (!pendingPin || pendingPin.mode !== "place-existing") return;
    const { spotId, lat, lng } = pendingPin;
    setError(null);
    startTransition(async () => {
      try {
        const updated = await updateActivitySpotCoords({ id: spotId, latitude: lat, longitude: lng });
        setSpots((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
        setPendingPin(null);
        setSelectedId(updated.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to place spot");
      }
    });
  }

  function cancelPending() {
    setPendingPin(null);
    setError(null);
  }

  function clearCoords(spot: MapSpot) {
    if (!window.confirm(`Remove map pin for "${spot.name}"? The ${config.spotNoun} stays in your library, just without coords.`)) return;
    startTransition(async () => {
      try {
        const updated = await clearActivitySpotCoords(spot.id);
        setSpots((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear coords");
      }
    });
  }

  function renameSpot(spot: MapSpot) {
    const next = window.prompt(`${capitalize(config.spotNoun)} name:`, spot.name);
    if (!next || next.trim() === spot.name) return;
    startTransition(async () => {
      try {
        const updated = await updateActivitySpotMeta({ id: spot.id, name: next.trim() });
        if (updated) setSpots((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const coordedCount = spots.filter((l) => l.latitude != null && l.longitude != null).length;
  const uncoordedCount = spots.length - coordedCount;
  const hasTypes = config.spotTypes.length > 0;

  return (
    <div style={layoutShell}>
      <div ref={mapContainerRef} style={mapStyle} />

      <button
        type="button"
        className="spotsMapSheetHandle"
        onClick={() => setSheetOpen((v) => !v)}
        aria-label={sheetOpen ? "Collapse spot list" : "Expand spot list"}
      >
        <span style={sheetGrip} />
        <span style={{ fontSize: 12, fontWeight: 800 }}>
          {spots.length} {config.spotNoun}{spots.length === 1 ? "" : "s"}
          {uncoordedCount > 0 ? ` · ${uncoordedCount} unplaced` : ""}
        </span>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{sheetOpen ? "▾" : "▴"}</span>
      </button>

      <aside
        className={`spotsMapSidebar ${sheetOpen ? "is-open" : ""}`}
        style={sidebarStyle}
      >
        <div style={sidebarSection}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search OpenStreetMap"
            style={searchInputStyle}
          />
          {searching && <div style={hintStyle}>Searching…</div>}
          {searchResults.length > 0 && (
            <div style={searchResultsStyle}>
              {searchResults.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => handleNominatimPick(r)}
                  style={searchResultBtn}
                  title={r.display_name}
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {pendingPin && (
          <div style={pendingCardStyle}>
            {pendingPin.mode === "create" ? (
              <>
                <div style={pendingHeader}>New {config.spotNoun}</div>
                <div style={pendingMeta}>
                  {pendingPin.lat.toFixed(4)}, {pendingPin.lng.toFixed(4)}
                  <span style={{ opacity: 0.55 }}> · drag pin to adjust</span>
                </div>
                <input
                  value={pendingPin.name}
                  onChange={(e) =>
                    setPendingPin((p) => (p && p.mode === "create" ? { ...p, name: e.target.value } : p))
                  }
                  placeholder={`${capitalize(config.spotNoun)} name`}
                  style={searchInputStyle}
                  autoFocus
                />
                {hasTypes && (
                  <div style={typeToggleRow}>
                    {config.spotTypes.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() =>
                          setPendingPin((p) => (p && p.mode === "create" ? { ...p, type: t.value } : p))
                        }
                        style={pendingPin.type === t.value ? typeBtnActive(t.pinColor) : typeBtn}
                      >
                        {t.emoji ? `${t.emoji} ` : ""}{t.label}
                      </button>
                    ))}
                  </div>
                )}
                <div style={pendingActionsRow}>
                  <button type="button" onClick={cancelPending} style={ghostBtn}>Cancel</button>
                  <button type="button" onClick={commitCreate} disabled={isPending} style={primaryBtn}>
                    {isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={pendingHeader}>
                  Place {spots.find((s) => s.id === pendingPin.spotId)?.name ?? config.spotNoun}
                </div>
                <div style={pendingMeta}>
                  {pendingPin.lat === 0 && pendingPin.lng === 0
                    ? "Click anywhere on the map to set coords."
                    : `${pendingPin.lat.toFixed(4)}, ${pendingPin.lng.toFixed(4)} · click again or drag pin to adjust`}
                </div>
                <div style={pendingActionsRow}>
                  <button type="button" onClick={cancelPending} style={ghostBtn}>Cancel</button>
                  <button
                    type="button"
                    onClick={commitPlaceExisting}
                    disabled={isPending || (pendingPin.lat === 0 && pendingPin.lng === 0)}
                    style={primaryBtn}
                  >
                    {isPending ? "Saving…" : "Confirm"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div style={sidebarSection}>
          <div style={filterRow}>
            <FilterChip label={`All (${spots.length})`} active={filter === "all"} onClick={() => setFilter("all")} />
            {config.spotTypes.map((t) => (
              <FilterChip
                key={t.value}
                label={t.label}
                active={filter === t.value}
                onClick={() => setFilter(t.value)}
                accent={t.pinColor}
              />
            ))}
            {uncoordedCount > 0 && (
              <FilterChip
                label={`Unplaced (${uncoordedCount})`}
                active={filter === "uncoorded"}
                onClick={() => setFilter("uncoorded")}
                accent={PENDING_COLOR}
              />
            )}
          </div>
        </div>

        <div style={sidebarSection}>
          {!pasteOpen ? (
            <button type="button" onClick={() => setPasteOpen(true)} style={subtleLinkBtn}>
              Paste coords or Google Maps URL
            </button>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              <input
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="44.367, -121.139 — or maps.google.com URL"
                style={searchInputStyle}
                autoFocus
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => { setPasteOpen(false); setPasteValue(""); }} style={ghostBtn}>Cancel</button>
                <button type="button" onClick={handlePasteCoords} style={primaryBtn}>Drop pin</button>
              </div>
            </div>
          )}
        </div>

        {error && <div style={errorBanner}>{error}</div>}

        <div style={listStyle}>
          {sidebarList.length === 0 ? (
            <div style={emptyStyle}>
              {filter === "all"
                ? `No ${config.spotNoun}s yet. Click the map or search for one to add your first.`
                : "No spots match this filter."}
            </div>
          ) : (
            sidebarList.map((spot) => (
              <SpotRow
                key={spot.id}
                spot={spot}
                config={config}
                selected={spot.id === selectedId}
                onFocus={() => focusSpot(spot)}
                onRename={() => renameSpot(spot)}
                onClearCoords={() => clearCoords(spot)}
              />
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function SpotRow({
  spot,
  config,
  selected,
  onFocus,
  onRename,
  onClearCoords,
}: {
  spot: MapSpot;
  config: ActivitySpotConfig;
  selected: boolean;
  onFocus: () => void;
  onRename: () => void;
  onClearCoords: () => void;
}) {
  const hasCoords = spot.latitude != null && spot.longitude != null;
  const accent = spotTypeColor(config, spot.type);
  const typeLabel = config.spotTypes.find((t) => t.value === spot.type)?.label ?? spot.type ?? "";
  return (
    <div style={{ ...spotRowStyle, ...(selected ? spotRowSelected : {}) }}>
      <button type="button" onClick={onFocus} style={spotRowMain}>
        <span style={{ ...spotDot, background: hasCoords ? accent : "rgba(255,255,255,0.18)" }} />
        <span style={{ display: "grid", gap: 1, minWidth: 0, textAlign: "left" }}>
          <span style={spotName}>{spot.name}</span>
          <span style={spotMeta}>
            {typeLabel || capitalize(config.spotNoun)}
            {spot.visitCount > 0 ? ` · ${spot.visitCount} visit${spot.visitCount === 1 ? "" : "s"}` : ""}
            {!hasCoords ? " · unplaced" : ""}
          </span>
        </span>
      </button>
      <div style={spotActions}>
        <button type="button" onClick={onRename} style={iconBtn} title="Rename" aria-label="Rename">✎</button>
        {hasCoords && (
          <button type="button" onClick={onClearCoords} style={iconBtn} title="Remove pin" aria-label="Remove pin">✕</button>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: string;
}) {
  const color = accent ?? "rgba(160,200,255,0.85)";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 10px",
        borderRadius: 999,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: active ? color.replace("0.95)", "0.55)").replace("0.85)", "0.55)") : "rgba(255,255,255,0.12)",
        background: active ? color.replace("0.95)", "0.18)").replace("0.85)", "0.18)") : "rgba(255,255,255,0.04)",
        color: active ? color.replace("0.95)", "1)").replace("0.85)", "1)") : "rgba(255,255,255,0.78)",
        fontSize: 11.5,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

function buildMarkerElement(
  color: string,
  type: string | null,
  config: ActivitySpotConfig,
  selected: boolean,
  pulsing = false,
): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    width: 22px; height: 28px; cursor: pointer;
    display: flex; align-items: flex-start; justify-content: center;
    transform-origin: bottom center;
    transition: transform 120ms ease;
    position: relative;
  `;
  // First letter of the type (or a dot for untyped). Keeps pin glanceable.
  const typeLabel = config.spotTypes.find((t) => t.value === type)?.label;
  const initial = typeLabel ? typeLabel[0].toUpperCase() : "•";
  wrapper.innerHTML = `
    <svg width="22" height="28" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 1 C5 1, 1 5, 1 11 C1 18, 11 27, 11 27 C11 27, 21 18, 21 11 C21 5, 17 1, 11 1 Z"
        fill="${color}"
        stroke="${selected ? SELECTED_RING : "rgba(0,0,0,0.45)"}"
        stroke-width="${selected ? 2.5 : 1.5}" />
      <circle cx="11" cy="11" r="4" fill="rgba(15,23,42,0.85)" />
      <text x="11" y="14" text-anchor="middle" font-size="8" font-family="system-ui" fill="white">${initial}</text>
    </svg>
    ${pulsing ? `<div style="position:absolute; bottom:-2px; width:12px; height:4px; border-radius:999px; background:rgba(0,0,0,0.25); filter:blur(2px);"></div>` : ""}
  `;
  return wrapper;
}

function updateMarkerSelection(el: HTMLElement, selected: boolean) {
  const path = el.querySelector("path");
  if (!path) return;
  path.setAttribute("stroke", selected ? SELECTED_RING : "rgba(0,0,0,0.45)");
  path.setAttribute("stroke-width", selected ? "2.5" : "1.5");
}

function updateMarkerColor(el: HTMLElement, color: string) {
  const path = el.querySelector("path");
  if (!path) return;
  path.setAttribute("fill", color);
}

function parseCoords(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const at = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) {
    const lat = parseFloat(at[1]);
    const lng = parseFloat(at[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const place = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (place) {
    const lat = parseFloat(place[1]);
    const lng = parseFloat(place[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const pair = trimmed.match(/^(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)$/);
  if (pair) {
    const lat = parseFloat(pair[1]);
    const lng = parseFloat(pair[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
}

function capitalize(value: string) {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

// ── Styles (mirror the climbing map for visual consistency) ────────────────

const layoutShell: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "calc(100dvh - 230px)",
  minHeight: 420,
  overflow: "hidden",
};

const mapStyle: React.CSSProperties = { position: "absolute", inset: 0 };

// Padding owned by .spotsMapSidebar CSS so the closed-state max-height: 0
// fully collapses without inline overrides.
const sidebarStyle: React.CSSProperties = {
  position: "absolute",
  background: "rgba(15,23,42,0.94)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  display: "grid",
  gap: 10,
  overflowY: "auto",
  zIndex: 5,
};

const sheetGrip: React.CSSProperties = {
  width: 32, height: 4, borderRadius: 999,
  background: "rgba(255,255,255,0.35)", marginRight: "auto",
};

const sidebarSection: React.CSSProperties = { display: "grid", gap: 6 };

const searchInputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)", color: "inherit",
  fontSize: 13, fontWeight: 600, outline: "none",
};

const hintStyle: React.CSSProperties = { fontSize: 11, opacity: 0.55, paddingLeft: 4 };

const searchResultsStyle: React.CSSProperties = {
  display: "grid", gap: 2, maxHeight: 220, overflowY: "auto",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10,
  padding: 4, background: "rgba(0,0,0,0.2)",
};

const searchResultBtn: React.CSSProperties = {
  textAlign: "left", padding: "7px 9px", borderRadius: 7,
  border: "none", background: "transparent",
  color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600,
  cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const filterRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5 };

const pendingCardStyle: React.CSSProperties = {
  display: "grid", gap: 8, padding: 10, borderRadius: 12,
  background: "rgba(251,191,36,0.10)",
  border: "1px solid rgba(251,191,36,0.32)",
};

const pendingHeader: React.CSSProperties = {
  fontSize: 12, fontWeight: 900, letterSpacing: 0.4,
  textTransform: "uppercase", opacity: 0.85,
  color: "rgba(251,191,36,0.95)",
};

const pendingMeta: React.CSSProperties = { fontSize: 11, opacity: 0.75 };

const typeToggleRow: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap" };

const typeBtn: React.CSSProperties = {
  flex: "1 1 90px", padding: "8px 10px", borderRadius: 10,
  borderWidth: 1, borderStyle: "solid", borderColor: "rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)", color: "inherit",
  fontSize: 12, fontWeight: 800, cursor: "pointer",
};

function typeBtnActive(color: string): React.CSSProperties {
  return {
    ...typeBtn,
    background: color.replace("0.95)", "0.18)"),
    borderColor: color.replace("0.95)", "0.55)"),
    color: color.replace("0.95)", "1)"),
  };
}

const pendingActionsRow: React.CSSProperties = {
  display: "flex", gap: 6, justifyContent: "flex-end",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent", color: "rgba(255,255,255,0.75)",
  fontSize: 12, fontWeight: 800, cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.18)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12, fontWeight: 900, cursor: "pointer",
};

const subtleLinkBtn: React.CSSProperties = {
  background: "transparent", border: "none",
  color: "rgba(160,200,255,0.85)", fontSize: 11.5, fontWeight: 700,
  textAlign: "left", padding: "2px 4px", cursor: "pointer",
  textDecoration: "underline", textUnderlineOffset: 2,
};

const errorBanner: React.CSSProperties = {
  fontSize: 11.5, padding: "7px 10px", borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};

const listStyle: React.CSSProperties = {
  display: "grid", gap: 4, overflowY: "auto",
  maxHeight: 360, paddingRight: 2,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12, opacity: 0.55, padding: "12px 4px", textAlign: "center",
};

const spotRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4,
  padding: "6px 4px 6px 6px", borderRadius: 8,
  borderWidth: 1, borderStyle: "solid", borderColor: "transparent",
};

const spotRowSelected: React.CSSProperties = {
  background: "rgba(120,190,255,0.08)",
  borderColor: "rgba(120,190,255,0.32)",
};

const spotRowMain: React.CSSProperties = {
  flex: 1, display: "flex", alignItems: "center", gap: 8,
  background: "transparent", border: "none", color: "inherit",
  cursor: "pointer", padding: 0, minWidth: 0, textAlign: "left",
};

const spotDot: React.CSSProperties = {
  width: 8, height: 8, borderRadius: 999, flexShrink: 0,
};

const spotName: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 800,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const spotMeta: React.CSSProperties = {
  fontSize: 10.5, opacity: 0.55,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const spotActions: React.CSSProperties = { display: "flex", gap: 2 };

const iconBtn: React.CSSProperties = {
  width: 24, height: 24, display: "grid", placeItems: "center",
  background: "transparent", border: "none", borderRadius: 6,
  color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer",
};
