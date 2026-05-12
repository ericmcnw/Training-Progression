export default function GlobalSpotsMapLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 1120, margin: "0 auto", padding: "4px 0 20px", display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10, padding: "14px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="skeleton" style={{ width: 90, height: 12 }} />
        <div className="skeleton" style={{ width: 220, height: 28 }} />
        <div className="skeleton" style={{ width: 380, height: 14 }} />
      </div>
      <div className="skeleton" style={{ height: "calc(100vh - 280px)", minHeight: 420, borderRadius: 18 }} />
    </div>
  );
}
