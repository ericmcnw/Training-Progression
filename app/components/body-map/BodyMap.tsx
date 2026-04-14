"use client";

import { useEffect, useId, useMemo, useState } from "react";
import BodyMapLegend from "./BodyMapLegend";
import { allBodyZonePaths } from "./bodyZonePaths";
import type { BodyMapProps, BodyMapView, BodyZonePath, ZoneFreshness, ZoneState } from "./types";
import { BODY_OUTLINE_STROKE, BODY_SELECTED_STROKE } from "@/lib/body-colors";

const sizeClasses = {
  sm: "max-w-[360px]",
  md: "max-w-[560px]",
  lg: "max-w-[760px]",
};

const stateLabels: Record<ZoneFreshness, string> = {
  FRESH: "Fresh",
  WORKED_TODAY: "Worked today",
  RECENTLY_WORKED: "Recently worked",
  RECOVERING: "Recovering",
  INJURED: "Injured",
};

// ─── Zone color config ────────────────────────────────────────────────────────
// Each freshness state gets a top/mid/bot color for a LINEAR gradient running
// from the shoulder line (y=58) to the ankle (y=440) — one global light source
// from above-left, no per-zone balloon puffing.
type ZoneColors = { top: string; mid: string; bot: string; bloom: string; stroke: string };

const zoneColors: Record<ZoneFreshness, ZoneColors> = {
  FRESH: {
    top:   "rgba(62,105,190,0.96)",
    mid:   "rgba(28,58,128,0.92)",
    bot:   "rgba(5,12,42,0.99)",
    bloom: "rgba(0,0,0,0)",
    stroke:"rgba(72,128,225,0.50)",
  },
  WORKED_TODAY: {
    top:   "rgba(38,225,165,0.97)",
    mid:   "rgba(12,148,112,0.93)",
    bot:   "rgba(0,30,22,0.99)",
    bloom: "rgba(45,212,191,0.88)",
    stroke:"rgba(40,220,188,0.68)",
  },
  RECENTLY_WORKED: {
    top:   "rgba(50,200,255,0.96)",
    mid:   "rgba(16,118,212,0.92)",
    bot:   "rgba(1,38,92,0.99)",
    bloom: "rgba(56,189,248,0.80)",
    stroke:"rgba(50,192,255,0.62)",
  },
  RECOVERING: {
    top:   "rgba(255,232,48,0.97)",
    mid:   "rgba(202,130,8,0.92)",
    bot:   "rgba(48,20,0,0.99)",
    bloom: "rgba(250,204,21,0.82)",
    stroke:"rgba(242,192,20,0.68)",
  },
  INJURED: {
    top:   "rgba(255,88,55,0.97)",
    mid:   "rgba(212,32,32,0.93)",
    bot:   "rgba(52,4,4,0.99)",
    bloom: "rgba(251,113,133,0.92)",
    stroke:"rgba(252,82,82,0.72)",
  },
};

const ALL_FRESHNESSES: ZoneFreshness[] = [
  "FRESH", "WORKED_TODAY", "RECENTLY_WORKED", "RECOVERING", "INJURED",
];

// ─── Body silhouette shell ────────────────────────────────────────────────────
const humanShellPath =
  "M100 18 C87 18 80 29 81 42 C82 53 88 61 92 64 C82 65 72 67 64 72 C53 78 46 90 43 106 C38 128 36 151 33 174 C31 193 29 213 33 221 C35 226 41 226 44 221 C48 211 50 190 52 172 C54 153 55 136 58 119 C61 140 60 169 56 197 C53 219 59 232 62 250 C66 276 62 310 59 340 C56 364 54 390 54 414 C54 424 67 425 80 421 C83 398 86 374 88 350 C91 319 94 291 98 265 C99 258 101 258 102 265 C106 291 109 319 112 350 C114 374 117 398 120 421 C133 425 146 424 146 414 C146 390 144 364 141 340 C138 310 134 276 138 250 C141 232 147 219 144 197 C140 169 139 140 142 119 C145 136 146 153 148 172 C150 190 152 211 156 221 C159 226 165 226 167 221 C171 213 169 193 167 174 C164 151 162 128 157 106 C154 90 147 78 136 72 C128 67 118 65 108 64 C112 61 118 53 119 42 C120 29 113 18 100 18 Z";

