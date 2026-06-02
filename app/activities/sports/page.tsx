import Link from "next/link";
import { ACTIVITY_FAMILY_META } from "@/lib/activity-families";

export const dynamic = "force-dynamic";

// Phase 1 stub. The full Sports dashboard ships in phase 2:
// sessions-per-week chart, top sport types, per-sport tiles with
// click-through into deep sport pages. Keeping the stub minimal so the
// "Dashboard →" pill on the main /activities page doesn't 404.
export default function SportsDashboardPage() {
  const meta = ACTIVITY_FAMILY_META["sports"];
  return (
    <div style={pageStyle}>
      <Link href="/activities" style={backLinkStyle}>
        ← Activities
      </Link>
      <header style={{ display: "grid", gap: 6 }}>
        <div style={eyebrowStyle}>Dashboard</div>
        <h1 style={{ ...titleStyle, color: meta.accent }}>{meta.label}</h1>
        <p style={subtitleStyle}>{meta.description}</p>
      </header>

      <section style={stubCardStyle}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Coming in phase 2</div>
        <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 6, fontSize: 13, lineHeight: 1.55, opacity: 0.78 }}>
          <li>Sessions-per-week chart, stacked by sport type</li>
          <li>Top sport types ranked by recent activity</li>
          <li>Per-sport tiles with quick stats and click-through to each sport's deep page</li>
          <li>Climbing highlights (recent sends, projects) — leveraging the existing climbing world</li>
        </ul>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/activities/climbing" style={quickLinkStyle}>Climbing →</Link>
        <Link href="/activities" style={quickLinkStyle}>Back to Activities</Link>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "18px 14px 60px",
  display: "grid",
  gap: 18,
};

const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  opacity: 0.55,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: -0.4,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  opacity: 0.72,
  lineHeight: 1.5,
};

const stubCardStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px dashed rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.025)",
};

const quickLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 12,
  fontWeight: 800,
  textDecoration: "none",
  color: "inherit",
  minHeight: 44,
};
