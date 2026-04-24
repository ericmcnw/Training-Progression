export default function WeeklyReportLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 980 }}>
      {/* Header + week nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skeleton" style={{ width: 180, height: 28 }} />
          <div className="skeleton" style={{ width: 240, height: 14 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 80, height: 38, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 80, height: 38, borderRadius: 12 }} />
        </div>
      </div>

      {/* Summary stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 14 }} />
        ))}
      </div>

      {/* Coverage bar */}
      <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />

      {/* Day-by-day log list */}
      <div style={{ display: "grid", gap: 12 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  );
}
