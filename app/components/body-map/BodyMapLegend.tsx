import type { ZoneFreshness } from "./types";
import { BODY_FRESHNESS_COLORS } from "@/lib/body-colors";

export const freshnessColors = BODY_FRESHNESS_COLORS;

const legendItems: Array<{ state: ZoneFreshness; label: string }> = [
  { state: "FRESH", label: "Fresh (7+ days or none)" },
  { state: "WORKED_TODAY", label: "Worked today / yesterday (0-1 days ago)" },
  { state: "RECENTLY_WORKED", label: "Recently worked (2-3 days ago)" },
  { state: "RECOVERING", label: "Recovering (4-6 days ago)" },
  { state: "INJURED", label: "Injured (active or flared)" },
];

export default function BodyMapLegend() {
  return (
    <div className="flex flex-wrap gap-2 rounded-[8px] border border-white/10 bg-white/[0.035] p-2 text-[11px] font-bold text-white/72" aria-label="Body map legend">
      {legendItems.map((item) => (
        <div
          key={item.state}
          className="inline-flex items-center gap-2 rounded-[8px] border border-white/10 bg-black/20 px-2 py-1"
        >
          <span
            className="h-3 w-5 rounded-[4px] border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.12)]"
            style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.42), ${freshnessColors[item.state]})` }}
            aria-hidden="true"
          />
          {item.label}
        </div>
      ))}
    </div>
  );
}
