"use client";

import { useState } from "react";
import Link from "next/link";

export default function RoutineSection({
  title,
  count,
  quickLogHref,
  children,
}: {
  title: string;
  count: number;
  quickLogHref?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="mobileSectionCard"
      style={{
        border: "1px solid rgba(128,128,128,0.35)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mobileRoutinesHeader mobileSectionHeader"
          style={{
            width: "100%",
            minHeight: 0,
            padding: "10px 14px",
            border: 0,
            borderBottom: open ? "1px solid rgba(128,128,128,0.25)" : "0",
            borderRadius: 0,
            background: "rgba(128,128,128,0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "inherit",
            cursor: "pointer",
            boxShadow: "none",
            position: "relative",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 12,
              opacity: 0.78,
            }}
          >
            {open ? "▴" : "▾"}
          </span>
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 0.5 }}>{title}</span>
        </button>

        <div
          style={{
            position: "absolute",
            right: 14,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {quickLogHref ? (
            <Link
              href={quickLogHref}
              style={{
                minHeight: 28,
                padding: "4px 8px",
                border: "1px solid rgba(128,128,128,0.7)",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
                background: "rgba(255,255,255,0.06)",
                fontWeight: 800,
                fontSize: 11,
                lineHeight: 1.2,
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              }}
            >
              Quick Log
            </Link>
          ) : null}
          <span style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>{count} routines</span>
        </div>
      </div>

      {open ? <div className="mobileSectionBody" style={{ padding: 10, display: "grid", gap: 8 }}>{children}</div> : null}
    </section>
  );
}
