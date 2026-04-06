export default function ProgressLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 1180 }}>
      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skeleton" style={{ width: 160, height: 30 }} />
          <div className="skeleton" style={{ width: 300, height: 14 }} />
        </div>
        <div className="skeleton" style={{ width: 100, height: 42, borderRadius: 12 }} />
      </div>

      {/* Pill nav */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[80, 100, 70, 90, 60].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 34, borderRadius: 999 }} />
        ))}
      </div>

      {/* Summary stat cards */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 116, borderRadius: 18 }} />
        ))}
      </div>

      {/* Large content area */}
      <div className="skeleton" style={{ height: 280, borderRadius: 16 }} />
      <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
    </div>
  );
}
