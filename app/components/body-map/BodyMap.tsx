"use client";

import { Fragment, useMemo, useState } from "react";
import Body from "@mjcdev/react-body-highlighter";
import type { ExtendedBodyPart } from "@mjcdev/react-body-highlighter";
import BodyMapLegend from "./BodyMapLegend";
import type { BodyMapProps, BodyMapView, ZoneFreshness } from "./types";

// ─── Freshness → library intensity ───────────────────────────────────────────
// intensity 0 = not in data (default/unhighlighted)
const FRESHNESS_INTENSITY: Record<ZoneFreshness, number> = {
  FRESH: 0,
  RECENTLY_WORKED: 1,
  RECOVERING: 2,
  WORKED_TODAY: 3,
  INJURED: 4,
};

// Intensity for a selected zone (selectable mode)
const SELECTED_INTENSITY = 5;

// Pain red-ramp: light → deep red, mapped from pain level 1-10. A higher pain
// score reads as a deeper, more saturated red — so the body shows not just
// THAT a zone hurts but HOW much.
const PAIN_REDS = ["#FCA5A5", "#F87171", "#EF4444", "#DC2626", "#991B1B"] as const;
function painBucket(pain: number): number {
  // 1-2 → 0, 3-4 → 1, 5-6 → 2, 7-8 → 3, 9-10 → 4
  return Math.min(4, Math.max(0, Math.ceil(pain / 2) - 1));
}
function painRed(pain: number): string {
  return PAIN_REDS[painBucket(pain)];
}
// Pain occupies library intensities 6-10 (one per ramp shade), above the
// freshness/selected intensities so a painful zone always wins the color.
function painIntensity(pain: number): number {
  return 6 + painBucket(pain);
}

// Colors: index 0 → intensity 1. 1-5 = freshness + selected; 6-10 = pain ramp.
const BODY_COLORS = [
  "#2563EB", // 1 = recently worked (blue)
  "#93C5FD", // 2 = recovering (light blue)
  "#4338CA", // 3 = worked today (dark blue-purple)
  "#E11D1D", // 4 = injured, no pain score (vivid red)
  "#ECFEFF", // 5 = selected (bright cyan-white)
  ...PAIN_REDS, // 6-10 = pain level ramp
] as const;

// ─── Custom overlay zones ────────────────────────────────────────────────────
// Drawn as SVG overlays because the library has no matching body part.
// Coordinates use the library's front-view space: viewBox "0 0 724 1448", center x=362.
// Hip flexors are narrow, elongated teardrops (the iliopsoas runs diagonally
// from the inguinal crease down toward the inner thigh) — smaller and more
// muscle-like than the original round blobs, sitting medial to the hip joint
// markers. Symmetric around body center 362.
const CUSTOM_FRONT_ZONES: Array<{ slug: string; label: string; d: string }> = [
  {
    slug: "left-hip-flexor",
    label: "Left Hip Flexor",
    d: "M298 654 C304 648 316 650 318 660 C320 682 315 710 307 730 C303 736 298 734 296 728 C290 706 290 676 298 654 Z",
  },
  {
    slug: "right-hip-flexor",
    label: "Right Hip Flexor",
    d: "M426 654 C420 648 408 650 406 660 C404 682 409 710 417 730 C421 736 426 734 428 728 C434 706 434 676 426 654 Z",
  },
];

// Female hip flexors — same elongated teardrop, in the female front coordinate
// space (center x≈322, narrower body so they sit closer to center).
const CUSTOM_FRONT_ZONES_FEMALE: Array<{ slug: string; label: string; d: string }> = [
  {
    slug: "left-hip-flexor",
    label: "Left Hip Flexor",
    d: "M298 694 C303 688 312 690 314 700 C316 720 312 744 306 760 C302 766 298 764 296 758 C291 738 292 714 298 694 Z",
  },
  {
    slug: "right-hip-flexor",
    label: "Right Hip Flexor",
    d: "M346 694 C341 688 332 690 330 700 C328 720 332 744 338 760 C342 766 346 764 348 758 C353 738 352 714 346 694 Z",
  },
];

// Per-gender front-overlay config — viewBox MUST match the library body's own
// viewBox for the overlay to align. Back view has no overlay.
function frontOverlayConfig(gender: "male" | "female") {
  return gender === "female"
    ? { viewBox: "-50 -40 734 1538", zones: CUSTOM_FRONT_ZONES_FEMALE, joints: FRONT_JOINT_MARKERS_FEMALE }
    : { viewBox: "0 0 724 1448", zones: CUSTOM_FRONT_ZONES, joints: FRONT_JOINT_MARKERS_MALE };
}

const FRESHNESS_FILL: Record<ZoneFreshness, string> = {
  FRESH:            "transparent", // invisible when unworked — only border shows
  RECENTLY_WORKED:  "#2563EB",
  RECOVERING:       "#93C5FD",
  WORKED_TODAY:     "#4338CA",
  INJURED:          "#E11D1D",
};
const SELECTED_FILL = "#ECFEFF";

