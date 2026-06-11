import Link from "next/link";
import type { ActivityFamily } from "@/lib/activity-families";

// Shared UI primitives for the Activities tab — section shells, activity cards,
// aggregate stats. Visually consistent with the dashboard SectionCard pattern,
// but tuned for activity-by-activity browsing.

export function ActivitiesShell({
  title,
  subtitle,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <header
        style={{
          display: "grid",
          gap: 6,
          padding: "4px 4px 0",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.72, lineHeight: 1.5 }}>{subtitle}</p>
        ) : null}
        {toolbar ? <div style={{ marginTop: 8 }}>{toolbar}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function FamilySection({
  family,
  label,
  description,
  accent,
  totals,
  href,
  children,
}: {
  family: ActivityFamily;
  label: string;
  description?: string;
  accent: string;
  totals?: {
    sessions: number;
    activeActivities: number;
    extra?: string;
  };
  /** Optional "view all" link that takes the user into a family aggregate view. */
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-family={family}
      style={{
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        background: "rgba(255,255,255,0.03)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: `linear-gradient(180deg, ${accent.replace("0.9)", "0.10)")}, transparent)`,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 28,
            borderRadius: 4,
            background: accent,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              opacity: 0.7,
              fontWeight: 900,
            }}
          >
            {label.toUpperCase()}
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, marginTop: 2 }}>{label}</div>
          {description ? (
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 3, lineHeight: 1.45 }}>{description}</div>
          ) : null}
        </div>

        {totals ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Stat value={String(totals.sessions)} label={totals.sessions === 1 ? "session" : "sessions"} accent={accent} />
            <Stat value={String(totals.activeActivities)} label="active" accent={accent} muted />
            {totals.extra ? <Stat value={totals.extra} label="" accent={accent} muted /> : null}
            {href ? (
              <Link
                href={href}
                style={{
                  alignSelf: "center",
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 800,
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                View All →
              </Link>
            ) : null}
          </div>
        ) : null}
      </header>

      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

function Stat({ value, label, accent, muted }: { value: string; label: string; accent: string; muted?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        justifyItems: "center",
        gap: 1,
        padding: "4px 10px",
        borderRadius: 10,
        background: muted ? "rgba(255,255,255,0.04)" : `${accent.replace("0.9)", "0.12)")}`,
        border: `1px solid ${muted ? "rgba(255,255,255,0.08)" : accent.replace("0.9)", "0.25)")}`,
        minWidth: 56,
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>{value}</span>
      {label ? (
        <span style={{ fontSize: 10, opacity: 0.72, fontWeight: 700, lineHeight: 1.1 }}>{label}</span>
      ) : null}
    </div>
  );
}

export function ActivityCard({
  href,
  eyebrow,
  label,
  primaryStat,
  chips,
  highlight,
  accent,
}: {
  href: string;
  eyebrow: string;
  label: string;
  primaryStat?: { value: string; suffix?: string };
  chips?: string[];
  highlight?: boolean;
  accent: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className="activityCard"
      style={{
        display: "grid",
        gap: 8,
        minHeight: 120,
        padding: 14,
        borderRadius: 16,
        border: highlight
          ? `1px solid ${accent.replace("0.9)", "0.32)")}`
          : "1px solid rgba(255,255,255,0.10)",
        background: highlight
          ? `radial-gradient(circle at top right, ${accent.replace("0.9)", "0.14)")}, transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))`
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          opacity: 0.65,
          fontWeight: 900,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900, fontSize: 17, lineHeight: 1.15 }}>{label}</div>
        {primaryStat ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1 }}>{primaryStat.value}</span>
            {primaryStat.suffix ? (
              <span style={{ fontSize: 11, opacity: 0.72, fontWeight: 800 }}>{primaryStat.suffix}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {chips && chips.length > 0 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chips.map((chip) => (
            <span
              key={chip}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)",
                fontWeight: 700,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export function ActivityCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      }}
    >
      {children}
    </div>
  );
}

export function ActivitiesEmpty({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: "1px dashed rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.02)",
        fontSize: 13,
        opacity: 0.78,
        textAlign: "center" as const,
      }}
    >
      {message}
    </div>
  );
}
