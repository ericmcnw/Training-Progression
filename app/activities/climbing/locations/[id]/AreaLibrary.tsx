"use client";

// Area library for a single ClimbLocation. Each named sub-area (sector /
// wall) gets a card with its climb/sent counts and last visit, a link into
// the area-filtered climbs browser, and an expandable photos panel that
// attaches media directly to the ClimbArea (topos, approach shots, sector
// overviews). Mirrors ProblemLibrary's expand-inline pattern.

import { useState } from "react";
import Link from "next/link";
import { formatAppDate } from "@/lib/dates";
import MediaGallery, { type GalleryMediaItem } from "@/app/components/climbing/MediaGallery";
import MediaUploader from "@/app/components/climbing/MediaUploader";

export type AreaLibraryEntry = {
  id: string;
  name: string;
  climbCount: number;
  sentCount: number;
  lastVisit: Date | null;
  media: GalleryMediaItem[];
};

export default function AreaLibrary({
  locationId,
  entries,
}: {
  locationId: string;
  entries: AreaLibraryEntry[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {entries.map((a) => {
        const expanded = expandedId === a.id;
        return (
          <div key={a.id} style={{ ...cardStyle, ...(expanded ? cardExpandedStyle : {}) }}>
            <div style={headerRowStyle}>
              <div style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{a.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 700 }}>
                  {a.climbCount === 0
                    ? "No climbs yet"
                    : `${a.climbCount} climb${a.climbCount === 1 ? "" : "s"} · ${a.sentCount} sent`}
                  {a.lastVisit
                    ? ` · last ${formatAppDate(a.lastVisit, { month: "short", day: "numeric", year: "numeric" })}`
                    : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setExpandedId((cur) => (cur === a.id ? null : a.id))}
                  style={expanded ? photoBtnActiveStyle : photoBtnStyle}
                  aria-expanded={expanded}
                >
                  📷 {a.media.length > 0 ? a.media.length : "Photos"} {expanded ? "▴" : "▾"}
                </button>
                <Link
                  href={`/activities/climbing/climbs?location=${encodeURIComponent(locationId)}&area=${encodeURIComponent(a.id)}`}
                  style={browseLinkStyle}
                >
                  Browse →
                </Link>
              </div>
            </div>

            {expanded && (
              <div style={expandedBodyStyle}>
                <MediaUploader target={{ kind: "area", areaId: a.id }} />
                <MediaGallery
                  items={a.media}
                  emptyHint="No photos for this area yet — add an approach shot, sector overview, or topo above."
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "grid",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const cardExpandedStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  flexWrap: "wrap",
};

const photoBtnStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "transparent",
  color: "rgba(255,255,255,0.85)",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  minHeight: 34,
};

const photoBtnActiveStyle: React.CSSProperties = {
  ...photoBtnStyle,
  background: "rgba(120,190,255,0.15)",
  borderColor: "rgba(120,190,255,0.45)",
  color: "rgba(191,219,254,0.98)",
};

const browseLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  fontSize: 11,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
  minHeight: 34,
};

const expandedBodyStyle: React.CSSProperties = {
  padding: "10px 12px 12px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "grid",
  gap: 12,
};
