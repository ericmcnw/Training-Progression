export default function ExercisesLoading() {
  return (
    <div className="skeletonPage">
      {/* Title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="skeleton" style={{ width: 160, height: 30 }} />
        <div className="skeleton" style={{ width: 130, height: 42, borderRadius: 12 }} />
      </div>

      {/* Category nav */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[50, 80, 110, 70, 90, 80, 65].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 34, borderRadius: 999 }} />
        ))}
      </div>

      {/* Search / filter bar */}
      <div className="skeleton" style={{ height: 72, borderRadius: 16 }} />

      {/* Exercise rows */}
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12 }} />
      ))}
    </div>
  );
}
