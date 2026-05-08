// /log embeds /routines today — show a thin tabs skeleton + the routines
// page skeleton-equivalent so paint isn't blank while the embed warms up.

export default function LogLoading() {
  return (
    <div className="skeletonPage" style={{ display: "grid", gap: 12 }}>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 4px" }}>
        <div className="skeleton" style={{ width: 110, height: 36, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: 110, height: 36, borderRadius: 12 }} />
      </nav>
      <div className="skeleton" style={{ height: 64, borderRadius: 16 }} />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton" style={{ height: 100, borderRadius: 16 }} />
      ))}
    </div>
  );
}
