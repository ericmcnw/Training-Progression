export default function ProgressLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 1120, margin: "0 auto", padding: "4px 0 20px", display: "grid", gap: 18 }}>
      {/* Title + actions row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="skeleton" style={{ width: 140, height: 28 }} />
          <div className="skeleton" style={{ width: 340, height: 14 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div className="skeleton" style={{ width: 120, height: 36, borderRadius: 12 }} />
          <div className="skeleton" style={{ width: 100, height: 36, borderRadius: 12 }} />
        </div>
      </div>

      {/* Section nav (Overview / Routines / Exercises / Cardio / Groups) */}
      <div style={{ display: "grid", gap: 6, padding: "9px 10px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 4 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton" style={{ height: 34, borderRadius: 12 }} />
          ))}
        </div>
      </div>

      {/* This Week card */}
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden" }}>
        {/* Card header */}
        <div style={{ padding: "13px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
          <div className="skeleton" style={{ width: 120, height: 16 }} />
          <div className="skeleton" style={{ width: 300, height: 12, marginTop: 6 }} />
        </div>
        <div style={{ padding: 14, display: "grid", gap: 14 }}>
          {/* Quick stats strip */}
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14 }} />
            ))}
          </div>
          {/* Focus card + sidebar */}
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <div className="skeleton" style={{ height: 180, borderRadius: 20 }} />
            <div style={{ display: "grid", gap: 10 }}>
              <div className="skeleton" style={{ height: 80, borderRadius: 16 }} />
              <div className="skeleton" style={{ height: 80, borderRadius: 16 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Training Balance card */}
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, overflow: "hidden" }}>
        <div style={{ padding: "13px 15px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
          <div className="skeleton" style={{ width: 150, height: 16 }} />
          <div className="skeleton" style={{ width: 260, height: 12, marginTop: 6 }} />
        </div>
        <div style={{ padding: 14 }}>
          {/* Heat matrix rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "140px repeat(4, 1fr)", gap: 4, marginBottom: 4 }}>
              <div className="skeleton" style={{ height: 36, borderRadius: 8 }} />
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="skeleton" style={{ height: 36, borderRadius: 8 }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Coverage + Drill Down (slower, stream in) */}
      <div className="skeleton" style={{ height: 260, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />
    </div>
  );
}
