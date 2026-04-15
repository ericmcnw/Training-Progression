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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <BodyMap
        zones={zones}
        size="sm"
        onZoneClick={(slug) => setSelectedSlug((prev) => (prev === slug ? null : slug))}
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
                <div style={statLbl}>this week</div>
              </div>
            )}
            {selectedZone.painLevel != null && (
              <div style={stat}>
                <div style={{ ...statVal, color: "#FCA5A5" }}>{selectedZone.painLevel}/10</div>
                <div style={statLbl}>pain level</div>
              </div>
            )}
          </div>

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
