"use client";

import Link from "next/link";
import { formatGuidedSeconds, totalGuidedTemplateDuration } from "@/lib/guided";
import type { GuidedTemplateStep } from "@/lib/guided";

export default function GuidedEntryScreen({
  routineName,
  steps,
  autoPlay,
  onAutoPlayChange,
  onGuideMe,
  onLogAfter,
  backHref,
}: {
  routineName: string;
  steps: GuidedTemplateStep[];
  autoPlay: boolean;
  onAutoPlayChange: (value: boolean) => void;
  onGuideMe: () => void;
  onLogAfter: () => void;
  backHref: string;
}) {
  const estimatedSec = totalGuidedTemplateDuration(steps);
  const count = steps.length;

  return (
    <div style={{ display: "grid", gap: 28, maxWidth: 480, margin: "0 auto", padding: "4px 2px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link href={backHref} style={backBtnStyle}>
          ← Back
        </Link>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.15 }}>{routineName}</div>
          <div style={{ fontSize: 13, opacity: 0.62, marginTop: 3 }}>
            {count} step{count !== 1 ? "s" : ""}
            {estimatedSec > 0 ? ` · est. ${formatGuidedSeconds(estimatedSec)}` : ""}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {/* Guide Me card */}
        <div style={guideMeCardStyle}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={iconBox("rgba(34,197,94,0.85)")}>▶</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>Guide Me</div>
              <div style={{ fontSize: 13, opacity: 0.72, marginTop: 4, lineHeight: 1.5 }}>
                Walk through each step with a live timer
              </div>
            </div>
          </div>

          {/* Auto / Manual toggle */}
          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => onAutoPlayChange(true)}
                style={modeBtn(autoPlay)}
              >
                Auto-play
              </button>
              <button
                type="button"
                onClick={() => onAutoPlayChange(false)}
                style={modeBtn(!autoPlay)}
              >
                Manual
              </button>
            </div>
            <div style={{ fontSize: 12, opacity: 0.56, lineHeight: 1.5 }}>
              {autoPlay
                ? "Timer counts down and advances automatically between steps"
                : "Timer shows target duration — tap Next when you're ready to move on"}
            </div>
          </div>

          <button type="button" onClick={onGuideMe} style={startBtnStyle}>
            Start Session
          </button>
        </div>

        {/* Already Done card */}
        <button type="button" onClick={onLogAfter} style={logAfterCardStyle}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={iconBox("rgba(128,128,128,0.55)")}>✓</div>
            <div style={{ textAlign: "left" as const }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Already Done</div>
              <div style={{ fontSize: 13, opacity: 0.72, marginTop: 4, lineHeight: 1.5 }}>
                Log weights, skipped steps, and notes after the fact
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(128,128,128,0.45)",
  borderRadius: 10,
  textDecoration: "none",
  color: "inherit",
  fontWeight: 800,
  background: "rgba(128,128,128,0.08)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const guideMeCardStyle: React.CSSProperties = {
  border: "1px solid rgba(34,197,94,0.35)",
  borderRadius: 20,
  padding: 20,
  background: "rgba(34,197,94,0.04)",
  display: "grid",
  gap: 0,
};

const logAfterCardStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 20,
  padding: 20,
  background: "rgba(128,128,128,0.05)",
  cursor: "pointer",
  color: "inherit",
  textAlign: "left",
  width: "100%",
};

function iconBox(bg: string): React.CSSProperties {
  return {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 900,
    flexShrink: 0,
    color: "#fff",
  };
}

function modeBtn(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "11px 12px",
    border: active ? "1px solid rgba(34,197,94,0.55)" : "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    background: active ? "rgba(34,197,94,0.12)" : "rgba(128,128,128,0.08)",
    color: "inherit",
    fontWeight: active ? 900 : 700,
    fontSize: 14,
    cursor: "pointer",
  };
}

const startBtnStyle: React.CSSProperties = {
  marginTop: 20,
  width: "100%",
  padding: "15px 16px",
  border: "none",
  borderRadius: 14,
  background: "rgba(34,197,94,0.88)",
  color: "#000",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};
