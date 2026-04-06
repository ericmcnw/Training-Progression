export default function LogLoading() {
  return (
    <div className="skeletonPage">
      {/* Title */}
      <div style={{ display: "grid", gap: 8 }}>
        <div className="skeleton" style={{ width: 80, height: 14 }} />
        <div className="skeleton" style={{ width: 220, height: 30 }} />
      </div>

      {/* Date picker row */}
      <div className="skeleton" style={{ height: 52, borderRadius: 12 }} />

      {/* Exercise log entries */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="skeleton" style={{ height: 88, borderRadius: 14 }} />
      ))}

      {/* Save button */}
      <div className="skeleton" style={{ height: 48, borderRadius: 12 }} />
    </div>
  );
}
