import type { CSSProperties } from "react";

// RotationTab — placeholder for the rotation engine (Phase 3). A rotation is
// an ordered list of slots (Push / Pull / Legs, Upper / Lower, etc.) you
// advance through by logging — not by the calendar. Each slot can be
// satisfied by its primary routine OR a mapped covering activity (a climb
// covers Pull, a long hike covers Legs), and the page recommends the next
// unsatisfied slot. Build lands in a follow-up.

export default function CyclesTab() {
  return (
    <section style={shell} aria-label="Rotation">
      <div style={iconCircle} aria-hidden>
        ⟳
      </div>
      <h2 style={title}>Rotation is coming</h2>
      <p style={body}>
        Build a training rotation — Push / Pull / Legs, Upper / Lower, or your
        own split — and this surface will track what you did last and recommend
        what&apos;s up next. A climb can cover a pull day, a long hike a leg
        day. For now, schedule individual routines from the calendar above.
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