// ─── Joint markers ────────────────────────────────────────────────────────────
// Joints (shoulder, hip, wrist, elbow) aren't in the library art, so they're
// drawn as small ring markers — visually distinct from the organic muscle
// regions, and slightly offset from the nearby muscle so the joint and the
// muscle are separate tap targets (e.g. the hip joint sits just above/lateral
// to the hip-flexor region). Positions are anchored to the library's own
// body-part coordinates (front-view space, viewBox "0 0 724 1448").
//
// NOTE: male front only for now. The back view and the female bodies use
// different viewBoxes ("724 0 724 1448", "-50 -40 734 1538", "756 0 774 1448")
// and their own coordinates — those markers land once the front placement is
// dialed in visually.
// `interactive: false` markers are decorative rings drawn over a real library
// zone (knees, ankles) purely for visual unity — clicks pass through to the
// library button underneath. Interactive markers (shoulder/hip/wrist/elbow)
// have no library zone, so they own their own click target.
type JointMarker = { slug: string; label: string; cx: number; cy: number; r: number; interactive?: boolean };
const FRONT_JOINT_MARKERS_MALE: JointMarker[] = [
  { slug: "left-shoulder-joint",  label: "Left Shoulder (joint)",  cx: 266, cy: 324,  r: 17, interactive: true },
  { slug: "right-shoulder-joint", label: "Right Shoulder (joint)", cx: 458, cy: 324,  r: 17, interactive: true },
  { slug: "left-elbow",           label: "Left Elbow",             cx: 196, cy: 512,  r: 16, interactive: true },
  { slug: "right-elbow",          label: "Right Elbow",            cx: 528, cy: 512,  r: 16, interactive: true },
  { slug: "left-wrist",           label: "Left Wrist",             cx: 134, cy: 700,  r: 15, interactive: true },
  { slug: "right-wrist",          label: "Right Wrist",            cx: 590, cy: 700,  r: 15, interactive: true },
  { slug: "left-hip-joint",       label: "Left Hip (joint)",       cx: 266, cy: 634,  r: 16, interactive: true },
  { slug: "right-hip-joint",      label: "Right Hip (joint)",      cx: 458, cy: 634,  r: 16, interactive: true },
  // Decorative-only rings over the library's own knee/ankle zones.
  { slug: "left-knee-front",      label: "Left Knee",              cx: 293, cy: 1010, r: 16, interactive: false },
  { slug: "right-knee-front",     label: "Right Knee",             cx: 431, cy: 1010, r: 16, interactive: false },
  { slug: "left-ankle",           label: "Left Ankle",             cx: 284, cy: 1238, r: 14, interactive: false },
  { slug: "right-ankle",          label: "Right Ankle",            cx: 440, cy: 1238, r: 14, interactive: false },
];

