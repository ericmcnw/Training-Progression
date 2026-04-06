export default function ScheduleLoading() {
  return (
    <div className="skeletonPage">
      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skeleton" style={{ width: 130, height: 30 }} />
          <div className="skeleton" style={{ width: 200, height: 14 }} />
        </div>
        <div className="skeleton" style={{ width: 110, height: 42, borderRadius: 12 }} />
      </div>

      {/* Day columns */}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="skeleton" style={{ height: 180, borderRadius: 14 }} />
        ))}
      </div>

      <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
    </div>
  );
}
