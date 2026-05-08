// /body shows the body map + zone state + a coverage section. Most of the
// load time is the all-zones-with-state aggregation + coverage overview.

export default function BodyLoading() {
  return (
    <main className="skeletonPage" style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <div>
        <div className="skeleton" style={{ width: 50, height: 12 }} />
        <div className="skeleton" style={{ width: 90, height: 32, marginTop: 6 }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="skeleton" style={{ width: 100, height: 38, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 100, height: 38, borderRadius: 8 }} />
      </div>

      {/* Body map */}
      <div className="skeleton" style={{ height: 460, borderRadius: 16 }} />

      {/* Coverage section */}
      <div className="skeleton" style={{ height: 360, borderRadius: 18 }} />
    </main>
  );
}
