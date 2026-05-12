// Loading skeleton for the climbing map page — header + a tall map placeholder.
// MapLibre + tiles take a beat to download on first visit; this keeps the
// layout from shifting underneath the user.

export default function ClimbingMapLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 1120, margin: "0 auto", padding: "4px 0 20px", display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10, padding: "14px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="skeleton" style={{ width: 70, height: 12 }} />
        <div className="skeleton" style={{ width: 200, height: 28 }} />
        <div className="skeleton" style={{ width: 360, height: 14 }} />
      </div>
      <div className="skeleton" style={{ height: "calc(100vh - 280px)", minHeight: 420, borderRadius: 18 }} />
    </div>
  );
}
