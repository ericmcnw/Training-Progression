import Link from "next/link";

// Flat 44px-tall row primitive used inside expanded FamilySections.
// One shape for both activities and routines: label on the left, a
// compact metric chip + caret on the right. Whole row is the tap
// target so finger-on-mobile hits work without aim.
export default function Row({
  href,
  label,
  metric,
  hint,
  accent,
}: {
  href: string;
  label: string;
  /** Short metric chip text, e.g. "5×" or "32 mi 4w". */
  metric?: string;
  /** Optional tiny hint shown under the label (e.g. "🔥 6w streak"). */
  hint?: string;
  /** Family accent color used for the metric chip border. */
  accent: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.025)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
        {hint ? (
          <div style={{ fontSize: 10.5, opacity: 0.6, fontWeight: 700, marginTop: 2 }}>{hint}</div>
        ) : null}
      </div>
      {metric ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: "3px 8px",
            borderRadius: 999,
            background: accent.replace("0.9)", "0.10)"),
            border: `1px solid ${accent.replace("0.9)", "0.28)")}`,
            color: accent,
            whiteSpace: "nowrap",
          }}
        >
          {metric}
        </span>
      ) : null}
      <span style={{ fontSize: 16, opacity: 0.4, fontWeight: 700 }}>›</span>
    </Link>
  );
}
