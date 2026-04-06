export default function DashboardLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 1180 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skeleton" style={{ width: 200, height: 28 }} />
          <div className="skeleton" style={{ width: 160, height: 14 }} />
        </div>
        <div className="skeleton" style={{ width: 120, height: 42, borderRadius: 12 }} />
      </div>

      {/* Weekly momentum panel */}
      <div className="skeleton" style={{ height: 280, borderRadius: 18 }} />

      {/* Two-column section */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="skeleton" style={{ height: 220, borderRadius: 18 }} />
        <div className="skeleton" style={{ height: 220, borderRadius: 18 }} />
      </div>

      {/* Recommendations */}
      <div className="skeleton" style={{ height: 180, borderRadius: 18 }} />
    </div>
  );
}
