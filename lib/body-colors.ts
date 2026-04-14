import type { ZoneFreshness } from "@/app/components/body-map/types";

export const BODY_FRESHNESS_COLORS: Record<ZoneFreshness, string> = {
  FRESH: "#203642",
  WORKED_TODAY: "#2DD4BF",
  RECENTLY_WORKED: "#38BDF8",
  RECOVERING: "#FACC15",
  INJURED: "#FB7185",
};

export const BODY_SELECTED_STROKE = "#ECFEFF";
export const BODY_OUTLINE_STROKE = "rgba(148, 163, 184, 0.68)";
