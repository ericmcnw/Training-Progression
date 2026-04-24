export default function BodyZoneLoading() {
  return (
    <div className="skeletonPage" style={{ maxWidth: 980 }}>
      {/* Back link + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 8 }} />
      </div>

      {/* Zone summary card */}
      <div className="skeleton" style={{ height: 100, borderRadius: 16 }} />

      {/* Activity chart */}
      <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />

      {/* Log entries */}
      <div style={{ display: "grid", gap: 10 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  );
}
