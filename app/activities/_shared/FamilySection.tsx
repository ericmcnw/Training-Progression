"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

// Collapsible family section for the /activities main page. Mirrors the
// log page's RoutineSection idiom — tight clickable header, accent-
// colored left stripe, count chip on the right, body hidden until
// expanded. Adds a header-right [Dashboard →] pill so users can jump
// straight to the family's hub without expanding first.
//
// All-collapsed by default; explicit `defaultOpen` opens on mount.
// State is local-only (per render); cross-visit persistence is a future
// follow-up if the user asks for it.
export default function FamilySection({
  label,
  sessionsLabel,
  activeLabel,
  accent,
  dashboardHref,
  defaultOpen = false,
  children,
}: {
  label: string;
  /** Right-side chip text: "12 sessions" or "0 sessions". */
  sessionsLabel: string;
  /** Right-side chip text: "5 active" or "0 active". */
  activeLabel: string;
  /** Accent color in `rgba(R,G,B,0.9)` form (matches ACTIVITY_FAMILY_META). */
  accent: string;
  /** URL of the family's dashboard hub. */
  dashboardHref: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderLeft: `3px solid ${accent}`,
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Toggle button — fills the row except for the dashboard pill */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 52,
            padding: "10px 12px 10px 14px",
            border: 0,
            background: "transparent",
            color: "inherit",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 10,
            textAlign: "left",
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 11,
              opacity: 0.6,
              width: 12,
              display: "inline-block",
              transition: "transform 120ms ease",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          >
            ▾
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: accent,
            }}
          >
            {label}
          </span>
          <span
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "flex-end",
              minWidth: 0,
            }}
          >
            <Chip>{sessionsLabel}</Chip>
            <Chip muted>{activeLabel}</Chip>
          </span>
        </button>

        {/* Dashboard pill — outside the toggle so it's directly tappable.
            Label collapses to an arrow on narrow widths via the className
            so the row never overflows on small phones. */}
        <Link
          href={dashboardHref}
          aria-label={`Open ${label} dashboard`}
          className="activityFamilyDashboardPill"
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.025)",
            fontSize: 11,
            fontWeight: 800,
            color: accent,
            textDecoration: "none",
            whiteSpace: "nowrap",
            minHeight: 52,
            flexShrink: 0,
          }}
        >
          <span className="activityFamilyDashboardPillFull">Dashboard →</span>
          <span className="activityFamilyDashboardPillShort" aria-hidden>→</span>
        </Link>
      </div>

      {open ? (
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: 10,
            display: "grid",
            gap: 12,
          }}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function Chip({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        padding: "4px 8px",
        borderRadius: 999,
        background: muted ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)",
        border: muted
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid rgba(255,255,255,0.12)",
        opacity: muted ? 0.7 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
