"use client";

import { useMemo, useState } from "react";
import Body from "@mjcdev/react-body-highlighter";
import type { ExtendedBodyPart } from "@mjcdev/react-body-highlighter";
import BodyMapLegend from "./BodyMapLegend";
import type { BodyMapProps, BodyMapView, ZoneFreshness } from "./types";

// ─── Freshness → library intensity ───────────────────────────────────────────
// intensity 0 = not in data (default/unhighlighted)
// colors array indexes: 0=recently-worked, 1=recovering, 2=worked-today, 3=injured, 4=selected
const FRESHNESS_INTENSITY: Record<ZoneFreshness, number> = {
  FRESH: 0,
  RECENTLY_WORKED: 1,
  RECOVERING: 2,
  WORKED_TODAY: 3,
  INJURED: 4,
};

// Intensity for a selected zone (selectable mode)
const SELECTED_INTENSITY = 5;

// Colors: index 0 → intensity 1, index 4 → intensity 5
const BODY_COLORS = [
  "#2563EB", // 1 = recently worked (blue)
  "#93C5FD", // 2 = recovering (light blue)
  "#4338CA", // 3 = worked today (dark blue-purple)
  "#E11D1D", // 4 = injured (deep vivid red)
  "#ECFEFF", // 5 = selected (bright cyan-white)
] as const;

// ─── Custom overlay zones ────────────────────────────────────────────────────
// Drawn as SVG overlays because the library has no matching body part.
// Coordinates use the library's front-view space: viewBox "0 0 724 1448", center x=362.
// Hip flexor paths calibrated to the library's front-view space (viewBox "0 0 724 1448").
// Reference: obliques bottom ≈ y657, adductors top ≈ y647 → hip crease is right in that band.
// Each shape is ~50px wide × 82px tall — comparable to small zones like knees.
// Left center x≈287, right center x≈437 (symmetric around body center 362).
const CUSTOM_FRONT_ZONES: Array<{ slug: string; label: string; d: string }> = [
  {
    slug: "left-hip-flexor",
    label: "Left Hip Flexor",
    d: "M262 648 C272 634 308 634 316 648 C322 662 320 694 310 712 C298 724 274 722 266 708 C256 692 252 664 262 648 Z",
  },
  {
    slug: "right-hip-flexor",
    label: "Right Hip Flexor",
    d: "M408 648 C416 634 452 634 462 648 C472 664 472 692 458 708 C450 722 426 724 414 712 C404 694 402 662 408 648 Z",
  },
];

const FRESHNESS_FILL: Record<ZoneFreshness, string> = {
  FRESH:            "transparent", // invisible when unworked — only border shows
  RECENTLY_WORKED:  "#2563EB",
  RECOVERING:       "#93C5FD",
  WORKED_TODAY:     "#4338CA",
  INJURED:          "#E11D1D",
};
const SELECTED_FILL = "#ECFEFF";

// ─── Zone slug mapping ────────────────────────────────────────────────────────
type LibSide = "left" | "right" | null;
type LibSlug =
  | "abs" | "adductors" | "ankles" | "biceps" | "calves" | "chest"
  | "deltoids" | "feet" | "forearm" | "gluteal" | "hamstring" | "hands"
  | "hair" | "head" | "knees" | "lower-back" | "neck" | "obliques"
  | "quadriceps" | "tibialis" | "trapezius" | "triceps" | "upper-back";

type ZoneMapping = { slug: LibSlug; side: LibSide };

