import Link from "next/link";

export function GoalProgressRing({
  current,
  target,
  fraction,
}: {
  current: string;
  target: string;
  fraction: number;
}) {
  const size = 104;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dashOffset = circumference * (1 - clamped);
  const glowOpacity = 0.18 + clamped * 0.32;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "grid",
        placeItems: "center",
        filter: `drop-shadow(0 0 12px rgba(34,197,94,${glowOpacity}))`,
      }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148,163,184,0.26)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(34,197,94,0.95)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center", lineHeight: 1.1, maxWidth: 72 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>{current}</div>
        <div style={{ fontSize: 10, opacity: 0.8 }}>{target}</div>
      </div>
    </div>
  );
}

export function GoalStatusBadge({ label, achieved = false }: { label: string; achieved?: boolean }) {
  return (
    <span
      style={{
        ...chipStyle,
        borderColor: achieved ? "rgba(34,197,94,0.45)" : "rgba(128,128,128,0.35)",
        background: achieved ? "rgba(34,197,94,0.12)" : "rgba(128,128,128,0.08)",
      }}
    >
      {label}
    </span>
  );
}

export function GoalMetaLine({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, opacity: 0.8 }}>{children}</div>;
}

export function GoalCardShell({
  children,
  href,
}: {
  children: React.ReactNode;
  href?: string;
}) {
  if (href) {
    return (
      <Link href={href} style={{ ...cardStyle, color: "inherit", textDecoration: "none" }}>
        {children}
      </Link>
    );
  }

  return <div style={cardStyle}>{children}</div>;
}

export const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  padding: 14,
  background: "linear-gradient(180deg, rgba(128,128,128,0.08), rgba(128,128,128,0.04))",
};

export const chipStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.35)",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 12,
  background: "rgba(128,128,128,0.08)",
};

export const formInputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid rgba(128,128,128,0.45)",
  borderRadius: 12,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  width: "100%",
};

export const subtleTextStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.76,
};
