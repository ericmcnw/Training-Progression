import Link from "next/link";

export default function NotFound() {
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
        <div style={{ fontSize: 36 }}>🧭</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Page not found</h2>
        <p style={{ opacity: 0.7, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          That page doesn&apos;t exist. Let&apos;s get you back on track.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link
            href="/"
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              border: "1px solid rgba(51,255,122,0.35)",
              background: "rgba(51,255,122,0.08)",
              color: "rgba(51,255,122,1)",
              fontWeight: 800,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
