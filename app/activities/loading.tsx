// Loading skeleton for the /activities landing — family sections with
// activity cards underneath. Matches the rendered page's structure so the
// layout doesn't shift when data arrives.

export default function ActivitiesLoading() {
  return (
    <div className="skeletonPage" style={{ display: "grid", gap: 18 }}>
      <header style={{ display: "grid", gap: 6, padding: "4px 4px 0" }}>
        <div className="skeleton" style={{ width: 140, height: 28 }} />
        <div className="skeleton" style={{ width: 320, height: 14 }} />
      </header>

      {/* Filter / search row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div className="skeleton" style={{ width: 220, height: 36, borderRadius: 10 }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ width: 90, height: 36, borderRadius: 10 }} />
        ))}
      </div>

      {/* Family sections */}
      {[1, 2, 3, 4].map((section) => (
        <div key={section} style={{ display: "grid", gap: 12, padding: "16px 18px", borderRadius: 18, border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div className="skeleton" style={{ width: 120, height: 18 }} />
              <div className="skeleton" style={{ width: 220, height: 12 }} />
            </div>
            <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 999 }} />
          </div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 116, borderRadius: 18 }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
