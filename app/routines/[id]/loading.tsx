export default function RoutineDetailLoading() {
  return (
    <div className="skeletonPage">
      {/* Back link + title */}
      <div style={{ display: "grid", gap: 8 }}>
        <div className="skeleton" style={{ width: 80, height: 14 }} />
        <div className="skeleton" style={{ width: 200, height: 30 }} />
        <div className="skeleton" style={{ width: 160, height: 14 }} />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[100, 110, 90].map((w, i) => (
          <div key={i} className="skeleton" style={{ width: w, height: 42, borderRadius: 12 }} />
        ))}
      </div>

      {/* Exercise list */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14 }} />
      ))}
    </div>
  );
}
