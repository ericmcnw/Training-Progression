// Shared loading skeleton for activity-world pages (climbing, strength,
// running, etc.). Used by their loading.tsx files so the UI paints
// immediately while the heavy server fetches resolve. Layout intentionally
// mirrors the rendered page: header bar -> pulse strip -> goals -> heatmap
// -> 2 content sections.

export default function ActivityWorldSkeleton() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 1120, margin: "0 auto", padding: "4px 0 20px", display: "grid", gap: 16 }}>
      {/* TargetHeader area */}
      <div style={{ display: "grid", gap: 10, padding: "14px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="skeleton" style={{ width: 90, height: 12 }} />
        <div className="skeleton" style={{ width: 200, height: 28 }} />
        <div className="skeleton" style={{ width: 360, height: 14 }} />
      </div>

      {/* Compact nav strip */}
      <div className="skeleton" style={{ height: 28, borderRadius: 8, maxWidth: 320 }} />

      {/* Pulse strip — 4 cards */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 110, borderRadius: 18 }} />
        ))}
      </div>

      {/* Goals section */}
      <div className="skeleton" style={{ height: 140, borderRadius: 18 }} />

      {/* Activity coverage heatmap */}
      <div className="skeleton" style={{ height: 200, borderRadius: 18 }} />

      {/* Content sections */}
      <div className="skeleton" style={{ height: 240, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 280, borderRadius: 18 }} />
    </div>
  );
}