// Map our db slugs → library slug + side
const OUR_TO_LIB: Record<string, ZoneMapping> = {
  // Front view
  "neck-front":            { slug: "neck",        side: null    },
  "left-shoulder-front":   { slug: "deltoids",    side: "left"  },
  "right-shoulder-front":  { slug: "deltoids",    side: "right" },
  "left-chest":            { slug: "chest",       side: "left"  },
  "right-chest":           { slug: "chest",       side: "right" },
  "abs":                   { slug: "abs",         side: null    },
  "obliques":              { slug: "obliques",    side: null    },
  "left-bicep":            { slug: "biceps",      side: "left"  },
  "right-bicep":           { slug: "biceps",      side: "right" },
  "left-forearm-front":    { slug: "forearm",     side: "left"  },
  "right-forearm-front":   { slug: "forearm",     side: "right" },
  // hip flexors are rendered as a custom overlay — not mapped to library zones
  "left-quad":             { slug: "quadriceps",  side: "left"  },
  "right-quad":            { slug: "quadriceps",  side: "right" },
  "left-adductor":         { slug: "adductors",   side: "left"  },
  "right-adductor":        { slug: "adductors",   side: "right" },
  "left-knee-front":       { slug: "knees",       side: "left"  },
  "right-knee-front":      { slug: "knees",       side: "right" },
  "left-shin":             { slug: "tibialis",    side: "left"  },
  "right-shin":            { slug: "tibialis",    side: "right" },
  // Ankle joints — the library art has a dedicated "ankles" zone, so these
  // need no custom overlay (unlike shoulder/hip/wrist/elbow).
  "left-ankle":            { slug: "ankles",      side: "left"  },
  "right-ankle":           { slug: "ankles",      side: "right" },
  // Fingers (maps to hands in library)
  "left-fingers":          { slug: "hands",       side: "left"  },
  "right-fingers":         { slug: "hands",       side: "right" },
  // Back view
  "neck-back":             { slug: "neck",        side: null    },
  "left-shoulder-back":    { slug: "deltoids",    side: "left"  },
  "right-shoulder-back":   { slug: "deltoids",    side: "right" },
  "upper-spine":           { slug: "trapezius",   side: null    },
  "mid-spine":             { slug: "trapezius",   side: null    },
  // Upper back (traps/rhomboids) → trapezius zone in library
  "left-upper-back":       { slug: "trapezius",   side: "left"  },
  "right-upper-back":      { slug: "trapezius",   side: "right" },
  // Lats → upper-back zone in library (visually distinct from traps)
  "left-lat":              { slug: "upper-back",  side: "left"  },
  "right-lat":             { slug: "upper-back",  side: "right" },
  "left-tricep":           { slug: "triceps",     side: "left"  },
  "right-tricep":          { slug: "triceps",     side: "right" },
  "left-forearm-back":     { slug: "forearm",     side: "left"  },
  "right-forearm-back":    { slug: "forearm",     side: "right" },
  "lower-back":            { slug: "lower-back",  side: null    },
  "left-glute":            { slug: "gluteal",     side: "left"  },
  "right-glute":           { slug: "gluteal",     side: "right" },
  "left-lateral-hip":      { slug: "gluteal",     side: "left"  },
  "right-lateral-hip":     { slug: "gluteal",     side: "right" },
  "left-hamstring-proximal":  { slug: "hamstring", side: "left"  },
  "right-hamstring-proximal": { slug: "hamstring", side: "right" },
  "left-hamstring-distal":    { slug: "hamstring", side: "left"  },
  "right-hamstring-distal":   { slug: "hamstring", side: "right" },
  "left-calf":             { slug: "calves",      side: "left"  },
  "right-calf":            { slug: "calves",      side: "right" },
  "left-achilles":         { slug: "calves",      side: "left"  },
  "right-achilles":        { slug: "calves",      side: "right" },
  "left-knee-back":        { slug: "knees",       side: "left"  },
  "right-knee-back":       { slug: "knees",       side: "right" },
};

// Reverse mapping: "libSlug-side" → primary our-slug (prefer the cleanest db slug)
const LIB_KEY_TO_OUR_SLUG: Record<string, string> = {
  "neck-c":           "neck-front",
  "deltoids-l":       "left-shoulder-front",
  "deltoids-r":       "right-shoulder-front",
  "chest-l":          "left-chest",
  "chest-r":          "right-chest",
  "abs-c":            "abs",
  "obliques-c":       "obliques",
  "biceps-l":         "left-bicep",
  "biceps-r":         "right-bicep",
  "forearm-l":        "left-forearm-front",
  "forearm-r":        "right-forearm-front",
  "hands-l":          "left-fingers",
  "hands-r":          "right-fingers",
  "adductors-l":      "left-adductor",
  "adductors-r":      "right-adductor",
  "quadriceps-l":     "left-quad",
  "quadriceps-r":     "right-quad",
  "knees-l":          "left-knee-front",
  "knees-r":          "right-knee-front",
  "tibialis-l":       "left-shin",
  "tibialis-r":       "right-shin",
  "ankles-l":         "left-ankle",
  "ankles-r":         "right-ankle",
  // Back — lats use upper-back zone, traps use trapezius zone
  "upper-back-l":     "left-lat",
  "upper-back-r":     "right-lat",
  "upper-back-c":     "upper-spine",
  "trapezius-l":      "left-upper-back",
  "trapezius-r":      "right-upper-back",
  "trapezius-c":      "upper-spine",
  "triceps-l":        "left-tricep",
  "triceps-r":        "right-tricep",
  "lower-back-c":     "lower-back",
  "gluteal-l":        "left-glute",
  "gluteal-r":        "right-glute",
  "hamstring-l":      "left-hamstring-proximal",
  "hamstring-r":      "right-hamstring-proximal",
  "calves-l":         "left-calf",
  "calves-r":         "right-calf",
};

