"use client";

// Interactive climbing-spots map. MapLibre GL JS + raw OpenStreetMap tiles
// (no API key, no billing). Globe projection so the default view reads as
// "spots around the world" — user can spin/zoom into street level.
//
// Sidebar layout: left column on desktop (~320px), bottom sheet on mobile.
// Sidebar holds Nominatim search, type filter, spot list, and the new-spot
// form when the user is creating one.
//
// Spot creation has four paths and they all funnel through the same
// `pendingPin` state:
//   1) click empty map  → drops temp pin at click → name in sidebar
//   2) Nominatim search → click result → flies map there + drops temp pin
//   3) drag existing pin → onDragEnd hits updateClimbLocationCoords
//   4) manual lat/lng paste → form drops a pin at the parsed coords
//
// Existing spots without coords appear in the sidebar with a "place on map"
// button → next click on the map seats *that* spot's coords (instead of
// creating a new one). Lets the user retroactively coord existing locations.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createClimbLocationOnMap,
  updateClimbLocationCoords,
  updateClimbLocationMeta,
  clearClimbLocationCoords,
} from "./actions";
import type { ClimbLocationType } from "@/lib/climb-types";

export type MapLocation = {
  id: string;
  name: string;
  type: ClimbLocationType;
  latitude: number | null;
  longitude: number | null;
  visitCount: number;
};

type PendingPin =
  | { mode: "create"; lat: number; lng: number; name: string; type: ClimbLocationType }
  | { mode: "place-existing"; lat: number; lng: number; locationId: string };

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const GYM_COLOR = "rgba(78,148,255,0.95)";
const CRAG_COLOR = "rgba(74,222,128,0.95)";
const PENDING_COLOR = "rgba(251,191,36,0.95)";
const SELECTED_RING = "rgba(255,255,255,0.95)";

// Free, no-key, raster style. Globe projection works on raster sources —
// MapLibre re-projects tiles into the sphere automatically. Projection lives
// in the style spec in v5.
const MAP_STYLE = {
  version: 8 as const,
  projection: { type: "globe" as const },
  sources: {
    "osm-raster": {
      type: "raster" as const,
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster" as const,
      source: "osm-raster",
    },
  ],
};

