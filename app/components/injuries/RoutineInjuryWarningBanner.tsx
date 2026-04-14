import type { RoutineInjuryWarning } from "@/lib/injury-warnings";

export default function RoutineInjuryWarningBanner({ warning }: { warning: RoutineInjuryWarning | null }) {
  if (!warning) return null;
  return (
    <div style={banner}>
      <div style={{ fontWeight: 900 }}>This routine loads your {warning.zoneLabels.join(", ")}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
        {warning.exercises.map((exercise) => `${exercise.name} (${exercise.zoneLabels.join(", ")})`).join(" · ")}
      </div>
    </div>
  );
}

const banner: React.CSSProperties = {
  border: "1px solid rgba(252,211,77,0.35)",
  borderRadius: 14,
  background: "rgba(252,211,77,0.10)",
  padding: 12,
  display: "grid",
  gap: 5,
};