// ─── Anatomical fascia / groove lines ────────────────────────────────────────
const frontGrooves = [
  "M100 78 L100 128",
  "M79 71 C73 80 69 91 69 103",
  "M121 71 C127 80 131 91 131 103",
  "M100 128 C93 132 82 131 76 127",
  "M100 128 C107 132 118 131 124 127",
  "M100 128 L100 193",
  "M84 148 C90 146 100 146 100 148 M100 148 C100 146 110 146 116 148",
  "M84 169 C90 167 100 167 100 169 M100 169 C100 167 110 167 116 169",
  "M84 128 C82 148 82 170 84 193",
  "M116 128 C118 148 118 170 116 193",
  "M63 103 C63 120 63 138 63 153",
  "M137 103 C137 120 137 138 137 153",
  "M69 222 C76 217 86 219 93 222",
  "M107 222 C114 219 124 217 131 222",
  "M79 289 C79 301 80 311 82 317",
  "M121 289 C121 301 120 311 118 317",
  "M67 229 C66 255 65 285 64 315",
  "M133 229 C134 255 135 285 136 315",
];

const backGrooves = [
  "M97 70 C97 108 97 148 97 185 M103 70 C103 108 103 148 103 185",
  "M72 74 C77 85 80 97 81 113",
  "M128 74 C123 85 120 97 119 113",
  "M93 128 C91 150 89 171 89 187",
  "M107 128 C109 150 111 171 111 187",
  "M66 127 C69 136 71 145 70 156",
  "M134 127 C131 136 129 145 130 156",
  "M72 92 C78 97 85 103 89 113",
  "M128 92 C122 97 115 103 111 113",
  "M100 228 L100 272",
  "M71 271 C74 277 78 282 81 287",
  "M129 271 C126 277 122 282 119 287",
  "M83 287 C83 299 84 311 84 316",
  "M117 287 C117 299 116 311 116 316",
  "M73 368 C73 378 73 388 73 394",
  "M127 368 C127 378 127 388 127 394",
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function zoneStateFor(slug: string, zoneMap: Map<string, ZoneState>): ZoneState {
  return zoneMap.get(slug) ?? { slug, freshness: "FRESH" };
}

type TooltipData = { zone: BodyZonePath; state: ZoneState; x: number; y: number };

// ─── Silhouette panel ─────────────────────────────────────────────────────────
function Silhouette({
  paths,
  zoneMap,
  selected,
  selectable,
  onZoneClick,
  onZoneHover,
  setTooltip,
  mapId,
}: {
  paths: BodyZonePath[];
  zoneMap: Map<string, ZoneState>;
  selected: Set<string>;
  selectable: boolean;
  onZoneClick?: (slug: string) => void;
  onZoneHover?: (slug: string | null) => void;
  setTooltip: (t: TooltipData | null) => void;
  mapId: string;
}) {
  const view = paths[0]?.view ?? "front";
  const pid = `${mapId}-${view}`;
  const isInteractive = selectable || Boolean(onZoneClick);
  const grooves = view === "front" ? frontGrooves : backGrooves;

  return (
    <div className="body-map-panel relative grid min-w-0 gap-2 rounded-[10px] border border-white/[0.07] bg-[#040c18] p-3">
      <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
        <span>{view === "front" ? "Anterior" : "Posterior"}</span>
        <span className="rounded-[4px] border border-cyan-400/20 bg-cyan-400/[0.07] px-2 py-0.5 font-mono text-cyan-300/60">
          {view === "front" ? "FRONT" : "BACK"}
        </span>
      </div>

      <svg
        viewBox="0 14 200 426"
        role="img"
        aria-label={`${view === "front" ? "Front" : "Back"} body map`}
        className="body-map-svg h-auto w-full overflow-visible"
      >
        <defs>
          {/* ── Body silhouette base ─────────────────────────────────────── */}
          <linearGradient id={`${pid}-bg`} x1="0.35" x2="0.65" y1="0" y2="1">
            <stop offset="0%"   stopColor="#0c1e3a" />
            <stop offset="50%"  stopColor="#071428" />
            <stop offset="100%" stopColor="#040c1e" />
          </linearGradient>

          {/* ── Per-freshness zone fill gradients ───────────────────────────
               LINEAR, gradientUnits="userSpaceOnUse":
               • All zones share the same light direction (top-left → bottom)
               • No per-zone balloon puffing — each zone reads as a flat plane
                 lit from a single global source                               */}
          {ALL_FRESHNESSES.map((f) => {
            const c = zoneColors[f];
            return (
              <linearGradient
                key={f}
                id={`${pid}-base-${f}`}
                gradientUnits="userSpaceOnUse"
                x1="70"
                y1="58"
                x2="130"
                y2="440"
              >
                <stop offset="0%"   stopColor={c.top} />
                <stop offset="44%"  stopColor={c.mid} />
                <stop offset="100%" stopColor={c.bot} />
              </linearGradient>
            );
          })}

          {/* ── Global directional light — upper-left source ─────────────── */}
          <radialGradient id={`${pid}-light`} gradientUnits="userSpaceOnUse" cx="62" cy="72" r="185">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.34)" />
            <stop offset="48%"  stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* ── Cool rim / bounce light — lower-right ────────────────────── */}
          <radialGradient id={`${pid}-rim`} gradientUnits="userSpaceOnUse" cx="158" cy="360" r="165">
            <stop offset="0%"   stopColor="rgba(55,140,255,0.20)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>

          {/* ── Muscle fiber striations ───────────────────────────────────── */}
          <pattern
            id={`${pid}-fiber`}
            width="5.5"
            height="5.5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-28)"
          >
            <line x1="0" y1="2.75" x2="5.5" y2="2.75"
                  stroke="rgba(255,255,255,0.18)" strokeWidth="0.30" />
          </pattern>

          {/* ── Hex grid background ───────────────────────────────────────── */}
          <pattern id={`${pid}-hex`} patternUnits="userSpaceOnUse" width="16" height="18.48">
            <path
              d="M8,1 L15,4.74 L15,13.74 L8,17.48 L1,13.74 L1,4.74 Z"
              fill="none"
              stroke="rgba(60,160,255,0.055)"
              strokeWidth="0.5"
            />
          </pattern>

          {/* ── Bloom — wide diffuse glow for active zones ────────────────── */}
          <filter id={`${pid}-bloom`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="b1" />
            <feGaussianBlur in="b1" stdDeviation="4" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
            </feMerge>
          </filter>

          {/* ── Selected glow ─────────────────────────────────────────────── */}
          <filter id={`${pid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* ── Groove blur — keeps fascia lines anatomically soft ─────────── */}
          <filter id={`${pid}-groove`} x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation="0.42" />
          </filter>

          {/* ── Zone drop shadow ──────────────────────────────────────────── */}
          <filter id={`${pid}-shadow`} x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.4" floodColor="rgba(0,0,0,0.80)" />
          </filter>

          {/* ── Per-zone clip paths ───────────────────────────────────────── */}
          {paths.map((z) => (
            <clipPath key={z.slug} id={`${pid}-clip-${z.slug}`}>
              <path d={z.d} />
            </clipPath>
          ))}
        </defs>

        {/* ── Hex grid ─────────────────────────────────────────────────────── */}
        <rect x="20" y="16" width="160" height="414" rx="14"
              fill={`url(#${pid}-hex)`} opacity="0.85" />

        {/* ── Body silhouette base ──────────────────────────────────────────── */}
        <path
          d={humanShellPath}
          fill={`url(#${pid}-bg)`}
          stroke={BODY_OUTLINE_STROKE}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />

        {/* ══════════════════════════════════════════════════════════════════════
             MUSCLE ZONES
            ══════════════════════════════════════════════════════════════════════ */}
        {paths.map((zone) => {
          const state = zoneStateFor(zone.slug, zoneMap);
          const c = zoneColors[state.freshness];
          const isActive = state.freshness !== "FRESH";
          const isSelected = selected.has(zone.slug);

          const handleClick = () => { if (!isInteractive) return; onZoneClick?.(zone.slug); };
          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (!isInteractive) return;
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); }
          };
          const handleEnter = (e: React.MouseEvent) => {
            onZoneHover?.(zone.slug);
            setTooltip({ zone, state, x: e.clientX, y: e.clientY });
          };
          const handleMove = (e: React.MouseEvent) =>
            setTooltip({ zone, state, x: e.clientX, y: e.clientY });
          const handleLeave = () => { onZoneHover?.(null); setTooltip(null); };
          const handleFocus = (e: React.FocusEvent<SVGPathElement>) => {
            onZoneHover?.(zone.slug);
            const r = e.currentTarget.getBoundingClientRect();
            setTooltip({ zone, state, x: r.left + r.width / 2, y: r.top });
          };
          const handleBlur = () => { onZoneHover?.(null); setTooltip(null); };

          return (
            <g key={zone.slug}>
              {/* Layer 1 — Bloom glow behind zone (active / selected only) */}
              {(isActive || isSelected) && (
                <path
                  d={zone.d}
                  fill={c.bloom}
                  opacity={isSelected ? 0.72 : 0.48}
                  filter={`url(#${pid}-bloom)`}
                  pointerEvents="none"
                />
              )}

              {/* Layer 2 — Zone base fill (LINEAR directional gradient)
                   Same light source direction for EVERY zone — looks like a
                   real studio light from upper-left, not a per-zone balloon.  */}
              <path
                d={zone.d}
                fill={`url(#${pid}-base-${state.freshness})`}
                stroke={isSelected ? BODY_SELECTED_STROKE : c.stroke}
                strokeWidth={isSelected ? 2.0 : 1.1}
                vectorEffect="non-scaling-stroke"
                filter={isSelected ? `url(#${pid}-glow)` : `url(#${pid}-shadow)`}
                role={isInteractive ? "button" : "img"}
                tabIndex={isInteractive ? 0 : undefined}
                aria-label={`${zone.label}: ${stateLabels[state.freshness]}${
                  state.painLevel != null ? `, pain ${state.painLevel} out of 10` : ""
                }`}
                className={`transition-[filter,stroke-width] duration-300 ease-in-out ${
                  isInteractive ? "cursor-pointer focus:outline-none focus-visible:brightness-125" : ""
                } ${state.freshness === "INJURED" ? "body-map-injured" : ""}`}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={handleEnter}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />

              {/* Layer 3 — Clipped lighting overlays */}
              <g clipPath={`url(#${pid}-clip-${zone.slug})`} pointerEvents="none">
                {/* Fiber striations — hint of muscle direction */}
                <rect x="0" y="14" width="200" height="426"
                      fill={`url(#${pid}-fiber)`}
                      opacity={isActive ? 0.26 : 0.14} />
                {/* Directional light — upper-left catchlight */}
                <rect x="0" y="14" width="200" height="426"
                      fill={`url(#${pid}-light)`}
                      opacity={isActive ? 0.52 : 0.42} />
                {/* Rim light — cool blue bounce from lower-right */}
                <rect x="0" y="14" width="200" height="426"
                      fill={`url(#${pid}-rim)`}
                      opacity={isActive ? 0.42 : 0.22} />
              </g>
            </g>
          );
        })}

        {/* ── Fascia / groove lines ─────────────────────────────────────────────
             These are the PRIMARY visual separator between muscles.
             Dark trench + bright edge = anatomical 3D groove.                */}
        <g pointerEvents="none">
          {/* Dark trench */}
          {grooves.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="rgba(0,0,0,0.96)"
              strokeWidth="2.2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              filter={`url(#${pid}-groove)`}
            />
          ))}
          {/* Bright edge highlight alongside the groove */}
          {grooves.map((d) => (
            <path
              key={`hi-${d}`}
              d={d}
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="0.62"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {/* ── Body outline re-drawn on top ───────────────────────────────────── */}
        <path
          d={humanShellPath}
          fill="none"
          stroke={BODY_OUTLINE_STROKE}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />

        {/* ── Silhouette outer rim glow ──────────────────────────────────────── */}
        <path
          d={humanShellPath}
          fill="none"
          stroke="rgba(50,135,255,0.22)"
          strokeWidth="3.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: "blur(2px)" }}
        />

        {/* ── Scan line (animated sweep) ─────────────────────────────────────── */}
        <line
          x1="30" y1="0" x2="170" y2="0"
          stroke="rgba(0,220,255,0.55)"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
          className="body-map-scanline"
        />
      </svg>
    </div>
  );
}

// ─── View helpers ─────────────────────────────────────────────────────────────
function selectedViews(view: BodyMapView) {
  return view === "both" ? (["front", "back"] as const) : ([view] as const);
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
}: BodyMapProps) {
  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.slug, z])), [zones]);
  const selected = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [activeView, setActiveView] = useState<BodyMapView>(view);
  const mapId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const views = selectedViews(activeView);

  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (
        ev.target instanceof HTMLInputElement ||
        ev.target instanceof HTMLTextAreaElement ||
        ev.target instanceof HTMLSelectElement
      ) return;
      if (ev.key.toLowerCase() === "f") setActiveView("front");
      if (ev.key.toLowerCase() === "b") setActiveView("back");
      if (ev.key.toLowerCase() === "t")
        setActiveView((v) => (v === "both" ? "front" : "both"));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={`relative mx-auto grid w-full gap-4 ${sizeClasses[size]}`}>
      <style jsx>{`
        .body-map-panel {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.05),
            0 24px 60px rgba(0,0,0,0.45);
        }
        .body-map-svg {
          filter: drop-shadow(0 18px 32px rgba(0,0,0,0.48));
        }
        .body-map-injured {
          animation: bodyMapPulse 2s ease-in-out infinite;
        }
        @keyframes bodyMapPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.62; }
        }
        .body-map-scanline {
          animation: scanSweep 4s linear infinite;
          transform-box: fill-box;
        }
        @keyframes scanSweep {
          0%   { transform: translateY(14px);  opacity: 0; }
          5%   { opacity: 0.8; }
          90%  { opacity: 0.5; }
          100% { transform: translateY(430px); opacity: 0; }
        }
      `}</style>

      {/* ── View toggle toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-white/[0.07] bg-white/[0.025] p-2 text-xs font-bold text-white/50">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] tracking-widest text-cyan-300/70">BODY SCAN</span>
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

      {/* ── Silhouette panels ───────────────────────────────────────────────── */}
      <div className={`grid gap-4 ${views.length === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {views.map((v) => (
          <Silhouette
            key={v}
            paths={allBodyZonePaths.filter((z) => z.view === v)}
            zoneMap={zoneMap}
            selected={selected}
            selectable={selectable}
            onZoneClick={onZoneClick}
            onZoneHover={onZoneHover}
            setTooltip={setTooltip}
            mapId={mapId}
          />
        ))}
      </div>

      {showLegend ? <BodyMapLegend /> : null}

      {/* ── Hover / focus tooltip ───────────────────────────────────────────── */}
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 grid gap-1 rounded-[8px] border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-100 shadow-xl"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          <span
            aria-hidden="true"
            className="absolute -left-1 top-3 h-2 w-2 rotate-45 border-b border-l border-gray-700 bg-gray-900"
          />
          <div className="font-black tracking-wide">{tooltip.zone.label}</div>
          <div className="text-gray-400">{stateLabels[tooltip.state.freshness]}</div>
          {(tooltip.state.activityCount != null || tooltip.state.painLevel != null) && (
            <div className="font-mono text-[10px] text-gray-500">
              {tooltip.state.activityCount ?? 0} activities
              {tooltip.state.painLevel != null ? ` · pain ${tooltip.state.painLevel}/10` : ""}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
