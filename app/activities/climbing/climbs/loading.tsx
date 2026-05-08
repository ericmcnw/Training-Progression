// Loading skeleton for the climbs browse page — header + filter card + a few
// location group placeholders.

export default function ClimbsBrowseLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 1120, margin: "0 auto", padding: "4px 0 20px", display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 10, padding: "14px 16px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="skeleton" style={{ width: 70, height: 12 }} />
        <div className="skeleton" style={{ width: 160, height: 28 }} />
        <div className="skeleton" style={{ width: 320, height: 14 }} />
      </div>
      <div className="skeleton" style={{ height: 180, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 220, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 220, borderRadius: 18 }} />
    </div>
  );
}
