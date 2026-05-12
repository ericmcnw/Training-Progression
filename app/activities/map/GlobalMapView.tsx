"use client";

// Read-only world view of every spot the user has across all activities.
// Renders pins as native MapLibre circle/symbol layers (not HTML markers)
// so the GPU positions them in lockstep with globe rotation and so we get
// MapLibre's built-in clustering at low zoom for free. The per-activity
// and climbing maps still use HTML markers because they need draggability.
//
// Reuses the .spotsMap* responsive sidebar CSS shared with the per-activity
// and climbing maps.
//
// Why read-only: a new pin needs an owning activity. Forcing the user to
// pick one inside the global map adds friction the per-activity maps
// already handle gracefully. Each pin's "Edit" link drops the user into
// the right activity map.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ACTIVITY_FAMILY_META, ACTIVITY_FAMILY_ORDER, type ActivityFamily } from "@/lib/activity-families";
import type { GlobalSpot } from "@/lib/all-spots";

const SOURCE_ID = "spots";
const CLUSTER_LAYER = "spot-clusters";
const CLUSTER_COUNT_LAYER = "spot-cluster-count";
const POINT_LAYER = "spot-points";

// Cluster bubble color — neutral slate so it doesn't fight with per-activity
// pin colors. Count text uses dark fill on the bright bubble.
const CLUSTER_FILL = "rgba(120,190,255,0.85)";
const CLUSTER_STROKE = "rgba(255,255,255,0.95)";