// For back-view clicks, override with back-specific zone slugs where relevant
const LIB_KEY_TO_OUR_SLUG_BACK: Record<string, string> = {
  "neck-c":       "neck-back",
  "deltoids-l":   "left-shoulder-back",
  "deltoids-r":   "right-shoulder-back",
  "forearm-l":    "left-forearm-back",
  "forearm-r":    "right-forearm-back",
  "knees-l":      "left-knee-back",
  "knees-r":      "right-knee-back",
};

function libKey(slug: string, side?: "left" | "right"): string {
  return `${slug}-${side === "left" ? "l" : side === "right" ? "r" : "c"}`;
}

// ─── Build library data array ─────────────────────────────────────────────────
function buildLibData(
  zones: Array<{ slug: string; freshness: ZoneFreshness }>,
  selectedSet: Set<string>,
  selectable: boolean,
): ExtendedBodyPart[] {
  // Aggregate: for each lib slug, track max intensity per side
  const agg = new Map<LibSlug, { left: number; right: number; central: number }>();

  const addIntensity = (slug: LibSlug, side: LibSide, intensity: number) => {
    if (!agg.has(slug)) agg.set(slug, { left: 0, right: 0, central: 0 });
    const entry = agg.get(slug)!;
    if (side === "left")  entry.left    = Math.max(entry.left,    intensity);
    else if (side === "right") entry.right = Math.max(entry.right, intensity);
    else                  entry.central = Math.max(entry.central, intensity);
  };

  // Add zone states
  for (const zone of zones) {
    const mapping = OUR_TO_LIB[zone.slug];
    if (!mapping) continue;
    const isSelected = selectable && selectedSet.has(zone.slug);
    const intensity = isSelected ? SELECTED_INTENSITY : FRESHNESS_INTENSITY[zone.freshness];
    if (intensity === 0) continue;
    addIntensity(mapping.slug, mapping.side, intensity);
  }

  // Add selected zones that had no zone state entry
  if (selectable) {
    for (const ourSlug of selectedSet) {
      const mapping = OUR_TO_LIB[ourSlug];
      if (!mapping) continue;
      addIntensity(mapping.slug, mapping.side, SELECTED_INTENSITY);
    }
  }

  // Convert aggregation to library format
  const result: ExtendedBodyPart[] = [];
  for (const [slug, entry] of agg) {
    if (entry.left === 0 && entry.right === 0 && entry.central === 0) continue;

    const part: ExtendedBodyPart = { slug };
    if (entry.left > 0 || entry.right > 0) {
      if (entry.left > 0)  part.leftSideIntensity  = entry.left;
      if (entry.right > 0) part.rightSideIntensity = entry.right;
      if (entry.left > 0 && entry.right === 0) part.side = "left";
      if (entry.right > 0 && entry.left === 0) part.side = "right";
    } else {
      part.intensity = entry.central;
    }
    result.push(part);
  }
  return result;
}

