"use client";

// Non-interactive mini-map for the location detail page. Uses MapLibre +
// raw OSM tiles (same dependency as the main map page). Pan/zoom/scroll
// are disabled — the map is a single-pin preview, and clicking it links to
// the full map page where the user can drag, search, and edit.
//
// Bundle cost: MapLibre is dynamic-loaded by Next on this page only; first
// visit pays ~80kb gzip, subsequent visits are cached. The full map page
// already loads it, so users coming from there have it warm.
//
// Mobile/PC: container uses .climbing-mini-map (200px / 240px responsive
// from globals.css). Pin position is read once on mount; we don't sync
// updates since the parent server component already reloads when coords
// change.

import Link from "next/link";
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_BASE_STYLE_ID, getBaseStyle } from "@/lib/map-styles";
import type { ClimbLocationType } from "@/lib/climb-types";

const GYM_COLOR = "rgba(78,148,255,0.95)";
const CRAG_COLOR = "rgba(74,222,128,0.95)";

export default function MiniLocationMap({
  latitude,
  longitude,
  type,
  name,
}: {
  latitude: number | null;
  longitude: number | null;
  type: ClimbLocationType;
  name: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  // Init map only when coords exist. If they're null we render the
  // placeholder below instead and skip MapLibre entirely.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (latitude == null || longitude == null) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getBaseStyle(DEFAULT_BASE_STYLE_ID),
      center: [longitude, latitude],
      zoom: 12,
      interactive: false, // disables drag/pinch — fixes "I scrolled the page and the map moved" frustration
      attributionControl: { compact: true },
    });

    // Drop a teardrop pin in the center. Inline SVG so no asset request.
    const color = type === "GYM" ? GYM_COLOR : CRAG_COLOR;
    const el = document.createElement("div");
    el.innerHTML = `
      <svg width="22" height="28" viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 1 C5 1, 1 5, 1 11 C1 18, 11 27, 11 27 C11 27, 21 18, 21 11 C21 5, 17 1, 11 1 Z"
          fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="1.5" />
        <circle cx="11" cy="11" r="4" fill="rgba(15,23,42,0.85)" />
        <text x="11" y="14" text-anchor="middle" font-size="8" font-family="system-ui" fill="white">${type === "GYM" ? "G" : "C"}</text>
      </svg>
    `;
    el.style.cssText = "width:22px;height:28px;cursor:pointer;";
    new maplibregl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([longitude, latitude])
      .addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, type]);

  if (latitude == null || longitude == null) {
    return (
      <Link
        href="/activities/climbing/map"
        className="climbing-mini-map"
        style={{
          display: "grid",
          placeItems: "center",
          textDecoration: "none",
          color: "inherit",
          gap: 6,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 24 }} aria-hidden>📍</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(160,200,255,0.95)" }}>
          Place {name} on the map →
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/activities/climbing/map"
      className="climbing-mini-map"
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
      aria-label={`Open ${name} on the full map`}
    >
      {/* pointer-events: none lets clicks fall through to the wrapping Link.
          We disabled interactivity at the map level too, but MapLibre's canvas
          can still swallow taps on mobile — this guarantees the link wins. */}
      <div ref={containerRef} style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
    </Link>
  );
}
