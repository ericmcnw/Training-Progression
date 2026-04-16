"use client";

import Link from "next/link";
import { useState } from "react";
import BodyMap from "@/app/components/body-map/BodyMap";
import type { ZoneState, ZoneFreshness } from "@/app/components/body-map/types";

const freshnessLabel: Record<ZoneFreshness, string> = {
  FRESH: "Fresh",
  WORKED_TODAY: "Worked today",
  RECENTLY_WORKED: "Recently worked",
  RECOVERING: "Recovering",
  INJURED: "Injured",
};

const freshnessBadge: Record<ZoneFreshness, React.CSSProperties> = {
  FRESH:           { background: "rgba(229,231,235,0.10)", borderColor: "rgba(229,231,235,0.18)", color: "#E5E7EB" },
  WORKED_TODAY:    { background: "rgba(45,212,191,0.14)",  borderColor: "rgba(45,212,191,0.30)",  color: "#99F6E4" },
  RECENTLY_WORKED: { background: "rgba(56,189,248,0.14)",  borderColor: "rgba(56,189,248,0.28)",  color: "#BAE6FD" },
  RECOVERING:      { background: "rgba(250,204,21,0.14)",  borderColor: "rgba(250,204,21,0.30)",  color: "#FEF08A" },
  INJURED:         { background: "rgba(251,113,133,0.14)", borderColor: "rgba(251,113,133,0.30)", color: "#FCA5A5" },
};

export default function DashboardBodyMapClient({ zones }: { zones: ZoneState[] }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const selectedZone = selectedSlug ? zones.find((z) => z.slug === selectedSlug) ?? null : null;
  const zoneSlugs = zones.map((zone) => zone.slug);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <BodyMap
        zones={zones}
        size="sm"
        onZoneClick={(slug) => {
          const resolved = resolveVisibleZoneSlug(slug, zoneSlugs);
          if (!resolved) return;
          setSelectedSlug((prev) => (prev === resolved ? null : resolved));
        }}
        selectedSlugs={selectedSlug ? [selectedSlug] : []}
      />

      {selectedZone ? (
        <div style={infoCard}>
          <div style={infoHeader}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>
                {selectedZone.label ?? formatSlug(selectedZone.slug)}
              </div>
              <span style={{ ...badge, ...freshnessBadge[selectedZone.freshness] }}>
                {freshnessLabel[selectedZone.freshness]}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSlug(null)}
              style={closeBtn}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div style={statRow}>
            {selectedZone.activityCount != null && (
              <div style={stat}>
                <div style={statVal}>{selectedZone.activityCount}</div>
                <div style={statLbl}>work entries this week</div>
              </div>
            )}
            {selectedZone.painLevel != null && (
              <div style={stat}>
                <div style={{ ...statVal, color: "#FCA5A5" }}>{selectedZone.painLevel}/10</div>
                <div style={statLbl}>pain level</div>
              </div>
            )}
          </div>

          {selectedZone.recentWorkEntries && selectedZone.recentWorkEntries.length > 0 ? (
            <div style={activityList}>
              <div style={activityHeading}>What worked it</div>
              {selectedZone.recentWorkEntries.slice(0, 3).map((activity) => (
                <div key={activity.id} style={activityRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={activityLabel}>{activity.label}</div>
                    <div style={activityMeta}>{formatActivityDate(activity.performedAt)}</div>
                  </div>
                  <span style={chip}>{activity.source.toLowerCase().replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div style={linkRow}>
            <Link href={`/body/${selectedZone.slug}`} style={linkPrimary}>
              Full details
            </Link>
            <Link href={`/body/log-pain?zone=${selectedZone.slug}`} style={linkDanger}>
              Log pain
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatSlug(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveVisibleZoneSlug(slug: string, zoneSlugs: string[]) {
  if (zoneSlugs.includes(slug)) return slug;
  const aliases: Record<string, string[]> = {
    "left-hamstring-proximal": ["left-hamstring-distal", "left-hamstring"],
    "right-hamstring-proximal": ["right-hamstring-distal", "right-hamstring"],
    "left-shoulder-front": ["left-shoulder-back", "left-shoulder"],
    "right-shoulder-front": ["right-shoulder-back", "right-shoulder"],
    "left-forearm-front": ["left-forearm-back", "left-forearm"],
    "right-forearm-front": ["right-forearm-back", "right-forearm"],
    "left-knee-front": ["left-knee-back", "left-knee"],
    "right-knee-front": ["right-knee-back", "right-knee"],
  };
  for (const candidate of aliases[slug] ?? []) {
    const match = zoneSlugs.find((zoneSlug) => zoneSlug === candidate || zoneSlug.startsWith(`${candidate}-`));
    if (match) return match;
  }

  const sideRegion = slug.match(/^(left|right)-([a-z-]+?)(?:-(front|back|proximal|distal))?$/);
  if (!sideRegion) return null;
  const [, side, region] = sideRegion;
  return zoneSlugs.find((zoneSlug) => zoneSlug.startsWith(`${side}-${region}`)) ?? null;
}

function formatActivityDate(value: string) {
  return new Date(value).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

const infoCard: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  padding: 12,
  display: "grid",
  gap: 10,
};

const infoHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
};

const statRow: React.CSSProperties = {
  display: "flex",
  gap: 16,
};

const stat: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const statVal: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1,
};

const statLbl: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.55)",
};

const activityList: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const activityHeading: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
};

const activityRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.025)",
  padding: 8,
};

const activityLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 850,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const activityMeta: React.CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  color: "rgba(255,255,255,0.52)",
};

const chip: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "3px 6px",
  fontSize: 10,
  fontWeight: 800,
  background: "rgba(255,255,255,0.04)",
  textTransform: "capitalize",
  flexShrink: 0,
};

const linkRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
};

const linkBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};

const linkPrimary: React.CSSProperties = {
  ...linkBase,
};

const linkDanger: React.CSSProperties = {
  ...linkBase,
  border: "1px solid rgba(251,113,133,0.30)",
  background: "rgba(251,113,133,0.09)",
};

const closeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.45)",
  cursor: "pointer",
  fontSize: 14,
  padding: 2,
  lineHeight: 1,
  flexShrink: 0,
};
