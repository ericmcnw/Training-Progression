export default function GoalsLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 1180 }}>
      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skeleton" style={{ width: 120, height: 30 }} />
          <div className="skeleton" style={{ width: 260, height: 14 }} />
        </div>
        <div className="skeleton" style={{ width: 100, height: 42, borderRadius: 12 }} />
      </div>

      {/* Type nav */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[50, 90, 110, 80, 90, 100].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 34, borderRadius: 999 }} />
        ))}
      </div>

      {/* Filters card */}
      <div className="skeleton" style={{ height: 72, borderRadius: 16 }} />

      {/* Goal cards */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton" style={{ height: 160, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  );
}
