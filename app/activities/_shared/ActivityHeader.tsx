import Link from "next/link";

// Slim shared header for activity-world pages. Two rows (~60px total)
// instead of the old five-row hero (back link, eyebrow, 26px title,
// subtitle paragraph, CTA row ≈ 140px) — every saved pixel goes to the
// charts and lists below, which matters most on mobile.
//
// Layout:
//   row 1: back-link (12px, dim)
//   row 2: accent-colored title (flex) · action pills (wrap)
//
// No eyebrow, no subtitle — they were flavor text. Pages that need a
// stat line should put it in their pulse strip, not the header.
//
// Renders content-only (no outer container/max-width) so each page's
// existing grid container owns spacing.

export default function ActivityHeader({
  title,
  accent,
  backHref = "/activities",
  backLabel = "← Activities",
  actions,
}: {
  title: string;
  accent: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header style={shellStyle}>
      <Link href={backHref} style={backStyle}>{backLabel}</Link>
      <div style={mainRowStyle}>
        <h1 style={{ ...titleStyle, color: accent }}>{title}</h1>
        {actions ? <div style={actionsStyle}>{actions}</div> : null}
      </div>
    </header>
  );
}

const shellStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const backStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
  justifySelf: "start",
};

const mainRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: -0.4,
  flex: "1 1 auto",
  minWidth: 0,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  alignItems: "center",
};