export default function ClimbingMapView({
  initialLocations,
}: {
  initialLocations: MapLocation[];
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const pendingMarkerRef = useRef<Marker | null>(null);

  const [locations, setLocations] = useState<MapLocation[]>(initialLocations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const [filter, setFilter] = useState<"all" | "GYM" | "CRAG" | "uncoorded">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Init map (once) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.4,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    // Click empty map → drop a temp pin for creation. We check that the
    // click didn't originate on an existing marker (those have stopPropagation
    // baked in via the Marker class).
    map.on("click", (e) => {
      setError(null);
      setPendingPin((current) => {
        // If we're in "place-existing" mode, the click resolves coords for
        // that already-named location instead of creating a new one.
        if (current?.mode === "place-existing") {
          return { ...current, lat: e.lngLat.lat, lng: e.lngLat.lng };
        }
        return {
          mode: "create",
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
          name: current?.mode === "create" ? current.name : "",
          type: current?.mode === "create" ? current.type : "GYM",
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
  }, []);

  // ── Sync coord-bearing locations to map markers ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();
    for (const loc of locations) {
      if (loc.latitude == null || loc.longitude == null) continue;
      seen.add(loc.id);
      let marker = markersRef.current.get(loc.id);
      const color = loc.type === "GYM" ? GYM_COLOR : CRAG_COLOR;

      if (!marker) {
        const el = buildMarkerElement(color, loc.type, loc.id === selectedId);
        marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" })
          .setLngLat([loc.longitude, loc.latitude])
          .addTo(map);

        marker.on("dragend", () => {
          const lngLat = marker!.getLngLat();
          startTransition(async () => {
            try {
              const updated = await updateClimbLocationCoords({
                id: loc.id,
                latitude: lngLat.lat,
                longitude: lngLat.lng,
              });
              setLocations((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to update pin");
              // Snap pin back to original location on error
              if (loc.latitude != null && loc.longitude != null) {
                marker!.setLngLat([loc.longitude, loc.latitude]);
              }
            }
          });
        });

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedId(loc.id);
          setSheetOpen(true);
          // Read current coords from the marker, not the captured loc props
          // — those go stale after a drag, leaving flyTo stuck on the
          // original position.
          const current = marker!.getLngLat();
          map.flyTo({ center: [current.lng, current.lat], zoom: Math.max(map.getZoom(), 10), speed: 1.2 });
        });

        markersRef.current.set(loc.id, marker);
      } else {
        marker.setLngLat([loc.longitude, loc.latitude]);
        const el = marker.getElement();
        updateMarkerSelection(el, loc.id === selectedId);
      }
    }

    // Drop markers for locations that no longer have coords (or were deleted)
    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  }, [locations, selectedId]);

  // ── Sync the pending (temp) marker ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }
    if (!pendingPin) return;

    const el = buildMarkerElement(PENDING_COLOR, "GYM", true, true);
    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" })
      .setLngLat([pendingPin.lng, pendingPin.lat])
      .addTo(map);

    marker.on("dragend", () => {
      const ll = marker.getLngLat();
      setPendingPin((prev) => (prev ? { ...prev, lat: ll.lat, lng: ll.lng } : prev));
    });

    pendingMarkerRef.current = marker;
  }, [pendingPin]);

  // ── Nominatim search (debounced) ──────────────────────────────────────────
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

  // ── Filtered + sorted sidebar list ────────────────────────────────────────
  const sidebarList = useMemo(() => {
    const base = locations.filter((loc) => {
      if (filter === "all") return true;
      if (filter === "uncoorded") return loc.latitude == null || loc.longitude == null;
      return loc.type === filter;
    });
    // Coord-bearing first, then alphabetical within each group.
    return [...base].sort((a, b) => {
      const aHas = a.latitude != null && a.longitude != null;
      const bHas = b.latitude != null && b.longitude != null;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [locations, filter]);

  // ── Action handlers ───────────────────────────────────────────────────────

  function flyTo(lat: number, lng: number, zoom = 12) {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: [lng, lat], zoom, speed: 1.5 });
  }

  function focusLocation(loc: MapLocation) {
    setSelectedId(loc.id);
    if (loc.latitude != null && loc.longitude != null) {
      flyTo(loc.latitude, loc.longitude, Math.max(mapRef.current?.getZoom() ?? 1, 10));
    } else {
      // No coords — start the place-existing flow so a click on the map
      // assigns coords to this spot.
      setPendingPin({ mode: "place-existing", locationId: loc.id, lat: 0, lng: 0 });
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
      // Trim to the first comma — Nominatim returns "Smith Rock State Park,
      // Deschutes County, Oregon, …" and the user usually wants just the
      // primary name as their spot label.
      name: result.display_name.split(",")[0].trim(),
      type: "CRAG",
    });
    setSearchResults([]);
    setSearchQuery("");
  }

  function handlePasteCoords() {
    const parsed = parseCoords(pasteValue);
    if (!parsed) {
      setError("Couldn't parse those coordinates. Try '44.367, -121.139' or paste a Google Maps URL.");
      return;
    }
    setError(null);
    flyTo(parsed.lat, parsed.lng, 14);
    setPendingPin({ mode: "create", lat: parsed.lat, lng: parsed.lng, name: "", type: "GYM" });
    setPasteValue("");
    setPasteOpen(false);
  }

  function commitCreate() {
    if (!pendingPin || pendingPin.mode !== "create") return;
    const { lat, lng, name, type } = pendingPin;
    if (!name.trim()) {
      setError("Give the spot a name first");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createClimbLocationOnMap({
          name,
          type,
          latitude: lat,
          longitude: lng,
        });
        setLocations((prev) => [...prev, { ...created, visitCount: 0 }]);
        setPendingPin(null);
        setSelectedId(created.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create spot");
      }
    });
  }

  function commitPlaceExisting() {
    if (!pendingPin || pendingPin.mode !== "place-existing") return;
    const { locationId, lat, lng } = pendingPin;
    setError(null);
    startTransition(async () => {
      try {
        const updated = await updateClimbLocationCoords({ id: locationId, latitude: lat, longitude: lng });
        setLocations((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
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

  function clearCoords(loc: MapLocation) {
    if (!window.confirm(`Remove map pin for "${loc.name}"? The location stays in your library, just without coordinates.`)) return;
    startTransition(async () => {
      try {
        const updated = await clearClimbLocationCoords(loc.id);
        setLocations((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clear coords");
      }
    });
  }

  function renameSpot(loc: MapLocation) {
    const next = window.prompt("Spot name:", loc.name);
    if (!next || next.trim() === loc.name) return;
    startTransition(async () => {
      try {
        const updated = await updateClimbLocationMeta({ id: loc.id, name: next.trim() });
        if (updated) setLocations((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to rename");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const coordedCount = locations.filter((l) => l.latitude != null && l.longitude != null).length;
  const uncoordedCount = locations.length - coordedCount;
  const selected = locations.find((l) => l.id === selectedId) ?? null;

  return (
    <div style={layoutShell}>
      <div ref={mapContainerRef} style={mapStyle} />

      {/* Mobile bottom-sheet handle (visible <= 720px via CSS class) */}
      <button
        type="button"
        className="spotsMapSheetHandle"
        onClick={() => setSheetOpen((v) => !v)}
        aria-label={sheetOpen ? "Collapse spot list" : "Expand spot list"}
      >
        <span style={sheetGrip} />
        <span style={{ fontSize: 12, fontWeight: 800 }}>
          {locations.length} spot{locations.length === 1 ? "" : "s"}
          {uncoordedCount > 0 ? ` · ${uncoordedCount} unplaced` : ""}
        </span>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{sheetOpen ? "▾" : "▴"}</span>
      </button>

      <aside
        className={`spotsMapSidebar ${sheetOpen ? "is-open" : ""}`}
        style={sidebarStyle}
      >
        {/* Search */}
        <div style={sidebarSection}>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search OpenStreetMap (e.g. Smith Rock)"
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

        {/* Pending pin form */}
        {pendingPin && (
          <div style={pendingCardStyle}>
            {pendingPin.mode === "create" ? (
              <>
                <div style={pendingHeader}>New spot</div>
                <div style={pendingMeta}>
                  {pendingPin.lat.toFixed(4)}, {pendingPin.lng.toFixed(4)}
                  <span style={{ opacity: 0.55 }}> · drag pin to adjust</span>
                </div>
                <input
                  value={pendingPin.name}
                  onChange={(e) =>
                    setPendingPin((p) => (p && p.mode === "create" ? { ...p, name: e.target.value } : p))
                  }
                  placeholder="Spot name"
                  style={searchInputStyle}
                  autoFocus
                />
                <div style={typeToggleRow}>
                  <button
                    type="button"
                    onClick={() => setPendingPin((p) => (p && p.mode === "create" ? { ...p, type: "GYM" } : p))}
                    style={pendingPin.type === "GYM" ? typeBtnActive(GYM_COLOR) : typeBtn}
                  >
                    🏠 Gym
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPin((p) => (p && p.mode === "create" ? { ...p, type: "CRAG" } : p))}
                    style={pendingPin.type === "CRAG" ? typeBtnActive(CRAG_COLOR) : typeBtn}
                  >
                    🪨 Crag
                  </button>
                </div>
                <div style={pendingActionsRow}>
                  <button type="button" onClick={cancelPending} style={ghostBtn}>
                    Cancel
                  </button>
                  <button type="button" onClick={commitCreate} disabled={isPending} style={primaryBtn}>
                    {isPending ? "Saving…" : "Save spot"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={pendingHeader}>
                  Place {locations.find((l) => l.id === pendingPin.locationId)?.name ?? "spot"}
                </div>
                <div style={pendingMeta}>
                  {pendingPin.lat === 0 && pendingPin.lng === 0
                    ? "Click anywhere on the map to set coords."
                    : `${pendingPin.lat.toFixed(4)}, ${pendingPin.lng.toFixed(4)} · click again or drag pin to adjust`}
                </div>
                <div style={pendingActionsRow}>
                  <button type="button" onClick={cancelPending} style={ghostBtn}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitPlaceExisting}
                    disabled={isPending || (pendingPin.lat === 0 && pendingPin.lng === 0)}
                    style={primaryBtn}
                  >
                    {isPending ? "Saving…" : "Confirm location"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Filter chips */}
        <div style={sidebarSection}>
          <div style={filterRow}>
            <FilterChip label={`All (${locations.length})`} active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip label="Gyms" active={filter === "GYM"} onClick={() => setFilter("GYM")} accent={GYM_COLOR} />
            <FilterChip label="Crags" active={filter === "CRAG"} onClick={() => setFilter("CRAG")} accent={CRAG_COLOR} />
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

        {/* Manual coord paste */}
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
                <button type="button" onClick={() => { setPasteOpen(false); setPasteValue(""); }} style={ghostBtn}>
                  Cancel
                </button>
                <button type="button" onClick={handlePasteCoords} style={primaryBtn}>
                  Drop pin
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <div style={errorBanner}>{error}</div>}

        {/* Spot list */}
        <div style={listStyle}>
          {sidebarList.length === 0 ? (
            <div style={emptyStyle}>
              {filter === "all"
                ? "No climbing spots yet. Click the map or search for one to add your first."
                : "No spots match this filter."}
            </div>
          ) : (
            sidebarList.map((loc) => (
              <SpotRow
                key={loc.id}
                loc={loc}
                selected={loc.id === selectedId}
                onFocus={() => focusLocation(loc)}
                onRename={() => renameSpot(loc)}
                onClearCoords={() => clearCoords(loc)}
              />
            ))
          )}
        </div>

        {/* Selected pin actions (extra context that's redundant for keyboard
            users — visible only when a pin is selected and on coords) */}
        {selected && selected.latitude != null && selected.longitude != null && (
          <div style={selectedFooter}>
            <Link
              href={`/activities/climbing/climbs?location=${encodeURIComponent(selected.id)}`}
              style={primaryLink}
            >
              View climbs at {selected.name} →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function SpotRow({
  loc,
  selected,
  onFocus,
  onRename,
  onClearCoords,
}: {
  loc: MapLocation;
  selected: boolean;
  onFocus: () => void;
  onRename: () => void;
  onClearCoords: () => void;
}) {
  const hasCoords = loc.latitude != null && loc.longitude != null;
  const accent = loc.type === "GYM" ? GYM_COLOR : CRAG_COLOR;
  return (
    <div style={{ ...spotRowStyle, ...(selected ? spotRowSelected : {}) }}>
      <button type="button" onClick={onFocus} style={spotRowMain}>
        <span style={{ ...spotDot, background: hasCoords ? accent : "rgba(255,255,255,0.18)" }} />
        <span style={{ display: "grid", gap: 1, minWidth: 0, textAlign: "left" }}>
          <span style={spotName}>{loc.name}</span>
          <span style={spotMeta}>
            {loc.type === "GYM" ? "Gym" : "Crag"}
            {loc.visitCount > 0 ? ` · ${loc.visitCount} visit${loc.visitCount === 1 ? "" : "s"}` : ""}
            {!hasCoords ? " · unplaced" : ""}
          </span>
        </span>
      </button>
      <div style={spotActions}>
        <button type="button" onClick={onRename} style={iconBtn} title="Rename" aria-label="Rename">
          ✎
        </button>
        {hasCoords && (
          <button type="button" onClick={onClearCoords} style={iconBtn} title="Remove pin" aria-label="Remove pin">
            ✕
          </button>
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
        border: active ? `1px solid ${color.replace("0.95)", "0.55)").replace("0.85)", "0.55)")}` : "1px solid rgba(255,255,255,0.12)",
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

function buildMarkerElement(color: string, type: ClimbLocationType, selected: boolean, pulsing = false): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    width: 22px; height: 28px; cursor: pointer;
    display: flex; align-items: flex-start; justify-content: center;
    transform-origin: bottom center;
    transition: transform 120ms ease;
  `;
  // Inline SVG teardrop pin so we don't need any image assets.
  wrapper.innerHTML = `
    <svg width="22" height="28" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 1 C5 1, 1 5, 1 11 C1 18, 11 27, 11 27 C11 27, 21 18, 21 11 C21 5, 17 1, 11 1 Z"
        fill="${color}"
        stroke="${selected ? SELECTED_RING : "rgba(0,0,0,0.45)"}"
        stroke-width="${selected ? 2.5 : 1.5}" />
      <circle cx="11" cy="11" r="4" fill="rgba(15,23,42,0.85)" />
      <text x="11" y="14" text-anchor="middle" font-size="8" font-family="system-ui" fill="white">${type === "GYM" ? "G" : "C"}</text>
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

function parseCoords(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try Google Maps URL first — patterns like @lat,lng,zoom or !3dlat!4dlng
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

  // Plain "lat, lng" or "lat lng"
  const pair = trimmed.match(/^(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)$/);
  if (pair) {
    const lat = parseFloat(pair[1]);
    const lng = parseFloat(pair[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  return null;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const layoutShell: React.CSSProperties = {
  position: "relative",
  width: "100%",
  // 100dvh handles iOS Safari's collapsing chrome; the offset accounts for
  // the compact header above + bottom nav below.
  height: "calc(100dvh - 230px)",
  minHeight: 420,
  overflow: "hidden",
};

const mapStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
};

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
  width: 32,
  height: 4,
  borderRadius: 999,
  background: "rgba(255,255,255,0.35)",
  marginRight: "auto",
};

const sidebarSection: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 600,
  outline: "none",
};

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  paddingLeft: 4,
};

const searchResultsStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  maxHeight: 220,
  overflowY: "auto",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: 4,
  background: "rgba(0,0,0,0.2)",
};

const searchResultBtn: React.CSSProperties = {
  textAlign: "left",
  padding: "7px 9px",
  borderRadius: 7,
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.85)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const filterRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
};

const pendingCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  borderRadius: 12,
  background: "rgba(251,191,36,0.10)",
  border: "1px solid rgba(251,191,36,0.32)",
};

const pendingHeader: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.85,
  color: "rgba(251,191,36,0.95)",
};

const pendingMeta: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.75,
};

const typeToggleRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
};

const typeBtn: React.CSSProperties = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

function typeBtnActive(color: string): React.CSSProperties {
  return {
    ...typeBtn,
    background: color.replace("0.95)", "0.18)"),
    border: `1px solid ${color.replace("0.95)", "0.55)")}`,
    color: color.replace("0.95)", "1)"),
  };
}

const pendingActionsRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  justifyContent: "flex-end",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "rgba(255,255,255,0.75)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.45)",
  background: "rgba(120,190,255,0.18)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const subtleLinkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(160,200,255,0.85)",
  fontSize: 11.5,
  fontWeight: 700,
  textAlign: "left",
  padding: "2px 4px",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const errorBanner: React.CSSProperties = {
  fontSize: 11.5,
  padding: "7px 10px",
  borderRadius: 8,
  background: "rgba(248,113,113,0.10)",
  border: "1px solid rgba(248,113,113,0.32)",
  color: "rgba(248,113,113,0.95)",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  overflowY: "auto",
  // Cap the list so the sidebar stays usable on small viewports — list
  // scrolls independently of the sidebar's outer scroll.
  maxHeight: 360,
  paddingRight: 2,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
  padding: "12px 4px",
  textAlign: "center",
};

const spotRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 4px 6px 6px",
  borderRadius: 8,
  border: "1px solid transparent",
};

const spotRowSelected: React.CSSProperties = {
  background: "rgba(120,190,255,0.08)",
  border: "1px solid rgba(120,190,255,0.32)",
};

const spotRowMain: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  padding: 0,
  minWidth: 0,
  textAlign: "left",
};

const spotDot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};

const spotName: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const spotMeta: React.CSSProperties = {
  fontSize: 10.5,
  opacity: 0.55,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const spotActions: React.CSSProperties = {
  display: "flex",
  gap: 2,
};

const iconBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "grid",
  placeItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: 6,
  color: "rgba(255,255,255,0.55)",
  fontSize: 12,
  cursor: "pointer",
};

const selectedFooter: React.CSSProperties = {
  paddingTop: 6,
  borderTop: "1px solid rgba(255,255,255,0.06)",
};

const primaryLink: React.CSSProperties = {
  display: "block",
  padding: "8px 10px",
  borderRadius: 10,
  background: "rgba(120,190,255,0.12)",
  border: "1px solid rgba(120,190,255,0.32)",
  color: "rgba(191,219,254,0.95)",
  fontSize: 12,
  fontWeight: 800,
  textAlign: "center",
  textDecoration: "none",
};
