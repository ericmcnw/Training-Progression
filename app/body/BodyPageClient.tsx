"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import BodyMap from "@/app/components/body-map/BodyMap";
import type { ZoneState, ZoneFreshness } from "@/app/components/body-map/types";
import { fetchZoneDetail, type ZoneDetailResult } from "./_actions";
import { cardSurface, cardTitle, COLOR, RADIUS } from "@/lib/design-tokens";

const MAP_OPEN_STORAGE_KEY = "body:mapOpen";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const freshnessLabel: Record<ZoneFreshness, string> = {
  FRESH: "Fresh",
  WORKED_TODAY: "Worked today",
  RECENTLY_WORKED: "Recently worked",
  RECOVERING: "Recovering",
  INJURED: "Injured",
};

const freshnessBadge: Record<ZoneFreshness, React.CSSProperties> = {
  FRESH:           { background: "rgba(229,231,235,0.10)", borderColor: "rgba(229,231,235,0.18)", color: "#E5E7EB" },
  WORKED_TODAY:    { background: "rgba(67,56,202,0.18)",  borderColor: "rgba(129,140,248,0.36)",  color: "#C7D2FE" },
  RECENTLY_WORKED: { background: "rgba(37,99,235,0.16)",  borderColor: "rgba(96,165,250,0.34)",  color: "#BFDBFE" },
  RECOVERING:      { background: "rgba(147,197,253,0.16)",  borderColor: "rgba(147,197,253,0.34)",  color: "#DBEAFE" },
  INJURED:         { background: "rgba(225,29,29,0.18)", borderColor: "rgba(255,56,56,0.42)", color: "#FCA5A5" },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function weekTotal(week: Record<string, number>) {
  return Object.values(week).reduce((sum, n) => sum + n, 0);
}

function monthTotal(days: Array<{ ymd: string; count: number }>) {
  return days.reduce((sum, day) => sum + day.count, 0);
}

// ─── 28-day activity sparkline ─────────────────────────────────────────
// Server-renderable SVG bar strip. Each day owns one bar; height scales
// to the peak day in the window (or 4 as a floor so single-session days
// don't render full-height). Today's bar is tinted brighter so it pops.

function ActivitySparkline({
  days,
  today,
}: {
  days: Array<{ ymd: string; count: number }>;
  today: string;
}) {
  if (days.length === 0) return null;
  const peak = Math.max(4, ...days.map((d) => d.count));
  const height = 44;
  const dayCount = days.length;

  return (
    <div style={sparkShell}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${dayCount * 10} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily activity over the last ${dayCount} days`}
        style={{ display: "block" }}
      >
        {days.map((day, i) => {
          const slotX = i * 10;
          const barWidth = 6;
          const barX = slotX + (10 - barWidth) / 2;
          if (day.count <= 0) {
            return (
              <rect
                key={day.ymd}
                x={barX}
                y={height - 1.5}
                width={barWidth}
                height={1.5}
                fill="rgba(255,255,255,0.10)"
              />
            );
          }
          const barH = Math.max(3, (day.count / peak) * height);
          const isToday = day.ymd === today;
          return (
            <rect
              key={day.ymd}
              x={barX}
              y={height - barH}
              width={barWidth}
              height={barH}
              fill={isToday ? "rgba(51,255,122,0.85)" : "rgba(132,204,255,0.7)"}
              rx={1}
            >
              <title>{`${day.ymd}: ${day.count} entr${day.count === 1 ? "y" : "ies"}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={sparkAxisRow}>
        <span>{shortDate(days[0]?.ymd)}</span>
        <span>{shortDate(days[Math.floor(dayCount / 2)]?.ymd)}</span>
        <span style={{ color: COLOR.text, fontWeight: 800 }}>Today</span>
      </div>
    </div>
  );
}

function shortDate(ymd: string | undefined) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// ─── Zone detail panel ────────────────────────────────────────────────────────
function ZonePanel({
  detail,
  onClose,
  loading,
}: {
  detail: ZoneDetailResult;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div style={{ ...panel, opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
      {/* Header */}
      <div style={panelHead}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={zoneTitle}>{detail.label}</h2>
            <span style={{ ...badge, ...freshnessBadge[detail.freshness as ZoneFreshness] }}>
              {freshnessLabel[detail.freshness as ZoneFreshness] ?? detail.freshness}
            </span>
          </div>
          <div style={mutedText}>
            {detail.activityCount != null
              ? `${detail.activityCount} work entr${detail.activityCount === 1 ? "y" : "ies"} this week`
              : "No recent work entries"}
            {detail.daysSinceWorked != null
              ? ` · last worked ${detail.daysSinceWorked === 0 ? "today" : `${detail.daysSinceWorked}d ago`}`
              : ""}
            {detail.painLevel != null ? ` · pain ${detail.painLevel}/10` : ""}
          </div>
        </div>
        <button type="button" onClick={onClose} style={closeBtn} aria-label="Close zone detail">
          ✕
        </button>
      </div>

      {/* 28-day activity sparkline — same visual language as the injury
          pain history so /body and /injuries read as one system. The
          weekActivityCounts data is still in the payload but we render the
          richer 28-day signal here. */}
      <div style={section}>
        <div style={sparkHeaderRow}>
          <div style={sectionHead}>Last 28 days</div>
          <div style={sparkMeta}>
            {weekTotal(detail.weekActivityCounts)} this week · {monthTotal(detail.dailyActivityCounts)} this month
          </div>
        </div>
        <ActivitySparkline days={detail.dailyActivityCounts} today={detail.today} />
      </div>

      {/* Recent activities */}
      {detail.recentActivities.length > 0 && (
        <div style={section}>
          <div style={sectionHead}>What worked it</div>
          <div style={{ display: "grid", gap: 6 }}>
            {detail.recentActivities.map((a) => (
              <div key={a.id} style={activityRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 850, fontSize: 13 }}>{a.label}</div>
                  <div style={mutedText}>{a.zoneLabel} · {fmtTime(a.performedAt)}</div>
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}>
                  <span style={chip}>{a.source.toLowerCase().replace(/_/g, " ")}</span>
                  {a.intensity ? <span style={chip}>{a.intensity}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions — when this zone is part of an active injury, surface a
          direct link to its detail page so users don't have to bounce
          through /injuries to find it. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {detail.activeInjuries.length > 0 && (
          detail.activeInjuries.map((injury) => (
            <Link key={injury.id} href={`/injuries/${injury.id}`} style={linkInjury}>
              View injury · {injury.name}
            </Link>
          ))
        )}
        <Link href={`/body/log-pain?zone=${detail.slug}`} style={linkDanger}>Log pain</Link>
        <Link href={`/body/${detail.slug}?manual=1`} style={linkSecondary}>Log activity</Link>
        {detail.activeInjuries.length === 0 && (
          <Link href={`/injuries/new?zone=${detail.slug}`} style={linkSecondary}>Mark injured</Link>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function BodyPageClient({ zones }: { zones: ZoneState[] }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<ZoneDetailResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mapOpen, setMapOpen] = useState(true);
  const requestId = useRef(0);

  // Persist the map collapse state across visits so users who prefer the
  // page without the map don't have to re-collapse every time.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MAP_OPEN_STORAGE_KEY);
      if (stored === "false") setMapOpen(false);
    } catch {
      // ignore — localStorage unavailable
    }
  }, []);

  function toggleMap() {
    const next = !mapOpen;
    setMapOpen(next);
    try {
      window.localStorage.setItem(MAP_OPEN_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
    // Collapsing while a zone is selected is fine — the detail panel still
    // lives below the map. We don't auto-clear it.
  }

  function handleZoneClick(slug: string) {
    if (slug === selectedSlug) {
      requestId.current += 1;
      setSelectedSlug(null);
      setDetail(null);
      return;
    }
    setSelectedSlug(slug);
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    startTransition(async () => {
      const result = await fetchZoneDetail(slug);
      if (requestId.current !== currentRequest) return;
      setDetail(result);
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={mapCardStyle}>
        <button
          type="button"
          onClick={toggleMap}
          style={mapHeaderButton}
          aria-expanded={mapOpen}
          aria-controls="body-map-panel"
        >
          <span style={mapHeaderTitle}>Body map</span>
          <span style={mapHeaderHint}>
            {mapOpen ? "Tap a zone for details" : "Tap to expand"}
          </span>
          <span style={chevronStyle(mapOpen)} aria-hidden>
            ▾
          </span>
        </button>
        {mapOpen && (
          <div id="body-map-panel" style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <BodyMap
              zones={zones}
              size="md"
              onZoneClick={handleZoneClick}
              selectedSlugs={selectedSlug ? [selectedSlug] : []}
            />
            <BodyMapLegend />
          </div>
        )}
      </section>

      {isPending && !detail && (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
          Loading…
        </div>
      )}

      {detail && (
        <ZonePanel
          detail={detail}
          onClose={() => { requestId.current += 1; setSelectedSlug(null); setDetail(null); }}
          loading={isPending}
        />
      )}
    </div>
  );
}

// ─── Body map legend ─────────────────────────────────────────────────────────
// Inline strip beneath the map so users who don't already know the color
// scheme can decode what they're looking at. Matches the chip palette
// rendered above the map on /body so the two read as one system.

const LEGEND_ENTRIES: Array<{ key: ZoneFreshness; label: string; color: string }> = [
  { key: "INJURED",         label: "Injured",         color: "rgba(248,113,113,0.85)" },
  { key: "RECOVERING",      label: "Recovering",      color: "rgba(147,197,253,0.85)" },
  { key: "WORKED_TODAY",    label: "Worked today",    color: "rgba(129,140,248,0.85)" },
  { key: "RECENTLY_WORKED", label: "Recently worked", color: "rgba(96,165,250,0.85)"  },
  { key: "FRESH",           label: "Fresh",           color: "rgba(229,231,235,0.55)" },
];

function BodyMapLegend() {
  return (
    <div style={legendRow}>
      {LEGEND_ENTRIES.map((entry) => (
        <span key={entry.key} style={legendItem}>
          <span style={{ ...legendSwatch, background: entry.color }} />
          {entry.label}
        </span>
      ))}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const mapCardStyle: React.CSSProperties = {
  ...cardSurface,
  padding: 14,
  gap: 0,
};

const mapHeaderButton: React.CSSProperties = {
  appearance: "none",
  margin: 0,
  padding: 0,
  background: "transparent",
  border: "none",
  color: "inherit",
  font: "inherit",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  textAlign: "left",
  width: "100%",
  minHeight: 24,
};

const mapHeaderTitle: React.CSSProperties = {
  ...cardTitle,
  flexShrink: 0,
};

const mapHeaderHint: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textFaint,
  marginLeft: 8,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function chevronStyle(open: boolean): React.CSSProperties {
  return {
    fontSize: 14,
    fontWeight: 800,
    color: COLOR.textDim,
    transform: open ? "rotate(0deg)" : "rotate(-90deg)",
    transition: "transform 160ms ease",
    flexShrink: 0,
  };
}

const legendRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  paddingTop: 6,
  borderTop: `1px solid ${COLOR.border}`,
  fontSize: 10,
  fontWeight: 700,
  color: COLOR.textDim,
};

const legendItem: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  letterSpacing: 0.2,
};

const legendSwatch: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 2,
  display: "inline-block",
};

const panel: React.CSSProperties = {
  ...cardSurface,
  gap: 14,
};

const panelHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
};

const zoneTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: -0.2,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid",
  borderRadius: RADIUS.pill,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
};

const mutedText: React.CSSProperties = {
  fontSize: 12,
  color: COLOR.textDim,
  lineHeight: 1.45,
};

const section: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const sectionHead: React.CSSProperties = cardTitle;

const sparkHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
  flexWrap: "wrap",
};

const sparkMeta: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const sparkShell: React.CSSProperties = {
  display: "grid",
  gap: 4,
  width: "100%",
};

const sparkAxisRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 9.5,
  fontWeight: 700,
  color: COLOR.textFaint,
};

const activityRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.02)",
};

const chip: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 999,
  padding: "3px 7px",
  fontSize: 11,
  fontWeight: 800,
  background: "rgba(255,255,255,0.04)",
  textTransform: "capitalize",
};

const linkBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};

const linkSecondary: React.CSSProperties = { ...linkBase };

const linkDanger: React.CSSProperties = {
  ...linkBase,
  border: "1px solid rgba(251,113,133,0.30)",
  background: "rgba(251,113,133,0.08)",
};

const linkInjury: React.CSSProperties = {
  ...linkBase,
  border: "1px solid rgba(251,146,60,0.4)",
  background: "rgba(251,146,60,0.10)",
  color: "#FED7AA",
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
