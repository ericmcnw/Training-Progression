export type ZoneFreshness = "FRESH" | "WORKED_TODAY" | "RECENTLY_WORKED" | "RECOVERING" | "INJURED";

export type BodyMapView = "front" | "back" | "both";

export type ZoneState = {
  slug: string;
  freshness: ZoneFreshness;
  painLevel?: number;
  activityCount?: number;
};

export type BodyMapProps = {
  zones: ZoneState[];
  view?: BodyMapView;
  selectable?: boolean;
  selectedSlugs?: string[];
  onZoneClick?: (slug: string) => void;
  onZoneHover?: (slug: string | null) => void;
  size?: "sm" | "md" | "lg";
  showLegend?: boolean;
};

export type BodyZonePath = {
  slug: string;
  label: string;
  view: "front" | "back";
  d: string;
};