// Female front uses a different art + viewBox ("-50 -40 734 1538"), so it has
// its own coordinates (body center x≈322). First pass — anchored to the female
// art's part positions but needs a visual tune like the male front did.
const FRONT_JOINT_MARKERS_FEMALE: JointMarker[] = [
  { slug: "left-shoulder-joint",  label: "Left Shoulder (joint)",  cx: 222, cy: 310,  r: 16, interactive: true },
  { slug: "right-shoulder-joint", label: "Right Shoulder (joint)", cx: 422, cy: 310,  r: 16, interactive: true },
  { slug: "left-elbow",           label: "Left Elbow",             cx: 150, cy: 468,  r: 15, interactive: true },
  { slug: "right-elbow",          label: "Right Elbow",            cx: 494, cy: 468,  r: 15, interactive: true },
  { slug: "left-wrist",           label: "Left Wrist",             cx: 96,  cy: 678,  r: 14, interactive: true },
  { slug: "right-wrist",          label: "Right Wrist",            cx: 548, cy: 678,  r: 14, interactive: true },
  { slug: "left-hip-joint",       label: "Left Hip (joint)",       cx: 272, cy: 690,  r: 15, interactive: true },
  { slug: "right-hip-joint",      label: "Right Hip (joint)",      cx: 372, cy: 690,  r: 15, interactive: true },
  { slug: "left-knee-front",      label: "Left Knee",              cx: 268, cy: 990,  r: 15, interactive: false },
  { slug: "right-knee-front",     label: "Right Knee",             cx: 376, cy: 990,  r: 15, interactive: false },
  { slug: "left-ankle",           label: "Left Ankle",             cx: 282, cy: 1332, r: 13, interactive: false },
  { slug: "right-ankle",          label: "Right Ankle",            cx: 362, cy: 1332, r: 13, interactive: false },
];

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
  zones: Array<{ slug: string; freshness: ZoneFreshness; painLevel?: number }>,
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

  // Add zone states. Pain dominates: a zone with a pain score ramps red by
  // severity; otherwise it falls back to its freshness color.
  for (const zone of zones) {
    const mapping = OUR_TO_LIB[zone.slug];
    if (!mapping) continue;
    const isSelected = selectable && selectedSet.has(zone.slug);
    const intensity = isSelected
      ? SELECTED_INTENSITY
      : zone.painLevel != null && zone.painLevel > 0
      ? painIntensity(zone.painLevel)
      : FRESHNESS_INTENSITY[zone.freshness];
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
  zones: Array<{ slug: string; freshness: ZoneFreshness; painLevel?: number }>;
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

  const zonePainMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const z of zones) if (z.painLevel != null && z.painLevel > 0) m.set(z.slug, z.painLevel);
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
            viewBox={frontOverlayConfig(gender).viewBox}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            {frontOverlayConfig(gender).zones.map((zone) => {
              const freshness = zoneStateMap.get(zone.slug) ?? "FRESH";
              const pain = zonePainMap.get(zone.slug);
              const isSelected = selectable && selectedSet.has(zone.slug);
              const fill = isSelected
                ? SELECTED_FILL
                : pain != null
                ? painRed(pain)
                : FRESHNESS_FILL[freshness];
              return (
                <path
                  key={zone.slug}
                  d={zone.d}
                  fill={fill}
                  // transparent fill still needs to be clickable
                  pointerEvents="all"
                  // Border matches the panel background (#040c18) so the
                  // hand-drawn hip-flexor shape blends into the body rather
                  // than showing a grey outline that reads as out-of-place.
                  stroke="#040c18"
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
            {/* Joint ring markers (per gender). A ring + center dot reads as a
                joint, not a muscle. Interactive ones own their click target;
                decorative ones (knee/ankle) let taps fall through to the
                library zone underneath. */}
            {frontOverlayConfig(gender).joints.map((joint) => {
              const freshness = zoneStateMap.get(joint.slug) ?? "FRESH";
              const pain = zonePainMap.get(joint.slug);
              const isSelected = selectable && selectedSet.has(joint.slug);
              const hurt = pain != null || freshness === "INJURED";
              const ringColor = isSelected
                ? SELECTED_FILL
                : pain != null
                ? painRed(pain)
                : freshness === "INJURED"
                ? "#E11D1D"
                : "rgba(186,230,253,0.85)"; // cyan-tinted ring so joints read apart from muscles
              const fill = isSelected ? "rgba(236,254,255,0.18)" : hurt ? "rgba(225,29,29,0.18)" : "rgba(8,15,28,0.55)";
              const clickable = joint.interactive !== false && Boolean(onZoneClick);
              return (
                <g key={joint.slug} aria-label={joint.label}>
                  <circle
                    cx={joint.cx}
                    cy={joint.cy}
                    r={joint.r}
                    fill={joint.interactive === false ? "none" : fill}
                    stroke={ringColor}
                    strokeWidth={3}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents={clickable ? "all" : "none"}
                    className={clickable ? "pointer-events-auto cursor-pointer" : ""}
                    onClick={clickable ? () => onZoneClick?.(joint.slug) : undefined}
                    onMouseEnter={clickable && onZoneHover ? () => onZoneHover(joint.slug) : undefined}
                    onMouseLeave={clickable && onZoneHover ? () => onZoneHover(null) : undefined}
                  />
                  {/* inner dot — marks it as a joint pivot */}
                  <circle cx={joint.cx} cy={joint.cy} r={joint.r * 0.28} fill={ringColor} pointerEvents="none" />
                </g>
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
  detailSlot,
}: BodyMapProps) {
  const [activeView, setActiveView] = useState<BodyMapView>(view);
  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const libData = useMemo(
    () => buildLibData(zones, selectedSet, selectable),
    [zones, selectedSet, selectable],
  );
  const views = activeView === "both" ? (["front", "back"] as const) : [activeView];
  // Where the detail slot goes — right under the front view when both are
  // shown, otherwise under the single visible view.
  const detailAfterView = (views as readonly string[]).includes("front") ? "front" : views[0];

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
      {/* With a detail slot open we drop to a single column so the detail can
          sit between front and back; otherwise both views go side by side on
          desktop. */}
      <div className={`grid gap-4 ${views.length === 2 && !detailSlot ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {views.map((v) => (
          <Fragment key={v}>
            <BodyPanel
              view={v}
              libData={libData}
              gender={gender}
              onZoneClick={onZoneClick}
              onZoneHover={onZoneHover}
              zones={zones}
              selectedSet={selectedSet}
              selectable={selectable}
            />
            {detailSlot && v === detailAfterView ? detailSlot : null}
          </Fragment>
        ))}
      </div>

      {showLegend ? <BodyMapLegend /> : null}
    </div>
  );
}
