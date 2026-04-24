"use client";

import { useEffect } from "react";

export default function BodyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
      maxWidth: 980,
      margin: "0 auto",
      padding: "32px 16px",
      display: "grid",
      gap: 16,
      placeItems: "center",
      minHeight: "50vh",
      textAlign: "center",
    }}>
      <div style={{ display: "grid", gap: 12, maxWidth: 420 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Couldn't load body data</h2>
        <p style={{ opacity: 0.7, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          There was a problem loading your body map and zone data. Try refreshing.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={reset}
            style={{
              padding: "9px 18px",
              borderRadius: 12,
              border: "1px solid rgba(51,255,122,0.35)",
              background: "rgba(51,255,122,0.08)",
              color: "rgba(51,255,122,1)",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a href="/" style={{ padding: "9px 18px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: "inherit", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
