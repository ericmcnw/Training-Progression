import type { ReactNode } from "react";

export type ZoneFreshness = "FRESH" | "WORKED_TODAY" | "RECENTLY_WORKED" | "RECOVERING" | "INJURED";

export type BodyMapView = "front" | "back" | "both";

export type ZoneState = {
  slug: string;
  label?: string;
  freshness: ZoneFreshness;
  painLevel?: number;
  activityCount?: number;
  // Days since this zone was last loaded. Used by the /body needs-attention
  // section to surface zones that have been sitting cold. Null = never
  // worked in the tracked window.
  daysSinceWorked?: number | null;
  // Underlying metadata group slug (e.g. "hamstrings"), used by /body to
  // dedupe left/right pairs into one muscle group entry for surfaces like
  // the needs-attention list.
  groupSlug?: string | null;
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
  /** Second arg is the view the zone was tapped from — lets callers place a
   *  detail panel under the right view. */
  onZoneClick?: (slug: string, view?: "front" | "back") => void;
  onZoneHover?: (slug: string | null) => void;
  size?: "sm" | "md" | "lg";
  showLegend?: boolean;
  /** Defaults to "male". TODO: read from user account once gender preference is collected at sign-up. */
  gender?: "male" | "female";
  /** Rendered full-width beneath the body panel(s) — e.g. the zone detail
   *  panel. The two maps stay side by side on desktop; the detail never
   *  splits them. */
  detailSlot?: ReactNode;
};

export type BodyZonePath = {
  slug: string;
  label: string;
  view: "front" | "back";
  d: string;
};
