// /plan embeds Schedule or Goals depending on the view. Skeleton mirrors
// the shared "tabs above embed" structure.

export default function PlanLoading() {
  return (
    <div className="skeletonPage" style={{ display: "grid", gap: 12 }}>
      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "4px 4px" }}>
        <div className="skeleton" style={{ width: 110, height: 36, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: 110, height: 36, borderRadius: 12 }} />
      </nav>
      <div className="skeleton" style={{ height: 220, borderRadius: 18 }} />
      <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />
    </div>
  );
}
