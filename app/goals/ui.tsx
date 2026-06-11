import Link from "next/link";

// PERFORMANCE moved off amber (which collided with lifestyle domain +
// `behind` status) to rose. Kept in sync with the canonical TYPE_ACCENT
// in app/plan/goals/goal-type-accent.ts.
export const GOAL_TYPE_ACCENT: Record<string, string> = {
  FREQUENCY: "rgba(129,140,248,0.65)",
  PERFORMANCE: "rgba(251,113,133,0.65)",
  VOLUME: "rgba(34,211,238,0.65)",
  COMPLETION: "rgba(74,222,128,0.65)",
};

export const GOAL_TYPE_CHIP_STYLE: Record<string, React.CSSProperties> = {
  FREQUENCY: { borderColor: "rgba(129,140,248,0.45)", background: "rgba(129,140,248,0.14)", color: "#e0e7ff" },
  PERFORMANCE: { borderColor: "rgba(251,113,133,0.45)", background: "rgba(251,113,133,0.13)", color: "#ffe4e6" },
  VOLUME: { borderColor: "rgba(34,211,238,0.45)", background: "rgba(34,211,238,0.13)", color: "#cffafe" },
  COMPLETION: { borderColor: "rgba(74,222,128,0.45)", background: "rgba(74,222,128,0.13)", color: "#dcfce7" },
};

function splitValueAndUnit(value: string) {
  const match = value.trim().match(/^(.+?)(?:\s+([A-Za-z%/][A-Za-z0-9%/.-]*))?$/);
  if (!match) return { amount: value, unit: "" };
  return {
    amount: match[1] ?? value,
    unit: match[2] ?? "",
  };
}

function compactAmount(value: string) {
  const trimmed = value.trim();
  if (/^-?\d+\.0+$/.test(trimmed)) {
    return String(Number(trimmed));
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return trimmed.replace(/(\.\d*?[1-9])0+$/, "$1");
  }
  return trimmed;
}

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
  const currentParts = splitValueAndUnit(current);
  const targetParts = splitValueAndUnit(target);
  const sharedUnit = currentParts.unit && currentParts.unit === targetParts.unit ? currentParts.unit : "";
  const currentLabel = compactAmount(sharedUnit ? currentParts.amount : current);
  const targetLabel = compactAmount(sharedUnit ? targetParts.amount : target);

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
      <div
        style={{
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "grid",
            justifyItems: "center",
            lineHeight: 1,
            minWidth: 28,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 19, whiteSpace: "nowrap" }}>{currentLabel}</div>
          <div
            style={{
              width: "100%",
              height: 2,
              borderRadius: 999,
              background: "currentColor",
              opacity: 0.7,
              margin: "3px 0 4px",
            }}
          />
          <div style={{ fontWeight: 900, fontSize: 19, whiteSpace: "nowrap" }}>{targetLabel}</div>
        </div>
        {sharedUnit ? (
          <div
            style={{
              fontSize: 10,
              opacity: 0.82,
              whiteSpace: "nowrap",
            }}
          >
            {sharedUnit}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FrequencySlotBar({
  current,
  target,
  status,
}: {
  current: number;
  target: number;
  status: string;
}) {
  const MAX_DOTS = 10;
  const filled = Math.min(current, target);
  const isAchieved = status === "Achieved" || (target > 0 && current >= target);
  const isBehind = status === "Behind";
  const dotColor = isAchieved
    ? "rgba(34,197,94,0.95)"
    : isBehind
    ? "rgba(248,113,113,0.85)"
    : "rgba(100,180,255,0.9)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        minWidth: 96,
        filter: isAchieved ? "drop-shadow(0 0 8px rgba(34,197,94,0.45))" : undefined,
      }}
    >
      {target <= MAX_DOTS ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 128 }}>
          {Array.from({ length: target }, (_, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: i < filled ? dotColor : "rgba(148,163,184,0.18)",
                border: `1.5px solid ${i < filled ? dotColor : "rgba(148,163,184,0.28)"}`,
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            width: 96,
            height: 10,
            borderRadius: 999,
            background: "rgba(148,163,184,0.15)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${Math.min(1, target > 0 ? current / target : 0) * 100}%`,
              background: dotColor,
              borderRadius: 999,
            }}
          />
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1, opacity: 0.9, textAlign: "center", whiteSpace: "nowrap" }}>
        {current} / {target}
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
  action,
  goalType,
  className,
}: {
  children: React.ReactNode;
  href?: string;
  action?: React.ReactNode;
  goalType?: string;
  className?: string;
}) {
  const accentColor = goalType ? GOAL_TYPE_ACCENT[goalType] : undefined;
  return (
    <div className={className} style={{ ...cardStyle, position: "relative", ...(accentColor ? { borderLeft: `3px solid ${accentColor}` } : {}) }}>
      {href ? <Link href={href} aria-label="Open goal" style={stretchedLinkStyle} /> : null}
      {action ? <div style={cardActionStyle}>{action}</div> : null}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
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
  fontSize: 16, // dodge iOS Safari auto-zoom on focus
  fontFamily: "inherit",
};

export const subtleTextStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.76,
};

export const smallActionLinkStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  border: "1px solid rgba(128,128,128,0.42)",
  borderRadius: 999,
  background: "rgba(128,128,128,0.12)",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

const stretchedLinkStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 16,
  zIndex: 0,
};

const cardActionStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: 10,
};
