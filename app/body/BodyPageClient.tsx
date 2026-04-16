"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import BodyMap from "@/app/components/body-map/BodyMap";
import type { ZoneState, ZoneFreshness } from "@/app/components/body-map/types";
import { fetchZoneDetail, type ZoneDetailResult } from "./_actions";

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

function dayLabel(ymd: string, today: string) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (ymd === today) return "Today";
  const d = new Date(ymd + "T12:00:00Z");
  return days[d.getUTCDay()];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
  const weekDays = Object.keys(detail.weekActivityCounts).sort();

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

      {/* Active injuries */}
      {detail.activeInjuries.length > 0 && (
        <div style={section}>
          <div style={sectionHead}>INJURY STATUS</div>
          {detail.activeInjuries.map((inj) => (
            <div key={inj.id} style={injuryCard}>
              <div>
                <div style={{ fontWeight: 900 }}>{inj.name}</div>
                <div style={mutedText}>
                  {"●".repeat(inj.severity)}{"○".repeat(Math.max(0, 5 - inj.severity))} · {inj.status.toLowerCase()}
                </div>
              </div>
              <Link href={`/injuries/${inj.id}`} style={linkSecondary}>Details</Link>
            </div>
          ))}
        </div>
      )}

      {/* This week strip */}
      <div style={section}>
        <div style={sectionHead}>THIS WEEK</div>
        <div style={weekStrip}>
          {weekDays.map((day) => {
            const count = detail.weekActivityCounts[day] ?? 0;
            return (
              <div key={day} style={dayCell(count > 0)}>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{dayLabel(day, detail.today)}</span>
                <span style={dayBubble(count > 0)}>{count > 0 ? count : ""}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activities */}
      {detail.recentActivities.length > 0 && (
        <div style={section}>
          <div style={sectionHead}>WHAT WORKED IT</div>
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

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/body/log-pain?zone=${detail.slug}`} style={linkDanger}>Log pain</Link>
        <Link href={`/body/${detail.slug}?manual=1`} style={linkSecondary}>Log activity</Link>
        <Link href={`/injuries/new?zone=${detail.slug}`} style={linkSecondary}>Mark injured</Link>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function BodyPageClient({ zones }: { zones: ZoneState[] }) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<ZoneDetailResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

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
    <div style={{ display: "grid", gap: 16 }}>
      <BodyMap
        zones={zones}
        size="md"
        onZoneClick={handleZoneClick}
        selectedSlugs={selectedSlug ? [selectedSlug] : []}
      />

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

// ─── Styles ───────────────────────────────────────────────────────────────────
const panel: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "linear-gradient(180deg, rgba(20,29,46,0.9), rgba(13,19,31,0.92))",
  display: "grid",
  gap: 14,
  padding: 16,
};

const panelHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 8,
};

const zoneTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.1,
};

const badge: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
};

const mutedText: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.60)",
  lineHeight: 1.45,
};

const section: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const sectionHead: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1.2,
  color: "rgba(255,255,255,0.45)",
};

const injuryCard: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(251,113,133,0.28)",
  background: "rgba(251,113,133,0.07)",
};

const weekStrip: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 6,
};

function dayCell(active: boolean): React.CSSProperties {
  return {
    display: "grid",
    gap: 5,
    justifyItems: "center",
    padding: 8,
    borderRadius: 10,
    border: active ? "1px solid rgba(45,212,191,0.35)" : "1px solid rgba(255,255,255,0.07)",
    background: active ? "rgba(45,212,191,0.09)" : "rgba(255,255,255,0.02)",
  };
}

function dayBubble(filled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: filled ? "1px solid rgba(45,212,191,0.40)" : "1px solid rgba(255,255,255,0.10)",
    background: filled ? "rgba(45,212,191,0.14)" : "rgba(255,255,255,0.02)",
    fontSize: 11,
    fontWeight: 900,
  };
}

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
