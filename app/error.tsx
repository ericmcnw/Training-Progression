"use client";

import { useEffect } from "react";

export default function GlobalError({
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
      display: "grid",
      placeItems: "center",
      minHeight: "60vh",
      padding: "32px 16px",
      textAlign: "center",
    }}>
      <div style={{ display: "grid", gap: 16, maxWidth: 480 }}>
        <div style={{ fontSize: 36 }}>⚠</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Something went wrong</h2>
        <p style={{ opacity: 0.7, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          An unexpected error occurred. Your data is safe — this is most likely a temporary issue.
        </p>
        {error.digest && (
          <p style={{ opacity: 0.4, margin: 0, fontSize: 11, fontFamily: "monospace" }}>
            Error ID: {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid rgba(51,255,122,0.35)",
              background: "rgba(51,255,122,0.08)",
              color: "rgba(51,255,122,1)",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
              color: "inherit",
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