// ─── Single body panel ────────────────────────────────────────────────────────
function BodyPanel({
  view,
  libData,
  gender,
  onZoneClick,
  onZoneHover,
  zones,
  selectedSet,
  selectable,
}: {
  view: "front" | "back";
  libData: ExtendedBodyPart[];
  gender: "male" | "female";
  onZoneClick?: (slug: string) => void;
  onZoneHover?: (slug: string | null) => void;
  zones: Array<{ slug: string; freshness: ZoneFreshness }>;
  selectedSet: Set<string>;
  selectable: boolean;
}) {
  const handleClick = (part: ExtendedBodyPart, side?: "left" | "right") => {
    const key = libKey(part.slug ?? "", side);
    const ourSlug =
      (view === "back" ? LIB_KEY_TO_OUR_SLUG_BACK[key] : undefined) ??
      LIB_KEY_TO_OUR_SLUG[key];
    if (ourSlug) {
      onZoneClick?.(ourSlug);
      onZoneHover?.(ourSlug);
    }
  };

  const zoneStateMap = useMemo(() => {
    const m = new Map<string, ZoneFreshness>();
    for (const z of zones) m.set(z.slug, z.freshness);
    return m;
  }, [zones]);

  return (
    <div className="grid min-w-0 gap-2 rounded-[10px] border border-white/[0.07] bg-[#040c18] p-3">
      <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
        <span>{view === "front" ? "Anterior" : "Posterior"}</span>
        <span className="rounded-[4px] border border-cyan-400/20 bg-cyan-400/[0.07] px-2 py-0.5 font-mono text-cyan-300/60">
          {view === "front" ? "FRONT" : "BACK"}
        </span>
      </div>
      {/* Wrapper is relative so the custom overlay SVG can sit over the library body */}
      <div className="relative">
        <div className="[&>svg]:!h-auto [&>svg]:!w-full">
          <Body
            data={libData}
            side={view}
            gender={gender}
            scale={2}
            colors={BODY_COLORS}
            border="rgba(148,163,184,0.4)"
            onBodyPartClick={onZoneClick ? handleClick : undefined}
          />
        </div>
        {view === "front" && (
          <svg
            viewBox="0 0 724 1448"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            {CUSTOM_FRONT_ZONES.map((zone) => {
              const freshness = zoneStateMap.get(zone.slug) ?? "FRESH";
              const isSelected = selectable && selectedSet.has(zone.slug);
              const fill = isSelected ? SELECTED_FILL : FRESHNESS_FILL[freshness];
              const fresh = freshness === "FRESH" && !isSelected;
              return (
                <path
                  key={zone.slug}
                  d={zone.d}
                  fill={fill}
                  // transparent fill still needs to be clickable
                  pointerEvents="all"
                  stroke={fresh ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.55)"}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  className={onZoneClick ? "pointer-events-auto cursor-pointer" : ""}
                  onClick={onZoneClick ? () => onZoneClick(zone.slug) : undefined}
                  onMouseEnter={onZoneHover ? () => onZoneHover(zone.slug) : undefined}
                  onMouseLeave={onZoneHover ? () => onZoneHover(null) : undefined}
                  aria-label={zone.label}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BodyMap({
  zones,
  view = "both",
  selectable = false,
  selectedSlugs = [],
  onZoneClick,
  onZoneHover,
  size = "md",
  showLegend = true,
  gender = "male",
}: BodyMapProps) {
  const [activeView, setActiveView] = useState<BodyMapView>(view);
  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const libData = useMemo(
    () => buildLibData(zones, selectedSet, selectable),
    [zones, selectedSet, selectable],
  );
  const views = activeView === "both" ? (["front", "back"] as const) : [activeView];

  return (
    <div className="relative mx-auto grid w-full gap-4" style={{ maxWidth: size === "sm" ? 360 : size === "lg" ? 760 : 560 }}>
      {/* ── View toggle toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-white/[0.07] bg-white/[0.025] p-2 text-xs font-bold text-white/50">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] tracking-widest text-cyan-300/70">BODY MAP</span>
        </div>
        <div className="flex gap-1">
          {(["front", "both", "back"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setActiveView(opt)}
              className={`rounded-[5px] border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                activeView === opt
                  ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                  : "border-white/[0.07] bg-white/[0.025] text-white/40 hover:bg-white/[0.06]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body panels ────────────────────────────────────────────────────── */}
      <div className={`grid gap-4 ${views.length === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {views.map((v) => (
          <BodyPanel
            key={v}
            view={v}
            libData={libData}
            gender={gender}
            onZoneClick={onZoneClick}
            onZoneHover={onZoneHover}
            zones={zones}
            selectedSet={selectedSet}
            selectable={selectable}
          />
        ))}
      </div>

      {showLegend ? <BodyMapLegend /> : null}
    </div>
  );
}