// MapLibre needs a `glyphs` URL to render text in symbol layers. The
// demotiles font CDN is the canonical free source for MapLibre demos and
// has been stable for years; swap if it ever goes down.
const MAP_STYLE = {
  version: 8 as const,
  projection: { type: "globe" as const },
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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

type FamilyFilter = "all" | ActivityFamily;

export default function GlobalMapView({
  initialSpots,
}: {
  initialSpots: GlobalSpot[];
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Tracks the currently-highlighted feature so we can clear feature-state
  // before applying it to a new selection.
  const lastSelectedRef = useRef<string | null>(null);
  const layersReadyRef = useRef(false);
  // Snapshot of the latest visibleSpots so the post-load layer registration
  // can push initial data without a re-render.
  const currentVisibleSpotsRef = useRef<GlobalSpot[]>([]);

  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Init map + register source/layers ─────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 1.4,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

    function registerLayers() {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        // clusterMaxZoom controls when individual pins separate. ~6 keeps
        // city-scale pins clustered until you're zoomed in enough to want
        // detail. clusterRadius is in screen pixels.
        clusterMaxZoom: 8,
        clusterRadius: 45,
        // Promotes our stable spot uid to feature.id so feature-state for
        // selection survives setData() calls.
        promoteId: "uid",
      });

      // Cluster bubbles — sized by point count.
      map.addLayer({
        id: CLUSTER_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": CLUSTER_FILL,
          "circle-radius": [
            "step",
            ["get", "point_count"],
            16, // up to 5
            5, 20, // 5–24
            25, 26, // 25+
          ],
          "circle-stroke-color": CLUSTER_STROKE,
          "circle-stroke-width": 1.5,
        },
      });

      // Cluster count label.
      map.addLayer({
        id: CLUSTER_COUNT_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Bold"],
          "text-size": 12,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#0f172a",
        },
      });

      // Individual pins. Color comes from per-feature `pinColor` property.
      // Selected pin gets a thicker white ring via feature-state.
      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "pinColor"],
          "circle-radius": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            10,
            7,
          ],
          "circle-stroke-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "rgba(255,255,255,0.98)",
            "rgba(15,23,42,0.7)",
          ],
          "circle-stroke-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2.5,
            1.5,
          ],
        },
      });

      // Cluster click → expand to the zoom level where it splits.
      map.on("click", CLUSTER_LAYER, (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id as number | undefined;
        if (clusterId == null) return;
        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          if (feature.geometry.type !== "Point") return;
          const [lng, lat] = feature.geometry.coordinates;
          map.flyTo({ center: [lng, lat], zoom: zoom + 0.5, speed: 1.4 });
        }).catch(() => undefined);
      });

      // Individual pin click → select + sidebar focus.
      map.on("click", POINT_LAYER, (e) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const uid = feature.properties?.uid as string | undefined;
        if (!uid) return;
        const [lng, lat] = feature.geometry.coordinates;
        setSelectedUid(uid);
        setSheetOpen(true);
        map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 9), speed: 1.4 });
      });

      // Cursor affordances.
      for (const layer of [CLUSTER_LAYER, POINT_LAYER]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }

      layersReadyRef.current = true;
      // Trigger an initial data push now that the source exists.
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (source) source.setData(buildFeatureCollection(currentVisibleSpotsRef.current));
    }

    if (map.loaded()) registerLayers();
    else map.once("load", registerLayers);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layersReadyRef.current = false;
    };
  }, []);

  // ── Available activity options derived from current spots ─────────────────
  const activitiesPresent = useMemo(() => {
    const map = new Map<string, { slug: string; label: string; family: ActivityFamily; count: number }>();
    for (const spot of initialSpots) {
      const existing = map.get(spot.activitySlug);
      if (existing) existing.count++;
      else map.set(spot.activitySlug, { slug: spot.activitySlug, label: spot.activityLabel, family: spot.family, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [initialSpots]);

  // ── Filtered spot list ────────────────────────────────────────────────────
  const visibleSpots = useMemo(() => {
    return initialSpots.filter((spot) => {
      if (familyFilter !== "all" && spot.family !== familyFilter) return false;
      if (activityFilter !== "all" && spot.activitySlug !== activityFilter) return false;
      return true;
    });
  }, [initialSpots, familyFilter, activityFilter]);

  // ── Push filtered spots into the GeoJSON source ───────────────────────────
  useEffect(() => {
    currentVisibleSpotsRef.current = visibleSpots;
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(buildFeatureCollection(visibleSpots));
  }, [visibleSpots]);

  // ── Selection highlight via feature-state ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (lastSelectedRef.current && lastSelectedRef.current !== selectedUid) {
      map.setFeatureState(
        { source: SOURCE_ID, id: lastSelectedRef.current },
        { selected: false },
      );
    }
    if (selectedUid) {
      map.setFeatureState({ source: SOURCE_ID, id: selectedUid }, { selected: true });
    }
    lastSelectedRef.current = selectedUid;
  }, [selectedUid]);

  // ── Action handlers ───────────────────────────────────────────────────────

  function focusSpot(spot: GlobalSpot) {
    setSelectedUid(spot.uid);
    setSheetOpen(true);
    mapRef.current?.flyTo({
      center: [spot.longitude, spot.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 9),
      speed: 1.5,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalCount = initialSpots.length;
  const selected = initialSpots.find((s) => s.uid === selectedUid) ?? null;

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
          {visibleSpots.length} of {totalCount} spot{totalCount === 1 ? "" : "s"}
        </span>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{sheetOpen ? "▾" : "▴"}</span>
      </button>

      <aside
        className={`spotsMapSidebar ${sheetOpen ? "is-open" : ""}`}
        style={sidebarStyle}
      >
        {/* Family filter — top level */}
        <div style={sidebarSection}>
          <div style={filterLabel}>Family</div>
          <div style={filterRow}>
            <FilterChip label="All" active={familyFilter === "all"} onClick={() => { setFamilyFilter("all"); setActivityFilter("all"); }} />
            {ACTIVITY_FAMILY_ORDER.filter((f) => initialSpots.some((s) => s.family === f)).map((f) => {
              const meta = ACTIVITY_FAMILY_META[f];
              return (
                <FilterChip
                  key={f}
                  label={meta.label}
                  active={familyFilter === f}
                  onClick={() => { setFamilyFilter(f); setActivityFilter("all"); }}
                  accent={meta.accent}
                />
              );
            })}
          </div>
        </div>

        {/* Activity filter — narrowed by family */}
        {activitiesPresent.filter((a) => familyFilter === "all" || a.family === familyFilter).length > 1 && (
          <div style={sidebarSection}>
            <div style={filterLabel}>Activity</div>
            <div style={filterRow}>
              <FilterChip label="All" active={activityFilter === "all"} onClick={() => setActivityFilter("all")} />
              {activitiesPresent
                .filter((a) => familyFilter === "all" || a.family === familyFilter)
                .map((a) => (
                  <FilterChip
                    key={a.slug}
                    label={`${a.label} (${a.count})`}
                    active={activityFilter === a.slug}
                    onClick={() => setActivityFilter(a.slug)}
                    accent={ACTIVITY_FAMILY_META[a.family].accent}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Selected spot detail card — nudges user toward the per-activity
            map for editing. */}
        {selected && (
          <div style={selectedCard}>
            <div style={selectedTitle}>{selected.name}</div>
            <div style={selectedMeta}>
              {selected.activityLabel}
              {selected.type ? ` · ${selected.type}` : ""}
              {selected.visitCount > 0 ? ` · ${selected.visitCount} visit${selected.visitCount === 1 ? "" : "s"}` : ""}
            </div>
            <Link href={selected.editHref} style={primaryLink}>
              Edit on {selected.activityLabel.toLowerCase()} map →
            </Link>
          </div>
        )}

        {/* Spot list */}
        <div style={listStyle}>
          {visibleSpots.length === 0 ? (
            <div style={emptyStyle}>
              {totalCount === 0
                ? "No spots placed yet. Add one from any activity's map page."
                : "No spots match this filter."}
            </div>
          ) : (
            visibleSpots.map((spot) => (
              <SpotRow
                key={spot.uid}
                spot={spot}
                selected={spot.uid === selectedUid}
                onFocus={() => focusSpot(spot)}
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
  selected,
  onFocus,
}: {
  spot: GlobalSpot;
  selected: boolean;
  onFocus: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFocus}
      style={{ ...spotRowStyle, ...(selected ? spotRowSelected : {}) }}
    >
      <span style={{ ...spotDot, background: spot.pinColor }} />
      <span style={{ display: "grid", gap: 1, minWidth: 0, textAlign: "left", flex: 1 }}>
        <span style={spotName}>{spot.name}</span>
        <span style={spotMeta}>
          {spot.activityLabel}
          {spot.type ? ` · ${spot.type}` : ""}
          {spot.visitCount > 0 ? ` · ${spot.visitCount} visit${spot.visitCount === 1 ? "" : "s"}` : ""}
        </span>
      </span>
    </button>
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
        borderColor: active ? color.replace("0.9)", "0.55)").replace("0.95)", "0.55)").replace("0.85)", "0.55)") : "rgba(255,255,255,0.12)",
        background: active ? color.replace("0.9)", "0.18)").replace("0.95)", "0.18)").replace("0.85)", "0.18)") : "rgba(255,255,255,0.04)",
        color: active ? color.replace("0.9)", "1)").replace("0.95)", "1)").replace("0.85)", "1)") : "rgba(255,255,255,0.78)",
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

// ── GeoJSON helpers ─────────────────────────────────────────────────────────

function buildFeatureCollection(spots: GlobalSpot[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: spots.map((spot) => ({
      type: "Feature",
      // `id` matches `promoteId: "uid"` on the source so feature-state
      // selection survives setData() calls.
      id: spot.uid,
      properties: {
        uid: spot.uid,
        pinColor: spot.pinColor,
      },
      geometry: { type: "Point", coordinates: [spot.longitude, spot.latitude] },
    })),
  };
}

// ── Styles ──────────────────────────────────────────────────────────────────

const layoutShell: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "calc(100vh - 200px)",
  minHeight: 480,
  overflow: "hidden",
};

const mapStyle: React.CSSProperties = { position: "absolute", inset: 0 };

const sidebarStyle: React.CSSProperties = {
  position: "absolute",
  background: "rgba(15,23,42,0.92)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 12,
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

const filterLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  opacity: 0.55,
};

const filterRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 5 };

const selectedCard: React.CSSProperties = {
  display: "grid", gap: 6, padding: 10, borderRadius: 12,
  background: "rgba(120,190,255,0.08)",
  border: "1px solid rgba(120,190,255,0.32)",
};

const selectedTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 900,
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const selectedMeta: React.CSSProperties = { fontSize: 11, opacity: 0.7 };

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

const listStyle: React.CSSProperties = {
  display: "grid", gap: 4, overflowY: "auto",
  maxHeight: 360, paddingRight: 2,
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12, opacity: 0.55, padding: "12px 4px", textAlign: "center",
};

const spotRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "6px 8px", borderRadius: 8,
  borderWidth: 1, borderStyle: "solid", borderColor: "transparent",
  background: "transparent", color: "inherit",
  cursor: "pointer", textAlign: "left", width: "100%",
};

const spotRowSelected: React.CSSProperties = {
  background: "rgba(120,190,255,0.08)",
  borderColor: "rgba(120,190,255,0.32)",
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
