// Map base-style configuration. Single source of truth for what tiles all
// three map views (climbing, per-activity, global) render against.
//
// HOW TO REVERT:
// - Default style: change DEFAULT_BASE_STYLE_ID below back to "raster-osm"
//   for the original plain OpenStreetMap look.
// - Hide the satellite toggle: set SATELLITE_TOGGLE_ENABLED to false.
// - Disable the new look entirely: set DEFAULT_BASE_STYLE_ID = "raster-osm"
//   AND SATELLITE_TOGGLE_ENABLED = false. Maps will look exactly like the
//   pre-change deploy.
//
// All providers are FREE and require NO API key. If any goes down:
// - OpenFreeMap: swap to "raster-dark" (Carto)
// - Esri satellite: swap SATELLITE_STYLE to a different free imagery URL
// - Carto: swap to "raster-osm" (vanilla OSM)

import type { StyleSpecification } from "maplibre-gl";

export type BaseStyleId =
  | "vector-liberty" // OpenFreeMap Liberty — colorful vector, Mapbox-like
  | "vector-fiord"   // OpenFreeMap Fiord   — dark vector, fits dark UI
  | "raster-dark"    // CartoDB Dark Matter — dark raster, simple
  | "raster-osm";    // Plain OpenStreetMap — fallback / original

/** The base style every map opens with. */
export const DEFAULT_BASE_STYLE_ID: BaseStyleId = "vector-liberty";

/** When true, each map shows a Map / Satellite toggle in the top-right. */
export const SATELLITE_TOGGLE_ENABLED = true;

const FONT_GLYPHS = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";

const RASTER_OSM: StyleSpecification = {
  version: 8,
  glyphs: FONT_GLYPHS,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

const RASTER_DARK: StyleSpecification = {
  version: 8,
  glyphs: FONT_GLYPHS,
  sources: {
    "carto-dark": {
      type: "raster",
      // CartoDB serves over a/b/c/d subdomains for parallel fetches.
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap, © CARTO",
      maxzoom: 20,
    },
  },
  layers: [{ id: "carto-dark", type: "raster", source: "carto-dark" }],
};

/** Esri World Imagery — global satellite imagery. Free for non-commercial. */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: FONT_GLYPHS,
  sources: {
    sat: {
      type: "raster",
      // Note: Esri uses {y}/{x} (TMS-style), not {x}/{y}.
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxzoom: 19,
    },
  },
  layers: [{ id: "sat", type: "raster", source: "sat" }],
};

/** Returns either a complete inline style spec or a URL string for vector
 *  styles hosted by the provider (OpenFreeMap loads its own glyphs/sprites). */
export function getBaseStyle(id: BaseStyleId): StyleSpecification | string {
  switch (id) {
    case "vector-liberty":
      return "https://tiles.openfreemap.org/styles/liberty";
    case "vector-fiord":
      return "https://tiles.openfreemap.org/styles/fiord";
    case "raster-dark":
      return RASTER_DARK;
    case "raster-osm":
    default:
      return RASTER_OSM;
  }
}

export function getSatelliteStyle(): StyleSpecification {
  return SATELLITE_STYLE;
}

/** What the toggle button shows the user as the "next" state. */
export function nextLabelFor(currentMode: "base" | "satellite"): string {
  return currentMode === "satellite" ? "Map" : "Satellite";
}
