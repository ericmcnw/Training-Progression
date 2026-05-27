import type { CSSProperties } from "react";

// CyclesTab — placeholder. Future: list of active SchedulePlans with
// activation toggles, plus a cycle editor that ports the drag-drop UX
// from app/schedule/ScheduleBoard.tsx.

export default function CyclesTab() {
  return (
    <section style={shell} aria-label="Cycles">
      <div style={iconCircle} aria-hidden>
        ⟳
      </div>
      <h2 style={title}>Cycles are coming</h2>
      <p style={body}>
        Recurring multi-day plans (e.g. Push / Pull / Legs) will live here.
        For now, schedule individual routines from Home&apos;s Week at a glance.
      </p>
    </section>
  );
}

const shell: CSSProperties = {
  display: "grid",
  gap: 12,
  justifyItems: "center",
  textAlign: "center",
  padding: "48px 18px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
};

const iconCircle: CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 999,
  border: "1px solid rgba(132,204,255,0.45)",
  background: "rgba(132,204,255,0.08)",
  color: "rgba(132,204,255,1)",
  fontSize: 22,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const title: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  margin: 0,
};

const body: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
  color: "rgba(255,255,255,0.65)",
  maxWidth: 420,
  margin: 0,
};