import type { ReactNode } from "react";
import { SECTION_GAP } from "@/lib/design-tokens";

// Standard page header used across /activities, /body, /injuries, etc. so
// every top-level route gets the same hierarchy: 28px title, optional
// 13px subtitle, optional toolbar slot for action buttons. The shell
// itself is just the header + content stack; pages compose their own
// section cards below.

export default function PageShell({
  eyebrow,
  title,
  subtitle,
  toolbar,
  maxWidth = 980,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  maxWidth?: number;
  children: ReactNode;
}) {
  return (
    <main style={{ maxWidth, margin: "0 auto", display: "grid", gap: SECTION_GAP }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
          padding: "4px 4px 0",
        }}
      >
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          {eyebrow ? (
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: -0.2, lineHeight: 1.08 }}>
            {title}
          </h1>
          {subtitle ? (
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{subtitle}</p>
          ) : null}
        </div>
        {toolbar ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{toolbar}</div> : null}
      </header>
      {children}
    </main>
  );
}
