export type ZoneFreshness = "FRESH" | "WORKED_TODAY" | "RECENTLY_WORKED" | "RECOVERING" | "INJURED";

export type BodyMapView = "front" | "back" | "both";

export type ZoneState = {
  slug: string;
  label?: string;
  freshness: ZoneFreshness;
  painLevel?: number;
  activityCount?: number;
  recentWorkEntries?: Array<{
    id: string;
    label: string;
    performedAt: string;
    source: string;
    intensity: string | null;
    routineLogId?: string | null;
  }>;
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
  /** Defaults to "male". TODO: read from user account once gender preference is collected at sign-up. */
  gender?: "male" | "female";
};

export type BodyZonePath = {
  slug: string;
  label: string;
  view: "front" | "back";
  d: string;
};
