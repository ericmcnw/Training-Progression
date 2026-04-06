export default function RoutinesLoading() {
  return (
    <div className="skeletonPage">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skeleton" style={{ width: 140, height: 30 }} />
          <div className="skeleton" style={{ width: 220, height: 14 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 110, height: 42, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 150, height: 42, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 120, height: 42, borderRadius: 12 }} />
        </div>
      </div>

      {/* Search bar */}
      <div className="skeleton" style={{ height: 46, borderRadius: 10 }} />

      {/* Section label */}
      <div className="skeleton" style={{ width: 90, height: 14 }} />

      {/* Routine cards */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 96, borderRadius: 16 }}
        />
      ))}
    </div>
  );
}
